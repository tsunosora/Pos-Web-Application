import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';

/**
 * Branch Inbox Service
 *
 * Menangani "titip cetak" yang masuk ke cabang penerima.
 * Sumber data: Transaction dengan `productionBranchId = cabang penerima`
 * DAN `branchId != cabang penerima` (bukan transaksi sendiri).
 *
 * handoverStatus: BARU → DIPROSES → SIAP_AMBIL → DISERAHKAN
 *
 * CATATAN: karena Prisma client di Windows sering EPERM saat regenerate,
 * field `handoverStatus` tidak dimasukkan ke `where`/`data` Prisma. Kita:
 * - Baca handoverStatus dari raw query supaya bisa filter status
 * - Update handoverStatus pakai $executeRaw
 */
@Injectable()
export class BranchInboxService {
    constructor(private prisma: PrismaService) { }

    private resolveBranchId(ctx: BranchContext): number {
        if (ctx.branchId == null) {
            throw new ForbiddenException(
                'Mode "Semua Cabang" tidak didukung untuk inbox. Pilih cabang dulu di topbar.',
            );
        }
        return ctx.branchId;
    }

    /**
     * Query raw untuk baca handoverStatus map {id -> status}.
     * Dipakai untuk enrich hasil Prisma findMany.
     */
    private async loadHandoverMap(txIds: number[]): Promise<Map<number, any>> {
        if (txIds.length === 0) return new Map();
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id, handover_status, handover_ack_at, handover_ready_at, handover_done_at
             FROM transactions WHERE id IN (${txIds.join(',')})`,
        );
        const map = new Map<number, any>();
        for (const r of rows) {
            map.set(Number(r.id), {
                handoverStatus: r.handover_status ?? 'BARU',
                handoverAckAt: r.handover_ack_at,
                handoverReadyAt: r.handover_ready_at,
                handoverDoneAt: r.handover_done_at,
            });
        }
        return map;
    }

    async list(ctx: BranchContext, status?: string) {
        const branchId = this.resolveBranchId(ctx);

        const transactions = await (this.prisma as any).transaction.findMany({
            where: {
                productionBranchId: branchId,
                branchId: { not: branchId },
            },
            orderBy: [{ createdAt: 'desc' }],
            include: {
                branch: { select: { id: true, name: true, code: true } },
                productionBranch: { select: { id: true, name: true, code: true } },
                items: {
                    include: {
                        productVariant: {
                            include: {
                                product: { select: { id: true, name: true, pricingMode: true, requiresProduction: true } },
                            },
                        },
                        productionJob: { select: { id: true, jobNumber: true, status: true } },
                        printJob: { select: { id: true, jobNumber: true, status: true } },
                    },
                },
            },
        });

        const handoverMap = await this.loadHandoverMap(transactions.map((t: any) => t.id));

        let result = transactions.map((tx: any) => {
            const h = handoverMap.get(tx.id) ?? { handoverStatus: 'BARU', handoverAckAt: null, handoverReadyAt: null, handoverDoneAt: null };
            return {
                id: tx.id,
                invoiceNumber: tx.invoiceNumber,
                customerName: tx.customerName,
                customerPhone: tx.customerPhone,
                grandTotal: Number(tx.grandTotal),
                productionPriority: tx.productionPriority,
                productionDeadline: tx.productionDeadline,
                productionNotes: tx.productionNotes,
                handoverStatus: h.handoverStatus,
                handoverAckAt: h.handoverAckAt,
                handoverReadyAt: h.handoverReadyAt,
                handoverDoneAt: h.handoverDoneAt,
                sourceBranch: tx.branch,
                createdAt: tx.createdAt,
                itemCount: tx.items.length,
                items: tx.items.map((it: any) => ({
                    id: it.id,
                    productName: it.productVariant?.product?.name,
                    variantName: it.productVariant?.variantName,
                    pricingMode: it.productVariant?.product?.pricingMode,
                    requiresProduction: it.productVariant?.product?.requiresProduction,
                    quantity: it.quantity,
                    widthCm: it.widthCm ? Number(it.widthCm) : null,
                    heightCm: it.heightCm ? Number(it.heightCm) : null,
                    pcs: it.pcs,
                    note: it.note,
                    productionJob: it.productionJob,
                    printJob: it.printJob,
                })),
            };
        });

        if (status && status !== 'ALL') {
            result = result.filter((r: any) => r.handoverStatus === status);
        }

        return result;
    }

    async getDetail(ctx: BranchContext, id: number) {
        const branchId = this.resolveBranchId(ctx);
        const tx = await (this.prisma as any).transaction.findFirst({
            where: {
                id,
                productionBranchId: branchId,
                branchId: { not: branchId },
            },
            include: {
                branch: { select: { id: true, name: true, code: true, address: true, phone: true } },
                productionBranch: { select: { id: true, name: true, code: true } },
                items: {
                    include: {
                        productVariant: {
                            include: {
                                product: { select: { id: true, name: true, pricingMode: true, requiresProduction: true } },
                            },
                        },
                        productionJob: true,
                        printJob: true,
                    },
                },
            },
        });
        if (!tx) throw new NotFoundException('Titipan tidak ditemukan di inbox cabang ini');

        const map = await this.loadHandoverMap([tx.id]);
        const h = map.get(tx.id) ?? { handoverStatus: 'BARU', handoverAckAt: null, handoverReadyAt: null, handoverDoneAt: null };
        return { ...tx, ...h };
    }

    async unreadCount(ctx: BranchContext): Promise<{ count: number; latest: any[] }> {
        const branchId = this.resolveBranchId(ctx);
        // Ambil semua kandidat (dengan productionBranchId = cabang aktif & beda branch),
        // lalu filter status BARU via raw map.
        const candidates = await (this.prisma as any).transaction.findMany({
            where: {
                productionBranchId: branchId,
                branchId: { not: branchId },
            },
            orderBy: [{ createdAt: 'desc' }],
            take: 50,
            include: {
                branch: { select: { id: true, name: true, code: true } },
                items: {
                    select: {
                        quantity: true,
                        productVariant: {
                            select: {
                                product: { select: { name: true, pricingMode: true } },
                            },
                        },
                    },
                },
            },
        });

        const map = await this.loadHandoverMap(candidates.map((t: any) => t.id));
        const unread = candidates.filter((t: any) => (map.get(t.id)?.handoverStatus ?? 'BARU') === 'BARU');
        const latest = unread.slice(0, 5);
        return { count: unread.length, latest };
    }

    async acknowledge(ctx: BranchContext, id: number) {
        const branchId = this.resolveBranchId(ctx);
        const tx = await (this.prisma as any).transaction.findFirst({
            where: { id, productionBranchId: branchId, branchId: { not: branchId } },
            select: { id: true },
        });
        if (!tx) throw new NotFoundException('Titipan tidak ditemukan');

        const safeId = Number(id);
        const affected = await this.prisma.$executeRawUnsafe(
            `UPDATE transactions SET handover_status = 'DIPROSES', handover_ack_at = NOW()
             WHERE id = ${safeId} AND (handover_status IS NULL OR handover_status = 'BARU')`,
        );
        // Kalau tidak ada baris ter-update, paksa update tanpa kondisi (mungkin status sudah lain — biar idempotent)
        if (!affected) {
            await this.prisma.$executeRawUnsafe(
                `UPDATE transactions SET handover_status = 'DIPROSES',
                  handover_ack_at = COALESCE(handover_ack_at, NOW())
                 WHERE id = ${safeId} AND handover_status NOT IN ('SIAP_AMBIL','DISERAHKAN')`,
            );
        }
        return { ok: true };
    }

    async markReady(ctx: BranchContext, id: number) {
        const branchId = this.resolveBranchId(ctx);
        const tx = await (this.prisma as any).transaction.findFirst({
            where: { id, productionBranchId: branchId, branchId: { not: branchId } },
            select: { id: true },
        });
        if (!tx) throw new NotFoundException('Titipan tidak ditemukan');

        const safeId = Number(id);
        await this.prisma.$executeRawUnsafe(
            `UPDATE transactions
             SET handover_status = 'SIAP_AMBIL',
                 handover_ready_at = NOW(),
                 handover_ack_at = COALESCE(handover_ack_at, NOW())
             WHERE id = ${safeId}`,
        );
        return { ok: true };
    }

    /**
     * Diagnostik: cek routing job untuk titipan terbaru di cabang aktif.
     * Tidak butuh akses MySQL — hasil JSON bisa langsung dibaca dari browser.
     */
    async debugRouting(ctx: BranchContext) {
        const branchId = this.resolveBranchId(ctx);
        const titipan: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id, invoice_number, branch_id AS tx_branch, production_branch_id, handover_status, created_at
             FROM transactions
             WHERE production_branch_id = ?
             ORDER BY id DESC LIMIT 10`,
            branchId,
        );
        const txIds = titipan.map(t => Number(t.id));
        const prodJobs: any[] = txIds.length
            ? await this.prisma.$queryRawUnsafe(
                `SELECT job_number, branch_id AS job_branch, transaction_id, status
                 FROM production_jobs WHERE transaction_id IN (${txIds.join(',')})`,
            )
            : [];
        const printJobs: any[] = txIds.length
            ? await this.prisma.$queryRawUnsafe(
                `SELECT job_number, branch_id AS job_branch, transaction_id, status
                 FROM print_jobs WHERE transaction_id IN (${txIds.join(',')})`,
            )
            : [];
        const products: any[] = txIds.length
            ? await this.prisma.$queryRawUnsafe(
                `SELECT ti.transaction_id, p.name, p.pricing_mode, p.requires_production
                 FROM transaction_items ti
                 JOIN product_variants pv ON pv.id = ti.product_variant_id
                 JOIN products p ON p.id = pv.product_id
                 WHERE ti.transaction_id IN (${txIds.join(',')})`,
            )
            : [];

