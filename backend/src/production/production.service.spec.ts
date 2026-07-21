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
