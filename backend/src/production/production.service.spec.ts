import { ProductionService } from './production.service';

/**
 * Sub Order: job yang disub ke printing luar (isSubOrder=true) TIDAK boleh
 * memotong stok bahan/tinta saat operator mulai job (startJob), walaupun
 * operator mengisi rollVariantId & rollAreaM2. Pola sama seperti usedWaste.
 */
describe('ProductionService.startJob — Sub Order tidak potong bahan', () => {
    function buildTx(job: any) {
        const tx: any = {
            productionJob: {
                findUnique: jest.fn().mockResolvedValue(job),
                update: jest.fn().mockResolvedValue({ ...job, status: 'PROSES' }),
            },
            productVariant: {
                findUnique: jest.fn().mockResolvedValue({ id: 5, stock: 100 }),
                update: jest.fn().mockResolvedValue({}),
            },
            branchStock: {
                findUnique: jest.fn().mockResolvedValue({ stock: 100 }),
                upsert: jest.fn().mockResolvedValue({ stock: 97 }),
            },
            stockMovement: { create: jest.fn().mockResolvedValue({}) },
        };
        return tx;
    }

    function buildService(tx: any) {
        const prisma: any = {
            $transaction: (cb: any) => cb(tx),
        };
        return new ProductionService(prisma as any, {} as any);
    }

    it('job sub-order: TIDAK potong bahan walau rollVariantId & rollAreaM2 diisi', async () => {
        const tx = buildTx({ id: 1, status: 'ANTRIAN', isSubOrder: true, branchId: 1 });
        const svc = buildService(tx);

        const res = await svc.startJob(1, { usedWaste: false, rollVariantId: 5, rollAreaM2: 3 });

        // Tidak ada pergerakan stok sama sekali
        expect(tx.stockMovement.create).not.toHaveBeenCalled();
        expect(tx.branchStock.upsert).not.toHaveBeenCalled();
        expect(tx.productVariant.update).not.toHaveBeenCalled();
        // Job tetap jalan → PROSES
        expect(tx.productionJob.update).toHaveBeenCalled();
        expect(res.status).toBe('PROSES');
    });

    it('job NON sub-order: tetap potong bahan seperti biasa', async () => {
        const tx = buildTx({ id: 2, status: 'ANTRIAN', isSubOrder: false, branchId: 1 });
        const svc = buildService(tx);

        await svc.startJob(2, { usedWaste: false, rollVariantId: 5, rollAreaM2: 3 });

        // Kontrol: stok terpotong (movement OUT tercatat)
        expect(tx.stockMovement.create).toHaveBeenCalled();
    });
});
