import { NotFoundException } from '@nestjs/common';
import { SalesOrdersService, isValidCustomerPhone, cleanLabel, PHONE_REQUIRED_MSG, assertCustomerPhone, cleanMarketplace, MARKETPLACE_PHONE_INVALID_MSG, buildDesignerStats, wibDateKey } from './sales-orders.service';

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

describe('SalesOrdersService — HP pelanggan wajib & label pekerjaan', () => {
    it.each(['081333618055', '+62 813-3361-8055', '6281333618055', '0882 0086 07834'])('HP valid: %s', (hp) => {
        expect(isValidCustomerPhone(hp)).toBe(true);
    });
    // "8055" = pola nota EXINDO lama (hanya 4 digit terakhir) → KPI salah menghitung pelanggan.
    it.each(['8055', '--', '+62', '0812', '', null, undefined])('HP tidak valid: %s', (hp) => {
        expect(isValidCustomerPhone(hp as any)).toBe(false);
    });

    it('cleanLabel: rapikan spasi, kosong → null, maks 120 karakter', () => {
        expect(cleanLabel('  Event   Gemoy  ')).toBe('Event Gemoy');
        expect(cleanLabel('   ')).toBeNull();
        expect(cleanLabel(null)).toBeNull();
        expect(cleanLabel('x'.repeat(130))).toHaveLength(120);
    });

    it('create menolak SO tanpa HP valid SEBELUM menyentuh database', async () => {
        const prisma: any = {}; // sengaja kosong: bila create sampai ke DB, tes ini akan meledak
        const svc = new SalesOrdersService(prisma, {} as any);
        await expect(svc.create({
            customerName: '(EXINDO) Gemoy', customerPhone: null, designerName: 'Rangga',
            items: [{ productVariantId: 1, quantity: 1 }],
        } as any)).rejects.toThrow(PHONE_REQUIRED_MSG);
    });

    it('update: mengubah data pelanggan pada SO tanpa HP ditolak', async () => {
        const prisma: any = {
            salesOrder: {
                findUnique: jest.fn().mockResolvedValue({ id: 7, status: 'DRAFT', customerPhone: null, branchName: null, items: [] }),
                update: jest.fn(),
            },
        };
        const svc = new SalesOrdersService(prisma, {} as any);
        await expect(svc.update(7, { customerName: 'Exindo', label: 'Event Gemoy' })).rejects.toThrow(PHONE_REQUIRED_MSG);
        expect(prisma.salesOrder.update).not.toHaveBeenCalled();
    });
});

describe('SalesOrdersService — order marketplace (pembeli tanpa HP)', () => {
    it('order biasa tanpa HP ditolak; order marketplace tanpa HP diterima', () => {
        expect(() => assertCustomerPhone(null, null)).toThrow(PHONE_REQUIRED_MSG);
        expect(() => assertCustomerPhone('', 'Shopee')).not.toThrow();
    });
    it('order marketplace dengan HP asal-asalan tetap ditolak', () => {
        expect(() => assertCustomerPhone('--', 'Shopee')).toThrow(MARKETPLACE_PHONE_INVALID_MSG);
        expect(() => assertCustomerPhone('8055', 'TikTok Shop')).toThrow(MARKETPLACE_PHONE_INVALID_MSG);
        expect(() => assertCustomerPhone('081333618055', 'Tokopedia')).not.toThrow();
    });
    it('cleanMarketplace: rapikan spasi, kosong → null, maks 40', () => {
        expect(cleanMarketplace('  TikTok   Shop ')).toBe('TikTok Shop');
        expect(cleanMarketplace('   ')).toBeNull();
        expect(cleanMarketplace('x'.repeat(50))).toHaveLength(40);
    });
    it('update: SO lama tanpa HP boleh disimpan setelah ditandai marketplace', async () => {
        const prisma: any = {
            salesOrder: {
                findUnique: jest.fn().mockResolvedValue({ id: 8, status: 'DRAFT', customerPhone: null, marketplace: null, branchName: null, items: [] }),
                update: jest.fn().mockResolvedValue({ id: 8 }),
            },
            $transaction: (cb: any) => cb(prisma),
        };
        const svc = new SalesOrdersService(prisma, {} as any);
        await svc.update(8, { customerName: 'Novi', marketplace: ' Shopee ', marketplaceOrderNo: ' 2409ABC ' });
        expect(prisma.salesOrder.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ customerName: 'Novi', marketplace: 'Shopee', marketplaceOrderNo: '2409ABC' }),
        }));
    });
});

