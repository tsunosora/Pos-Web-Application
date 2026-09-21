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
                updateMany: jest.fn().mockResolvedValue({ count: 1 }), // klaim status atomik
                update: jest.fn().mockResolvedValue({ ...job, status: 'PROSES' }),
            },
            productVariant: {
                findUnique: jest.fn().mockResolvedValue({ id: 5, stock: 100 }),
                update: jest.fn().mockResolvedValue({ stock: 97 }),
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

    it('luas dihitung server dari item nota × pcs; rollLengthUsed = yang dipotong (dibulatkan ke atas)', async () => {
        // 100×100 cm = 10.000 cm² per lembar × 3 pcs = 3 m²; klien kirim 1 m² (lupa pcs)
        const tx = buildTx({ id: 3, status: 'ANTRIAN', isSubOrder: false, branchId: 1, transactionItem: { areaCm2: 10000, pcs: 3 } });
        const svc = buildService(tx);

        await svc.startJob(3, { usedWaste: false, rollVariantId: 5, rollAreaM2: 1 });

        expect(tx.stockMovement.create.mock.calls[0][0].data.quantity).toBe(3);
        expect(tx.productVariant.update.mock.calls[0][0].data).toEqual({ stock: { increment: -3 } }); // increment atomik
        expect(tx.productionJob.update.mock.calls[0][0].data.rollLengthUsed).toBe(3);
    });

    it('sub-order: rollLengthUsed kosong (tak ada yang dipotong → tak ada yang dikembalikan)', async () => {
        const tx = buildTx({ id: 4, status: 'ANTRIAN', isSubOrder: true, branchId: 1 });
        await buildService(tx).startJob(4, { usedWaste: false, rollVariantId: 5, rollAreaM2: 3 });
        expect(tx.productionJob.update.mock.calls[0][0].data.rollLengthUsed).toBeNull();
    });

    it('dua perangkat bersamaan: yang kalah klaim → 409, stok tidak dipotong', async () => {
        const tx = buildTx({ id: 5, status: 'ANTRIAN', isSubOrder: false, branchId: 1 });
        tx.productionJob.updateMany.mockResolvedValue({ count: 0 });
        await expect(buildService(tx).startJob(5, { usedWaste: false, rollVariantId: 5, rollAreaM2: 3 }))
            .rejects.toThrow('Job sudah diproses oleh perangkat lain');
        expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('job batal tidak bisa dimulai', async () => {
        const tx = buildTx({ id: 6, status: 'ANTRIAN', isSubOrder: false, branchId: 1, cancelledAt: new Date() });
        await expect(buildService(tx).startJob(6, { usedWaste: false, rollVariantId: 5, rollAreaM2: 3 }))
            .rejects.toThrow('Job sudah dibatalkan');
        expect(tx.productionJob.updateMany).not.toHaveBeenCalled();
    });
});

describe('ProductionService.startAssembly — BOM hanya utk produk AREA_BASED', () => {
    function run(pricingMode: string) {
        const job = {
            id: 1, status: 'MENUNGGU_PASANG', branchId: 1, jobNumber: 'JOB-1',
            transactionItem: { productVariant: { product: { pricingMode, ingredients: [{ rawMaterialVariantId: 9, quantity: 1, name: 'Rangka' }] } } },
        };
        const tx: any = {
            productionJob: {
                findUnique: jest.fn().mockResolvedValue(job),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            },
            productVariant: { update: jest.fn().mockResolvedValue({ stock: 5 }) },
            branchStock: { upsert: jest.fn().mockResolvedValue({}) },
            stockMovement: { create: jest.fn().mockResolvedValue({}) },
        };
        const svc = new ProductionService({ $transaction: (cb: any) => cb(tx) } as any, {} as any);
        return { tx, done: svc.startAssembly(1) };
    }

    it('UNIT: BOM sudah dipotong saat checkout → tidak dipotong lagi', async () => {
        const { tx, done } = run('UNIT');
        await done;
        expect(tx.stockMovement.create).not.toHaveBeenCalled();
    });

    it('AREA_BASED: BOM rangka dipotong saat mulai pasang', async () => {
        const { tx, done } = run('AREA_BASED');
        await done;
        expect(tx.stockMovement.create).toHaveBeenCalledTimes(1);
    });
});

/**
 * Pipeline: shippedAt harus terisi saat job masuk KIRIM ATAU langsung ke SELESAI
 * (operator kerap men-skip KIRIM). Leaderboard "pcs dikirim" berbasis shippedAt,
 * jadi job SELESAI tanpa shippedAt tidak akan terhitung dikirim.
 */
describe('ProductionService.updatePipelineStage — shippedAt saat KIRIM/SELESAI', () => {
    function buildService(existing: any) {
        const productionJob = {
            findUnique: jest.fn().mockResolvedValue(existing),
            update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 1, ...data })),
        };
        const productionJobActivity = { createMany: jest.fn().mockResolvedValue({}) };
        const prisma: any = { productionJob, productionJobActivity };
        return { svc: new ProductionService(prisma as any, {} as any), productionJob };
    }

    it('JAHIT → SELESAI langsung (skip KIRIM): shippedAt TERISI', async () => {
        const { svc, productionJob } = buildService({ pipelineStage: 'JAHIT', branchId: 1, shippedAt: null });

        await svc.updatePipelineStage(1, { pipelineStage: 'SELESAI' }, { name: 'Op', role: 'OPERATOR' });

        expect(productionJob.update).toHaveBeenCalled();
        const data = productionJob.update.mock.calls[0][0].data;
        expect(data.shippedAt).toBeInstanceOf(Date);
    });

    it('masuk KIRIM: shippedAt TERISI', async () => {
        const { svc, productionJob } = buildService({ pipelineStage: 'QC_PACKING', branchId: 1, shippedAt: null });

        await svc.updatePipelineStage(1, { pipelineStage: 'KIRIM' }, { name: 'Op', role: 'OPERATOR' });

        const data = productionJob.update.mock.calls[0][0].data;
        expect(data.shippedAt).toBeInstanceOf(Date);
    });

    it('KIRIM → SELESAI: shippedAt asli TIDAK tertimpa', async () => {
        const original = new Date('2026-07-01T00:00:00Z');
        const { svc, productionJob } = buildService({ pipelineStage: 'KIRIM', branchId: 1, shippedAt: original });

        await svc.updatePipelineStage(1, { pipelineStage: 'SELESAI' }, { name: 'Op', role: 'OPERATOR' });

        const data = productionJob.update.mock.calls[0][0].data;
        // Tidak menulis ulang shippedAt (dijaga tanggal kirim asli)
        expect(data.shippedAt).toBeUndefined();
    });
});

