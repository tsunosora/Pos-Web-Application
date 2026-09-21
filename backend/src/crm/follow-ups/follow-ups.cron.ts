import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Cron jobs CRM. Pakai @nestjs/schedule yang sudah di-register di app.module.
 *
 * REPEAT_ORDER mingguan, Senin 08:00 WIB:
 *   Customer yang order TERAKHIR-nya jatuh 90–97 hari lalu (irisan satu minggu,
 *   jadi tiap customer paling banyak sekali dijadwalkan per jeda order) dan belum
 *   punya FU REPEAT_ORDER PENDING → dibuatkan FU baru untuk customer.assignedCsId.
 *
 * NONAKTIF kecuali env CRM_REPEAT_ORDER_AUTO=on. FU ikut dihitung di kepatuhan FU
 * (KPI CS), jadi menyalakannya = keputusan owner, bukan efek samping deploy.
 * (Sampai 22 Sep 2026 query-nya selalu gagal — transaksi tidak punya customer_id —
 * sehingga fitur ini belum pernah benar-benar berjalan.)
 */
@Injectable()
export class FollowUpsCron {
    private readonly logger = new Logger('FollowUpsCron');

    constructor(private readonly prisma: PrismaService) {}

    @Cron('0 8 * * 1', { name: 'crm-repeat-order-weekly', timeZone: 'Asia/Jakarta' })
    async scheduleRepeatOrders() {
        if (process.env.CRM_REPEAT_ORDER_AUTO !== 'on') {
            this.logger.log('REPEAT_ORDER otomatis dilewati (CRM_REPEAT_ORDER_AUTO belum "on")');
            return;
        }
        const now = new Date();
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const ninetySevenDaysAgo = new Date(now);
        ninetySevenDaysAgo.setDate(ninetySevenDaysAgo.getDate() - 97);

        try {
            // Transaksi tidak punya customer_id — customer dikenali dari No. HP
            // (customers.phone tersimpan 62xxx; nota bisa 62xxx atau 08xxx).
            // Cabang = cabang nota terakhirnya.
            const candidates: any[] = await this.prisma.$queryRawUnsafe(`
                SELECT
                    c.id,
                    c.name,
                    c.assigned_cs_id AS assignedCsId,
                    MAX(t.created_at) AS lastTxAt,
                    SUBSTRING_INDEX(GROUP_CONCAT(t.branch_id ORDER BY t.created_at DESC), ',', 1) AS branchId
                FROM customers c
                JOIN transactions t
                  ON t.status IN ('PAID', 'PARTIAL')
                 AND t.customer_phone IN (c.phone, CONCAT('0', SUBSTRING(c.phone, 3)))
                WHERE c.phone LIKE '62%'
                GROUP BY c.id, c.name, c.assigned_cs_id
                HAVING MAX(t.created_at) >= ? AND MAX(t.created_at) < ?
            `, ninetySevenDaysAgo, ninetyDaysAgo);

            if (candidates.length === 0) {
                this.logger.log('No repeat-order candidates this week');
                return;
            }

            const customerIds = candidates.map((c: any) => Number(c.id));
            // Cek sudah ada pending REPEAT_ORDER FU untuk customer ini?
            const existing: any[] = await (this.prisma as any).followUp.findMany({
                where: {
                    customerId: { in: customerIds },
                    type: 'REPEAT_ORDER',
                    status: 'PENDING',
                },
                select: { customerId: true },
            });
            const skipSet = new Set(existing.map((f: any) => f.customerId));

            const dueDate = new Date();
            dueDate.setDate(dueDate.getDate() + 1);
            dueDate.setHours(9, 0, 0, 0);

            let created = 0;
            for (const c of candidates) {
                const customerId = Number(c.id);
                if (skipSet.has(customerId)) continue;
                const branchId = c.branchId != null && c.branchId !== '' ? Number(c.branchId) : null;
                await (this.prisma as any).followUp.create({
                    data: {
                        type: 'REPEAT_ORDER',
                        status: 'PENDING',
                        dueDate,
                        customerId,
                        branchId: Number.isFinite(branchId) ? branchId : null,
                        assignedToId: c.assignedCsId != null ? Number(c.assignedCsId) : null,
                        notes: `Customer terakhir order ${new Date(c.lastTxAt).toLocaleDateString('id-ID')}. Hubungi untuk nudge repeat order.`,
                        sourceRef: `cron-repeat:${customerId}:${now.toISOString().slice(0, 10)}`,
                    },
                });
                created++;
            }
            this.logger.log(`Created ${created} REPEAT_ORDER FUs (${candidates.length} candidates, ${skipSet.size} already had pending)`);
        } catch (err) {
            this.logger.error('Failed to schedule repeat orders', err as Error);
        }
    }
}
