import { NotFoundException } from '@nestjs/common';
import { SalesOrdersService } from './sales-orders.service';

/**
 * Regresi alur "satu pintu" lintas cabang: designer PUSAT membuat SO untuk lead
 * milik CS CABANG (dan sebaliknya). Saat CS klik "Buat Nota di POS" (/pos?fromSO),
 * POS memanggil GET /sales-orders/:id -> findOne(id, ctx.branchId). Dulu findOne
 * melempar NotFound karena branchName SO ("Pusat") != cabang CS -> keranjang kosong.
 * Sekarang: kalau ada lead milik cabang pemohon yang tertaut ke SO, izinkan.
 */
describe('SalesOrdersService.findOne — scoping lintas cabang (satu pintu)', () => {
    const SO = {
        id: 42,
        soNumber: 'SO-PST-20260706-0001',
        branchName: 'Pusat',
        items: [],
    };

    function buildService(overrides: {
        branchName?: string;      // nama CompanyBranch cabang pemohon (CS)
        branchCode?: string | null;
        linkedLeadCount?: number; // jumlah lead milik cabang pemohon yang tertaut ke SO
    }) {
        const prisma: any = {
            salesOrder: { findUnique: jest.fn().mockResolvedValue(SO) },
            companyBranch: {
                findUnique: jest.fn().mockResolvedValue({
                    name: overrides.branchName ?? 'Cabang Sewon',
                    code: overrides.branchCode ?? 'SWN',
                }),
            },
            lead: { count: jest.fn().mockResolvedValue(overrides.linkedLeadCount ?? 0) },
        };
        return new SalesOrdersService(prisma as any, {} as any);
    }

    it('BLOKIR: cabang beda & tidak ada lead tertaut → NotFound', async () => {
        const svc = buildService({ branchName: 'Cabang Sewon', linkedLeadCount: 0 });
        await expect(svc.findOne(SO.id, 7)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('IZINKAN: cabang beda TAPI cabang pemohon punya lead tertaut ke SO → kembalikan SO', async () => {
        const svc = buildService({ branchName: 'Cabang Sewon', linkedLeadCount: 1 });
        await expect(svc.findOne(SO.id, 7)).resolves.toMatchObject({ id: SO.id });
    });

    it('IZINKAN: branchName SO cocok dengan cabang pemohon (kasus normal)', async () => {
        const svc = buildService({ branchName: 'Pusat', linkedLeadCount: 0 });
        await expect(svc.findOne(SO.id, 1)).resolves.toMatchObject({ id: SO.id });
    });

    it('IZINKAN: Owner (branchId null) → tanpa scoping', async () => {
        const svc = buildService({ linkedLeadCount: 0 });
        await expect(svc.findOne(SO.id, null)).resolves.toMatchObject({ id: SO.id });
    });
});