/**
 * REGRESI: pipeline kanban dulu memakai SATU query `take: 500` yang mencampur job
 * aktif + riwayat terminal (SELESAI/RETUR 14 hari). Saat riwayat SELESAI menumpuk
 * hingga total > 500 dengan urutan `createdAt: 'asc'`, job aktif TERBARU ikut
 * terpotong diam-diam dan hilang dari pipeline. Fix: pisah 2 bucket dengan cap
 * terpisah — job aktif tidak boleh pernah bersaing dengan riwayat terminal.
 */
describe('ProductionService.getPipelineJobs — job aktif tak terpotong riwayat terminal', () => {
    function isTerminalQuery(where: any): boolean {
        // Bucket terminal: pipelineStage in [SELESAI, RETUR] + updatedAt cutoff (tanpa OR aktif).
        return where?.pipelineStage?.in?.includes('SELESAI') && !where?.OR;
    }

    function buildService(activeJobs: any[], terminalJobs: any[]) {
        const findMany = jest.fn().mockImplementation(({ where, take }: any) => {
            if (isTerminalQuery(where)) return Promise.resolve(terminalJobs.slice(0, take));
            return Promise.resolve(activeJobs.slice(0, take));
        });
        const prisma: any = { productionJob: { findMany } };
        return { svc: new ProductionService(prisma as any, {} as any), findMany };
    }

    it('job aktif terbaru tetap muncul walau ada 400+ riwayat terminal', async () => {
        // 130 job aktif; job terbaru (id 9999) di urutan paling akhir seperti `createdAt: asc`.
        const active = Array.from({ length: 130 }, (_, i) => ({ id: i + 1, pipelineStage: 'DESIGN' }));
        active.push({ id: 9999, pipelineStage: 'DESIGN' }); // job hari ini, paling belakang
        const terminal = Array.from({ length: 400 }, (_, i) => ({ id: 20000 + i, pipelineStage: 'SELESAI' }));

        const { svc, findMany } = buildService(active, terminal);
        const jobs = await svc.getPipelineJobs(1);

        // Dua query terpisah (aktif + terminal), bukan satu query campuran.
        expect(findMany).toHaveBeenCalledTimes(2);

        // Bucket aktif memakai cap yang jauh di atas jumlah riwayat terminal,
        // sehingga job aktif tak pernah tergeser oleh riwayat.
        const activeCall = findMany.mock.calls.find(([arg]: any) => !isTerminalQuery(arg.where))![0];
        expect(activeCall.take).toBeGreaterThanOrEqual(1000);

        // Simptom inti: job aktif TERBARU hadir di hasil.
        expect(jobs.some((j: any) => j.id === 9999)).toBe(true);
        // Semua 131 job aktif ikut, tak ada yang di-drop diam-diam.
        expect(jobs.filter((j: any) => j.pipelineStage === 'DESIGN')).toHaveLength(131);
    });

    it('riwayat terminal tetap dibatasi cap (FE tak overload)', async () => {
        const active = [{ id: 1, pipelineStage: 'PRINT' }];
        const terminal = Array.from({ length: 500 }, (_, i) => ({ id: 20000 + i, pipelineStage: 'SELESAI' }));

        const { svc, findMany } = buildService(active, terminal);
        const jobs = await svc.getPipelineJobs(1);

        const terminalCall = findMany.mock.calls.find(([arg]: any) => isTerminalQuery(arg.where))![0];
        expect(terminalCall.take).toBeLessThanOrEqual(300);
        expect(jobs.filter((j: any) => j.pipelineStage === 'SELESAI').length).toBeLessThanOrEqual(300);
    });
});

