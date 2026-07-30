import { HppService } from './hpp.service';

/**
 * applyVariantsBom: tiap varian punya BOM (bahan) sendiri yang bisa berbeda.
 * - VariantIngredient ditulis ulang (deleteMany lalu createMany) per varian.
 * - variant.hpp di-set = Σ(price × quantity) agar konsisten dgn transaksi/overview.
 */
describe('HppService.applyVariantsBom', () => {
    function buildPrisma() {
        const prisma: any = {
            variantIngredient: {
                deleteMany: jest.fn().mockReturnValue({ __op: 'deleteMany' }),
                createMany: jest.fn().mockReturnValue({ __op: 'createMany' }),
            },
            productVariant: {
                update: jest.fn().mockReturnValue({ __op: 'update' }),
            },
            hppWorksheet: {
                update: jest.fn().mockResolvedValue({}),
            },
            // Bentuk array: jalankan (no-op) & resolve.
            $transaction: jest.fn().mockResolvedValue([]),
        };
        return prisma;
    }

    it('menulis ulang VariantIngredient & set variant.hpp = total BOM', async () => {
        const prisma = buildPrisma();
        const service = new HppService(prisma as any);

        await service.applyVariantsBom(1, [
            {
                variantId: 10,
                items: [
                    { name: 'Rangka Kayu', quantity: 2, unit: 'batang', price: 5000, isShared: true, rawMaterialVariantId: 99 },
                    { name: 'Banner F280', quantity: 1.5, unit: 'm2', price: 20000, isShared: false, rawMaterialVariantId: 77 },
                ],
            },
        ]);

        // deleteMany utk varian 10
        expect(prisma.variantIngredient.deleteMany).toHaveBeenCalledWith({ where: { variantId: 10 } });

        // createMany berisi 2 baris utk varian 10, membawa flag & rawMaterialVariantId
        const createArg = prisma.variantIngredient.createMany.mock.calls[0][0];
        expect(createArg.data).toHaveLength(2);
        expect(createArg.data[0]).toMatchObject({ variantId: 10, name: 'Rangka Kayu', isShared: true, rawMaterialVariantId: 99 });
        expect(createArg.data[1]).toMatchObject({ variantId: 10, name: 'Banner F280', isShared: false, rawMaterialVariantId: 77 });

        // variant.hpp = 2*5000 + 1.5*20000 = 40000
        expect(prisma.productVariant.update).toHaveBeenCalledWith({ where: { id: 10 }, data: { hpp: 40000 } });

        // worksheet appliedAt di-stamp
        expect(prisma.hppWorksheet.update).toHaveBeenCalled();
    });

    it('default isServiceCost/isShared=false & rawMaterialVariantId=null bila tak diisi', async () => {
        const prisma = buildPrisma();
        const service = new HppService(prisma as any);

        await service.applyVariantsBom(0, [
            { variantId: 3, items: [{ name: 'Lem', quantity: 1, unit: 'pcs', price: 1000 }] },
        ]);

        const createArg = prisma.variantIngredient.createMany.mock.calls[0][0];
        expect(createArg.data[0]).toMatchObject({
            isServiceCost: false,
            isShared: false,
            rawMaterialVariantId: null,
        });
        // worksheetId=0 → tidak stamp worksheet
        expect(prisma.hppWorksheet.update).not.toHaveBeenCalled();
    });

    it('menolak bila daftar varian kosong', async () => {
        const prisma = buildPrisma();
        const service = new HppService(prisma as any);
        await expect(service.applyVariantsBom(1, [])).rejects.toThrow();
    });
});