        return {
            activeBranchId: branchId,
            titipan: titipan.map(t => ({
                id: Number(t.id),
                invoice: t.invoice_number,
                txBranch: Number(t.tx_branch),
                productionBranch: t.production_branch_id != null ? Number(t.production_branch_id) : null,
                handoverStatus: t.handover_status,
                createdAt: t.created_at,
                items: products.filter(p => Number(p.transaction_id) === Number(t.id)).map(p => ({
                    name: p.name,
                    pricingMode: p.pricing_mode,
                    requiresProduction: !!p.requires_production,
                })),
                productionJobs: prodJobs.filter(j => Number(j.transaction_id) === Number(t.id)).map(j => ({
                    jobNumber: j.job_number,
                    jobBranch: j.job_branch != null ? Number(j.job_branch) : null,
                    status: j.status,
                })),
                printJobs: printJobs.filter(j => Number(j.transaction_id) === Number(t.id)).map(j => ({
                    jobNumber: j.job_number,
                    jobBranch: j.job_branch != null ? Number(j.job_branch) : null,
                    status: j.status,
                })),
            })),
            legend: {
                GOOD: 'jobBranch === activeBranchId → routing benar, job akan muncul di cabang tujuan',
                BAD: 'jobBranch === txBranch → routing salah (data dibuat sebelum fitur aktif)',
                NO_JOB: 'items array terisi tapi productionJobs & printJobs kosong → produk tidak bikin antrian (UNIT biasa tanpa clickRate)',
            },
        };
    }

    /**
     * Outbox "siap ambil": transaksi dari cabang aktif yang dititipkan ke cabang lain
     * dan sudah ditandai SIAP_AMBIL oleh cabang pelaksana. Dipakai untuk popup
     * notifikasi di cabang pemesan: "Cetakan sudah jadi, siap diambil".
     */
    async readyOutbox(ctx: BranchContext): Promise<{ count: number; latest: any[] }> {
        const branchId = this.resolveBranchId(ctx);
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id FROM transactions
             WHERE branch_id = ? AND production_branch_id IS NOT NULL
               AND production_branch_id <> branch_id
               AND handover_status = 'SIAP_AMBIL'
             ORDER BY handover_ready_at DESC LIMIT 20`,
            branchId,
        );
        const ids = rows.map((r: any) => Number(r.id));
        if (!ids.length) return { count: 0, latest: [] };

        const txs = await (this.prisma as any).transaction.findMany({
            where: { id: { in: ids } },
            include: {
                productionBranch: { select: { id: true, name: true, code: true } },
                items: {
                    select: {
                        quantity: true,
                        productVariant: {
                            select: {
                                product: { select: { name: true, pricingMode: true } },
                            },
                        },
                    },
                },
            },
        });
        const map = await this.loadHandoverMap(ids);
        const enriched = txs
            .map((t: any) => ({ ...t, ...(map.get(t.id) ?? {}) }))
            .sort((a: any, b: any) => {
                const ar = a.handoverReadyAt ? new Date(a.handoverReadyAt).getTime() : 0;
                const br = b.handoverReadyAt ? new Date(b.handoverReadyAt).getTime() : 0;
                return br - ar;
            });
        return { count: enriched.length, latest: enriched.slice(0, 5) };
    }

    /**
     * Outbox: titipan keluar dari cabang aktif (sudut pandang pemesan).
     * Menampilkan transaksi di mana branchId = cabang aktif dan productionBranchId != branchId.
     */
    async outbox(ctx: BranchContext, status?: string) {
        const branchId = this.resolveBranchId(ctx);
        const transactions = await (this.prisma as any).transaction.findMany({
            where: {
                branchId: branchId,
                productionBranchId: { not: null },
                NOT: { productionBranchId: branchId },
            },
            orderBy: [{ createdAt: 'desc' }],
            include: {
                branch: { select: { id: true, name: true, code: true } },
                productionBranch: { select: { id: true, name: true, code: true } },
                items: {
                    include: {
                        productVariant: {
                            include: {
                                product: { select: { id: true, name: true, pricingMode: true, requiresProduction: true } },
                            },
                        },
                    },
                },
            },
        });

        const handoverMap = await this.loadHandoverMap(transactions.map((t: any) => t.id));

        let result = transactions.map((tx: any) => {
            const h = handoverMap.get(tx.id) ?? { handoverStatus: 'BARU', handoverAckAt: null, handoverReadyAt: null, handoverDoneAt: null };
            return {
                id: tx.id,
                invoiceNumber: tx.invoiceNumber,
                customerName: tx.customerName,
                customerPhone: tx.customerPhone,
                grandTotal: Number(tx.grandTotal),
                productionPriority: tx.productionPriority,
                productionDeadline: tx.productionDeadline,
                productionNotes: tx.productionNotes,
                handoverStatus: h.handoverStatus,
                handoverAckAt: h.handoverAckAt,
                handoverReadyAt: h.handoverReadyAt,
                handoverDoneAt: h.handoverDoneAt,
                targetBranch: tx.productionBranch,
                createdAt: tx.createdAt,
                itemCount: tx.items.length,
                items: tx.items.map((it: any) => ({
                    id: it.id,
                    productName: it.productVariant?.product?.name,
                    variantName: it.productVariant?.variantName,
                    pricingMode: it.productVariant?.product?.pricingMode,
                    requiresProduction: it.productVariant?.product?.requiresProduction,
                    quantity: it.quantity,
                    widthCm: it.widthCm ? Number(it.widthCm) : null,
                    heightCm: it.heightCm ? Number(it.heightCm) : null,
                    pcs: it.pcs,
                    note: it.note,
                })),
            };
        });

        if (status && status !== 'ALL') {
            result = result.filter((r: any) => r.handoverStatus === status);
        }
        return result;
    }

    /**
     * Konfirmasi sudah diambil — dipanggil dari sisi pemesan (cabang asal transaksi).
     * Membolehkan cabang pemesan menutup siklus titipan tanpa harus pelaksana klik Diserahkan.
     */
    async confirmPickup(ctx: BranchContext, id: number) {
        const branchId = this.resolveBranchId(ctx);
        const tx = await (this.prisma as any).transaction.findFirst({
            where: { id, branchId, productionBranchId: { not: null }, NOT: { productionBranchId: branchId } },
            select: { id: true },
        });
        if (!tx) throw new NotFoundException('Titipan tidak ditemukan di outbox cabang ini');

        const safeId = Number(id);
        await this.prisma.$executeRawUnsafe(
            `UPDATE transactions
             SET handover_status = 'DISERAHKAN', handover_done_at = COALESCE(handover_done_at, NOW())
             WHERE id = ${safeId}`,
        );
        await this.createLedgerEntry(safeId);
        return { ok: true };
    }

    async markHandover(ctx: BranchContext, id: number) {
        const branchId = this.resolveBranchId(ctx);
        const tx = await (this.prisma as any).transaction.findFirst({
            where: { id, productionBranchId: branchId, branchId: { not: branchId } },
            select: { id: true },
        });
        if (!tx) throw new NotFoundException('Titipan tidak ditemukan');

        const safeId = Number(id);
        await this.prisma.$executeRawUnsafe(
            `UPDATE transactions
             SET handover_status = 'DISERAHKAN', handover_done_at = NOW()
             WHERE id = ${safeId}`,
        );
        await this.createLedgerEntry(safeId);
        return { ok: true };
    }

    /**
     * Auto-create InterBranchLedger entry saat titipan diserahkan.
     * Idempotent: kalau ledger untuk txId sudah ada, skip.
     *
     * Formula:
     *   costAmount = Σ (hppAtTime OR variant.hpp) × quantity
     *   serviceFee = costAmount × (BranchSettings(toBranch).titipanFeePercent / 100)
     *   totalAmount = costAmount + serviceFee
     *
     * Pakai $queryRawUnsafe / $executeRawUnsafe supaya tidak blocked oleh
     * Prisma stale client pada Windows (EPERM saat generate).
     */
    private async createLedgerEntry(txId: number): Promise<void> {
        try {
            // Cek existing ledger (idempotent)
            const existing: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT id FROM inter_branch_ledger WHERE transaction_id = ${txId} LIMIT 1`,
            );
            if (existing.length) return;

            // Load transaction header
            const txRows: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT id, branch_id, production_branch_id
                 FROM transactions WHERE id = ${txId} LIMIT 1`,
            );
            if (!txRows.length) return;
            const tx = txRows[0];
            const fromBranchId = tx.branch_id != null ? Number(tx.branch_id) : null;
            const toBranchId = tx.production_branch_id != null ? Number(tx.production_branch_id) : null;
            if (!fromBranchId || !toBranchId || fromBranchId === toBranchId) return;

            // Load items + HPP fallback from variant
            const items: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT ti.quantity, ti.hpp_at_time, pv.hpp AS variant_hpp
                 FROM transaction_items ti
                 JOIN product_variants pv ON pv.id = ti.product_variant_id
                 WHERE ti.transaction_id = ${txId}`,
            );

            let costAmount = 0;
            for (const it of items) {
                const qty = Number(it.quantity) || 0;
                const hppAt = Number(it.hpp_at_time) || 0;
                const variantHpp = Number(it.variant_hpp) || 0;
                const hpp = hppAt > 0 ? hppAt : variantHpp;
                costAmount += hpp * qty;
            }
            costAmount = Math.round(costAmount * 100) / 100;

            // Ambil titipanFeePercent cabang pelaksana (toBranch)
            const settingsRows: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT titipan_fee_percent FROM branch_settings WHERE branch_id = ${toBranchId} LIMIT 1`,
            );
            const feePercent = settingsRows.length && settingsRows[0].titipan_fee_percent != null
                ? Number(settingsRows[0].titipan_fee_percent)
                : 20;
            const serviceFee = Math.round((costAmount * feePercent) / 100 * 100) / 100;
            const totalAmount = Math.round((costAmount + serviceFee) * 100) / 100;

            await this.prisma.$executeRawUnsafe(
                `INSERT INTO inter_branch_ledger
                  (transaction_id, from_branch_id, to_branch_id, cost_amount, service_fee, total_amount, settled_amount, status, created_at, updated_at)
                 VALUES
                  (${txId}, ${fromBranchId}, ${toBranchId}, ${costAmount}, ${serviceFee}, ${totalAmount}, 0, 'PENDING', NOW(), NOW())`,
            );
        } catch (err) {
            // Jangan blokir handover kalau ledger gagal; cukup log.
            // eslint-disable-next-line no-console
            console.error('[createLedgerEntry] failed for tx', txId, err);
        }
    }
}