/**
 * After-sales FU dulu tak pernah terbuat: kode membaca transaction.customerId/userId yang
 * tidak ada. Pelanggan kini dicari dari SO → lead yang closing ke nota → HP nota.
 */
describe('ProductionService.pickupJob — jadwal follow-up after-sales', () => {
    function build(tx: any, opts: { leadCustomerId?: number; customersByPhone?: any[] } = {}) {
        const prisma: any = {
            productionJob: {
                findUnique: jest.fn().mockResolvedValue({ id: 1, status: 'SELESAI', branchId: 2 }),
                updateMany: jest.fn().mockResolvedValue({ count: 1 }),
                findMany: jest.fn().mockResolvedValue([{ id: 1, transactionId: 10, branchId: 2 }]),
            },
            transaction: { findMany: jest.fn().mockResolvedValue([tx]) },
            lead: {
                findMany: jest.fn().mockResolvedValue(opts.leadCustomerId ? [{ convertedTransactionId: 10, convertedCustomerId: opts.leadCustomerId }] : []),
            },
            customer: {
                findMany: jest.fn().mockImplementation(({ where }: any) =>
                    Promise.resolve(where.phone
                        ? (opts.customersByPhone ?? [])
                        : where.id.in.map((id: number) => ({ id, assignedCsId: 7 })))),
            },
        };
        const followUps = { scheduleAfterSales: jest.fn().mockResolvedValue({}) };
        return { prisma, followUps, svc: new ProductionService(prisma, followUps as any) };
    }

    it('pelanggan dari SO asal nota + CS pemegang pelanggan', async () => {
        const { svc, followUps } = build({ id: 10, branchId: 3, customerPhone: null, salesOrder: { customerId: 55 } });
        await svc.pickupJob(1);
        expect(followUps.scheduleAfterSales).toHaveBeenCalledWith({
            customerId: 55, branchId: 3, sourceRef: 'production-pickup:job-1', assignedToId: 7,
        });
    });

    it('tanpa SO: pakai lead yang closing ke nota ini', async () => {
        const { svc, followUps } = build({ id: 10, branchId: 3, customerPhone: '0812', salesOrder: null }, { leadCustomerId: 66 });
        await svc.pickupJob(1);
        expect(followUps.scheduleAfterSales.mock.calls[0][0].customerId).toBe(66);
    });

    it('tanpa SO/lead: cocokkan HP nota 08xx ke customers.phone 62xx', async () => {
        const { svc, followUps, prisma } = build(
            { id: 10, branchId: 3, customerPhone: '0812-3456-7890', salesOrder: null },
            { customersByPhone: [{ id: 77, phone: '6281234567890' }] },
        );
        await svc.pickupJob(1);
        expect(prisma.customer.findMany.mock.calls[0][0].where.phone.in).toEqual(['6281234567890']);
        expect(followUps.scheduleAfterSales.mock.calls[0][0].customerId).toBe(77);
    });

    it('pelanggan tak ditemukan: dilewati tanpa galat', async () => {
        const { svc, followUps } = build({ id: 10, branchId: 3, customerPhone: '0812-3456-7890', salesOrder: null });
        await expect(svc.pickupJob(1)).resolves.toBeDefined();
        expect(followUps.scheduleAfterSales).not.toHaveBeenCalled();
    });
});