describe('SalesOrdersService.update — ganti item tidak boleh mengosongkan SO', () => {
    function build(variants: { id: number }[] = [{ id: 5 }]) {
        const prisma: any = {
            salesOrder: {
                findUnique: jest.fn().mockResolvedValue({ id: 9, status: 'SENT', customerPhone: '081333618055', branchName: null, items: [] }),
                update: jest.fn().mockResolvedValue({ id: 9 }),
            },
            salesOrderItem: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
            productVariant: {
                findMany: jest.fn().mockImplementation(({ select }: any) =>
                    Promise.resolve(select?.stock ? variants.map(v => ({ ...v, stock: 10, product: { trackStock: false } })) : variants)),
            },
            $transaction: jest.fn().mockImplementation((cb: any) => cb(prisma)),
        };
        return { prisma, svc: new SalesOrdersService(prisma, {} as any) };
    }

    it.each([
        [{ productVariantId: 5, quantity: 0 }, /jumlah/],
        [{ productVariantId: 5, quantity: 1.5 }, /jumlah/],
        [{ productVariantId: 5, quantity: 1, widthCm: 0, heightCm: 100 }, /lebar/],
        [{ productVariantId: 0, quantity: 1 }, /produk/],
    ])('item tidak valid %j ditolak SEBELUM item lama dihapus', async (item, msg) => {
        const { prisma, svc } = build();
        await expect(svc.update(9, { items: [item as any] })).rejects.toThrow(msg);
        expect(prisma.salesOrderItem.deleteMany).not.toHaveBeenCalled();
    });

    it('varian yang tidak ada ditolak, item lama tetap utuh', async () => {
        const { prisma, svc } = build([]);
        await expect(svc.update(9, { items: [{ productVariantId: 77, quantity: 1 }] })).rejects.toThrow(/tidak ditemukan/);
        expect(prisma.salesOrderItem.deleteMany).not.toHaveBeenCalled();
    });

    it('item valid: hapus + buat ulang di dalam SATU transaksi', async () => {
        const { prisma, svc } = build();
        await svc.update(9, { items: [{ productVariantId: 5, quantity: 2 }] });
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(prisma.salesOrderItem.deleteMany).toHaveBeenCalledWith({ where: { salesOrderId: 9 } });
        expect(prisma.salesOrder.update.mock.calls[0][0].data.items.create).toEqual([
            expect.objectContaining({ productVariantId: 5, quantity: 2 }),
        ]);
    });
});

describe('buildDesignerStats — kartu "Hore" desainer (hari & bulan WIB)', () => {
    // 12 Sep 2026 10:00 WIB = 03:00 UTC
    const NOW = new Date('2026-09-12T03:00:00Z');
    const at = (iso: string, status = 'INVOICED', items = 1) => ({ createdAt: new Date(iso), status, items });

    it('batas hari mengikuti WIB, bukan UTC', () => {
        const s = buildDesignerStats([
            at('2026-09-11T17:10:00Z', 'DRAFT', 2), // 12 Sep 00:10 WIB → hari ini
            at('2026-09-11T16:30:00Z'),             // 11 Sep 23:30 WIB → kemarin
        ], [], NOW);
        expect(s.today).toEqual({ date: '2026-09-12', so: 1, items: 2 });
        expect(wibDateKey('2026-09-11T16:30:00Z')).toBe('2026-09-11');
    });

    it('bulan ini: jumlah SO, item, jadi nota & hari aktif; bulan lalu tidak ikut', () => {
        const s = buildDesignerStats([
            at('2026-09-12T01:00:00Z', 'DRAFT', 3),
            at('2026-09-01T02:00:00Z', 'INVOICED', 2),
            at('2026-08-31T16:59:00Z', 'INVOICED', 5), // 31 Agu 23:59 WIB
        ], [], NOW);
        expect(s.month).toEqual({ key: '2026-09', so: 2, items: 5, invoiced: 1, activeDays: 2 });
    });

    it('rekor harian bulan ini + rekor sebelum hari ini (deteksi rekor baru)', () => {
        const rows = [
            ...Array.from({ length: 3 }, () => at('2026-09-12T02:00:00Z')),
            ...Array.from({ length: 2 }, () => at('2026-09-10T02:00:00Z')),
        ];
        expect(buildDesignerStats(rows, [], NOW).bestDay).toEqual({ date: '2026-09-12', so: 3, previousBest: 2 });
    });

    it('"kemarin jam segini" hanya menghitung SO sampai jam yang sama', () => {
        const s = buildDesignerStats([at('2026-09-11T02:00:00Z'), at('2026-09-11T05:00:00Z')], [], NOW);
        expect(s.yesterdaySameTime.so).toBe(1);
    });

    it('hari kerja beruntun: hari toko tutup dilewati, hari desainer absen memutus', () => {
        const rows = [at('2026-09-12T02:00:00Z'), at('2026-09-11T02:00:00Z'), at('2026-09-09T02:00:00Z'), at('2026-09-07T02:00:00Z')];
        // 10 Sep toko tutup (tidak ada di storeDays) → dilewati; 8 Sep toko buka tapi desainer tanpa SO → putus
        const storeDays = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-11', '2026-09-12'];
        expect(buildDesignerStats(rows, storeDays, NOW).streak).toBe(3);
    });

    it('belum ada SO hari ini: rantai dihitung mulai kemarin', () => {
        const s = buildDesignerStats([at('2026-09-11T02:00:00Z')], ['2026-09-11', '2026-09-12'], NOW);
        expect(s.streak).toBe(1);
        expect(s.today.so).toBe(0);
    });
});
