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

/**
 * Regresi konsistensi ESTIMASI ↔ Daftar Produk Order pada createLeadFromSO.
 *
 * BUG: item SO area-based dengan pcs>1 (mis. 1 desain dicetak 2 lembar) → ESTIMASI
 * lead dihitung × pcs, TAPI LeadItem.quantity ditulis = qty saja (pcs cuma masuk
 * note). Akibatnya kolom Qty tampil 1 padahal 2, dan Total daftar produk (yang
 * dihitung qty×area×harga) < ESTIMASI. LeadItem tidak punya kolom pcs, jadi
 * konvensi: quantity HARUS = qty × pcs (pengali total) — sama seperti yang
 * diasumsikan jalur convert lead→nota.
 */
describe('SalesOrdersService.createLeadFromSO — ESTIMASI cocok dengan Daftar Produk (pcs)', () => {
    // Formula subtotal sama dengan calcItemSubtotal (leads.service / LeadItemsEditor):
    // area-based → qty × area(m²) × harga/m².
    function leadItemSubtotal(it: any): number {
        const qty = Number(it.quantity) || 0;
        const price = Number(it.unitPrice) || 0;
        const w = Number(it.widthCm) || 0;
        const h = Number(it.heightCm) || 0;
        if (it.unitType === 'menit' && w > 0) return qty * w * price;
        if (w > 0 && h > 0) {
            const areaM2 = it.unitType === 'm' ? w * h : (w * h) / 10000;
            return qty * areaM2 * price;
        }
        return qty * price;
    }

    function buildService() {
        // Item area 1m² (100×100 cm), harga 50.000/m², qty 1, DICETAK 2 lembar (pcs=2)
        const SO = {
            id: 99,
            soNumber: 'SO-PST-20260716-0001',
            customerName: 'Exindo',
            customerPhone: null, // null → lewati pencarian lead CS, langsung buat lead baru
            branchName: 'Pusat',
            designerName: 'Desainer',
            notes: 'EXINDO | EVENT APMP MARIOTT',
            status: 'SENT',
            proofs: [],
            items: [
                {
                    productVariantId: 7,
                    quantity: 1,
                    pcs: 2,
                    widthCm: 100,
                    heightCm: 100,
                    unitType: 'cm',
                    customPrice: 50000,
                    note: null,
                    productVariant: { product: { name: 'Cetak Stiker', pricingMode: 'AREA_BASED' } },
                },
            ],
        };

        const captured: { estimatedValue?: number; rows?: any[] } = {};
        const prisma: any = {
            salesOrder: { findUnique: jest.fn().mockResolvedValue(SO) },
            companyBranch: { findMany: jest.fn().mockResolvedValue([]) },
            lead: {
                findFirst: jest.fn().mockResolvedValue(null), // tak ada lead existing/CS
                create: jest.fn().mockImplementation(({ data }: any) => {
                    captured.estimatedValue = data.estimatedValue;
                    return Promise.resolve({ id: 1, ...data });
                }),
                update: jest.fn().mockResolvedValue({}),
            },
            leadActivity: { create: jest.fn().mockResolvedValue({}) },
            leadImage: {
                findFirst: jest.fn().mockResolvedValue(null),
                findMany: jest.fn().mockResolvedValue([]),
                deleteMany: jest.fn().mockResolvedValue({}),
                aggregate: jest.fn().mockResolvedValue({ _max: { position: null } }),
                createMany: jest.fn().mockResolvedValue({}),
            },
            leadItem: {
                deleteMany: jest.fn().mockResolvedValue({}),
                createMany: jest.fn().mockImplementation(({ data }: any) => {
                    captured.rows = data;
                    return Promise.resolve({});
                }),
            },
        };
        const discord: any = {
            notifyNewLead: jest.fn(),
            notifySuratOrder: jest.fn(),
            notifyLeadOrderRevised: jest.fn(),
        };
        return { svc: new SalesOrdersService(prisma as any, discord as any), captured };
    }

    it('menulis LeadItem.quantity = qty × pcs, bukan qty saja', async () => {
        const { svc, captured } = buildService();
        await svc.createLeadFromSO(99);
        expect(captured.rows).toHaveLength(1);
        expect(captured.rows![0].quantity).toBe(2); // 1 desain × 2 lembar
    });

    it('ESTIMASI lead === Total Daftar Produk Order (tidak ada selisih pcs)', async () => {
        const { svc, captured } = buildService();
        await svc.createLeadFromSO(99);
        const totalDaftar = captured.rows!.reduce((s, it) => s + leadItemSubtotal(it), 0);
        expect(Math.round(totalDaftar)).toBe(captured.estimatedValue); // 100.000 === 100.000
    });
});
