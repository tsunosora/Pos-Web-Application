import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Cron jobs CRM. Pakai @nestjs/schedule yang sudah di-register di app.module.
 *
 * REPEAT_ORDER weekly Senin 08:00:
 *   Query customer dengan last transaction antara 90-180 hari lalu,
 *   tidak punya pending REPEAT_ORDER FU, lalu create FU baru
 *   assigned ke customer.assignedCsId.
 */
@Injectable()
export class FollowUpsCron {
    private readonly logger = new Logger('FollowUpsCron');

    constructor(private readonly prisma: PrismaService) {}

    @Cron(CronExpression.EVERY_WEEK, { name: 'crm-repeat-order-weekly' })
    async scheduleRepeatOrders() {
        const now = new Date();
        const ninetyDaysAgo = new Date(now);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const oneEightyDaysAgo = new Date(now);
        oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);

        try {
            // Cari customer dengan transaksi terakhir antara 90-180 hari lalu
            const candidates: any[] = await this.prisma.$queryRawUnsafe(`
                SELECT
                    c.id,
                    c.name,
                    c.assigned_cs_id AS assignedCsId,
                    MAX(t.created_at) AS lastTxAt,
                    t.branch_id AS branchId
                FROM customers c
                JOIN transactions t ON t.customer_id = c.id
                GROUP BY c.id, c.name, c.assigned_cs_id, t.branch_id
                HAVING MAX(t.created_at) BETWEEN ? AND ?
            `, oneEightyDaysAgo, ninetyDaysAgo);

            if (candidates.length === 0) {
                this.logger.log('No repeat-order candidates this week');
                return;
            }

            const customerIds = candidates.map((c: any) => c.id);
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
                if (skipSet.has(c.id)) continue;
                await (this.prisma as any).followUp.create({
                    data: {
                        type: 'REPEAT_ORDER',
                        status: 'PENDING',
                        dueDate,
                        customerId: c.id,
                        branchId: c.branchId ?? null,
                        assignedToId: c.assignedCsId ?? null,
                        notes: `Customer terakhir order ${new Date(c.lastTxAt).toLocaleDateString('id-ID')}. Hubungi untuk nudge repeat order.`,
                        sourceRef: `cron-repeat:${c.id}:${now.toISOString().slice(0, 10)}`,
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
