import { PrismaService } from '../../prisma/prisma.service';
import { KpiService } from './kpi.service';

/**
 * Integration test (MENULIS KE DB SUNGGUHAN) untuk pemisahan status kirim di
 * leaderboard CS: KIRIM = "Sedang Dikirim" (notasInTransit), SELESAI = "Sudah
 * Terkirim" (notasDelivered).
 *
 * Skenario CS "Faisal" (lihat contoh di percakapan):
 *   INV-001 : 1 job SELESAI                 → Terkirim
 *   INV-002 : 1 job KIRIM                    → Dikirim
 *   INV-003 : 2 job SELESAI + SELESAI        → Terkirim
 *   INV-004 : 2 job SELESAI + KIRIM          → Dikirim (belum semua SELESAI)
 *   INV-005 : 1 job KIRIM tapi di-RETUR      → TIDAK dihitung (returnedAt terisi)
 *   INV-006 : 1 job SELESAI, shippedAt lampau → TIDAK dihitung (luar periode)
 *
 * Harapan: notasInTransit = 2, notasDelivered = 2, notasShipped = 4.
 *
 * Guard: hanya jalan bila DATABASE_URL menunjuk DB lokal (localhost/127.0.0.1)
 * atau env ALLOW_DB_ITEST=1 — agar tidak sengaja menulis ke DB produksi.
 * Semua record diberi prefiks ITEST- dan dihapus lagi di akhir (self-cleaning).
 */

const DB_URL = process.env.DATABASE_URL || '';
const CAN_RUN =
    /localhost|127\.0\.0\.1/.test(DB_URL) || process.env.ALLOW_DB_ITEST === '1';

const RUN = Date.now();
const JOB_PREFIX = 'ITEST-JOB-';
const INV_PREFIX = 'ITEST-KIRIM-';
const LEAD_PREFIX = 'ITEST-LEAD-';
const EMAIL_PREFIX = 'faisal.itest.';

const inv = (n: string) => `${INV_PREFIX}${RUN}-${n}`;
const jobNo = (n: string) => `${JOB_PREFIX}${RUN}-${n}`;

function daysFromNow(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
}
function ymd(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

// describe.skip kalau bukan DB lokal → CI/prod aman.
const d = CAN_RUN ? describe : describe.skip;

d('KpiService — pemisahan Sedang Dikirim (KIRIM) vs Sudah Terkirim (SELESAI)', () => {
    const prisma = new PrismaService();
    const service = new KpiService(prisma, {} as any, {} as any, { waCsMetricsByUser: async () => new Map() } as any);
    let faisalId = 0;

    async function sweep() {
        // Urutan hormati FK: job → transaksi (cascade item) → lead → user.
        await prisma.productionJob.deleteMany({ where: { jobNumber: { startsWith: JOB_PREFIX } } });
        await prisma.transaction.deleteMany({ where: { invoiceNumber: { startsWith: INV_PREFIX } } });
        await (prisma as any).lead.deleteMany({ where: { name: { startsWith: LEAD_PREFIX } } });
        await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
    }

    // Bikin satu nota + lead (attribusi ke Faisal) + N job dgn stage tertentu.
    async function createNota(
        n: string,
        stages: string[],
        opts: { shippedAt: Date; returnedAt?: Date | null } = { shippedAt: new Date() },
    ) {
        const tx = await prisma.transaction.create({
            data: {
                invoiceNumber: inv(n),
                totalAmount: 100000,
                tax: 0,
                grandTotal: 100000,
                paymentMethod: 'CASH',
                customerName: `ITEST ${n}`,
            } as any,
        });
        await (prisma as any).lead.create({
            data: {
                name: `${LEAD_PREFIX}${RUN}-${n}`,
                source: 'WHATSAPP',
                assignedToId: faisalId,
                convertedTransactionId: tx.id,
            },
        });
        for (let i = 0; i < stages.length; i++) {
            const item = await prisma.transactionItem.create({
                data: { transactionId: tx.id, quantity: 1, priceAtTime: 100000 } as any,
            });
            await prisma.productionJob.create({
                data: {
                    jobNumber: jobNo(`${n}-${i}`),
                    transactionId: tx.id,
                    transactionItemId: item.id,
                    pipelineStage: stages[i],
                    shippedAt: opts.shippedAt,
                    returnedAt: opts.returnedAt ?? null,
                } as any,
            });
        }
    }

    beforeAll(async () => {
        await prisma.$connect();
        await sweep(); // bersihkan sisa run yang mungkin gagal sebelumnya

        const faisal = await prisma.user.create({
            data: {
                name: 'Faisal',
                email: `${EMAIL_PREFIX}${RUN}@test.local`,
                passwordHash: 'x',
            } as any,
        });
        faisalId = faisal.id;

        const now = new Date();               // dalam periode
        const past = daysFromNow(-5);          // luar periode

        await createNota('001', ['SELESAI'], { shippedAt: now });                       // Terkirim
        await createNota('002', ['KIRIM'], { shippedAt: now });                         // Dikirim
        await createNota('003', ['SELESAI', 'SELESAI'], { shippedAt: now });            // Terkirim
        await createNota('004', ['SELESAI', 'KIRIM'], { shippedAt: now });              // Dikirim
        await createNota('005', ['KIRIM'], { shippedAt: now, returnedAt: now });        // retur → skip
        await createNota('006', ['SELESAI'], { shippedAt: past });                      // luar periode → skip
    }, 60000);

    afterAll(async () => {
        await sweep();
        await prisma.$disconnect();
    }, 60000);

    it('menghitung Dikirim=2, Terkirim=2, total shipped=4 untuk CS Faisal', async () => {
        const ctx: any = { branchId: null }; // Semua Cabang → tanpa filter cabang
        const params: any = {
            period: 'custom',
            start: ymd(daysFromNow(-2)),
            end: ymd(daysFromNow(1)),
        };

        const report: any = await service.report(ctx, params);
        const row = report.leaderboard.find((r: any) => r.userId === faisalId);

        expect(row).toBeDefined();
        expect(row.notasInTransit).toBe(2);  // Sedang Dikirim: INV-002, INV-004
        expect(row.notasDelivered).toBe(2);  // Sudah Terkirim: INV-001, INV-003
        expect(row.notasShipped).toBe(4);    // total = Dikirim + Terkirim

        // Jumlah PCS yang dikirim (per job/item, basis tanggal shippedAt, retur & luar
        // periode dikecualikan). Beda dari hitungan NOTA: INV-004 (SELESAI+KIRIM) menyumbang
        // 1 pcs ke Terkirim & 1 pcs ke Dikirim walau notanya masuk kategori "Dikirim".
        //   Terkirim (SELESAI): INV-001(1) + INV-003(2) + INV-004 job SELESAI(1) = 4
        //   Dikirim  (KIRIM)  : INV-002(1) + INV-004 job KIRIM(1)                = 2
        expect(row.pcsDelivered).toBe(4);
        expect(row.pcsInTransit).toBe(2);
        expect(row.pcsShipped).toBe(6);      // total = Dikirim + Terkirim
    }, 60000);
});
