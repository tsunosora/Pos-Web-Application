import { PrismaService } from '../../prisma/prisma.service';
import { KpiService } from './kpi.service';

/**
 * Integration test (MENULIS KE DB SUNGGUHAN) untuk BUG: item AREA_BASED dengan
 * pcs > 1 (mis. banner 9 kopi) yang dikirim hanya terhitung 1 pcs, bukan 9.
 *
 * Data nyata banner disimpan sebagai TransactionItem { quantity: 1, pcs: N }.
 * Jumlah fisik yang dikirim = quantity × pcs. Kode kirim di kpi.service semula
 * hanya membaca `quantity` (=1) → salah hitung.
 *
 * Guard sama dgn spec kirim lain: hanya jalan bila DB lokal / ALLOW_DB_ITEST=1.
 */

const DB_URL = process.env.DATABASE_URL || '';
const CAN_RUN =
    /localhost|127\.0\.0\.1/.test(DB_URL) || process.env.ALLOW_DB_ITEST === '1';

const RUN = Date.now();
const JOB_PREFIX = 'ITEST-PCS-JOB-';
const INV_PREFIX = 'ITEST-PCS-KIRIM-';
const LEAD_PREFIX = 'ITEST-PCS-LEAD-';
const EMAIL_PREFIX = 'faisal.pcs.itest.';

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

const d = CAN_RUN ? describe : describe.skip;

d('KpiService — jumlah PCS dikirim untuk item AREA_BASED (quantity × pcs)', () => {
    const prisma = new PrismaService();
    const service = new KpiService(prisma, {} as any, {} as any, { waCsMetricsByUser: async () => new Map() } as any);
    let faisalId = 0;

    async function sweep() {
        await prisma.productionJob.deleteMany({ where: { jobNumber: { startsWith: JOB_PREFIX } } });
        await prisma.transaction.deleteMany({ where: { invoiceNumber: { startsWith: INV_PREFIX } } });
        await (prisma as any).lead.deleteMany({ where: { name: { startsWith: LEAD_PREFIX } } });
        await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
    }

    // Bikin nota + lead (attribusi ke Faisal) + 1 job utk 1 item dgn quantity/pcs tertentu.
    async function createNota(
        n: string,
        stage: string,
        item: { quantity: number; pcs: number },
    ) {
        const tx = await prisma.transaction.create({
            data: {
                invoiceNumber: inv(n),
                totalAmount: 100000,
                tax: 0,
                grandTotal: 100000,
                paymentMethod: 'CASH',
                customerName: `ITEST-PCS ${n}`,
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
        const ti = await prisma.transactionItem.create({
            data: { transactionId: tx.id, quantity: item.quantity, pcs: item.pcs, priceAtTime: 100000 } as any,
        });
        await prisma.productionJob.create({
            data: {
                jobNumber: jobNo(n),
                transactionId: tx.id,
                transactionItemId: ti.id,
                pipelineStage: stage,
                shippedAt: new Date(),
            } as any,
        });
    }

    beforeAll(async () => {
        await prisma.$connect();
        await sweep();

        const faisal = await prisma.user.create({
            data: { name: 'Faisal PCS', email: `${EMAIL_PREFIX}${RUN}@test.local`, passwordHash: 'x' } as any,
        });
        faisalId = faisal.id;

        // Banner 9 kopi: quantity=1, pcs=9, masih di KIRIM → 9 pcs "sedang dikirim".
        await createNota('AREA', 'KIRIM', { quantity: 1, pcs: 9 });
        // Kaos 4 pcs: quantity=4, pcs=1, sudah SELESAI → 4 pcs "terkirim" (regresi UNIT).
        await createNota('UNIT', 'SELESAI', { quantity: 4, pcs: 1 });
    }, 60000);

    afterAll(async () => {
        await sweep();
        await prisma.$disconnect();
    }, 60000);

    it('menghitung pcs = quantity × pcs (banner 9 kopi = 9 pcs, bukan 1)', async () => {
        const ctx: any = { branchId: null };
        const params: any = { period: 'custom', start: ymd(daysFromNow(-2)), end: ymd(daysFromNow(1)) };

        const report: any = await service.report(ctx, params);
        const row = report.leaderboard.find((r: any) => r.userId === faisalId);

        expect(row).toBeDefined();
        expect(row.pcsInTransit).toBe(9);   // banner: 1 × 9 kopi
        expect(row.pcsDelivered).toBe(4);   // kaos: 4 × 1
        expect(row.pcsShipped).toBe(13);    // total
    }, 60000);
});
