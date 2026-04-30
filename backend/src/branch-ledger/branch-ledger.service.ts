import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';

export const INTER_BRANCH_SETTLEMENT_CATEGORY = 'INTER_BRANCH_SETTLEMENT';

/**
 * Branch Ledger Service — Buku Titipan Antar Cabang (read-only untuk PR A).
 *
 * Sumber data: tabel `inter_branch_ledger` (+ `ledger_settlements`).
 * Auto-create dilakukan di BranchInboxService.createLedgerEntry saat handover.
 *
 * Scoping:
 * - Staff: hanya bisa melihat ledger yang melibatkan cabangnya (outgoing OR incoming).
 * - Owner/SuperAdmin: bisa lihat semua kalau mode "Semua Cabang", atau filter ke
 *   cabang yang dipilih di topbar.
 *
 * Role filter (query):
 * - `role=outgoing` — hutang saya (fromBranch = ctx.branchId)
 * - `role=incoming` — piutang saya (toBranch = ctx.branchId)
 * - `role=all` / undefined — dua-duanya (fromBranch OR toBranch)
 */
@Injectable()
export class BranchLedgerService {
    constructor(private prisma: PrismaService) { }

    private ensureBranch(ctx: BranchContext): number | null {
        // Owner boleh null (semua cabang). Staff pasti punya branchId.
        return ctx.branchId;
    }

    /** WHERE clause SQL sesuai role + ctx. */
    private buildWhere(ctx: BranchContext, role?: string): string {
        const branchId = this.ensureBranch(ctx);
        const r = (role || 'all').toLowerCase();

        if (branchId == null) {
            // Mode semua cabang (owner) — tidak ada filter branch.
            return '1=1';
        }
        if (r === 'outgoing') return `l.from_branch_id = ${branchId}`;
        if (r === 'incoming') return `l.to_branch_id = ${branchId}`;
        return `(l.from_branch_id = ${branchId} OR l.to_branch_id = ${branchId})`;
    }

    async list(ctx: BranchContext, role?: string, status?: string) {
        const where = this.buildWhere(ctx, role);
        const statusFilter = status && status !== 'ALL' ? `AND l.status = '${status.replace(/[^A-Z_]/g, '')}'` : '';
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT l.id, l.transaction_id, l.from_branch_id, l.to_branch_id,
                    l.cost_amount, l.service_fee, l.total_amount, l.settled_amount,
                    l.status, l.notes, l.created_at, l.updated_at,
                    fb.name AS from_branch_name, fb.code AS from_branch_code,
                    tb.name AS to_branch_name, tb.code AS to_branch_code,
                    t.invoice_number, t.customer_name, t.grand_total, t.handover_status
             FROM inter_branch_ledger l
             JOIN company_branches fb ON fb.id = l.from_branch_id
             JOIN company_branches tb ON tb.id = l.to_branch_id
             JOIN transactions t ON t.id = l.transaction_id
             WHERE ${where} ${statusFilter}
             ORDER BY l.created_at DESC
             LIMIT 500`,
        );
        return rows.map(r => this.mapLedger(r));
    }

    async summary(ctx: BranchContext) {
        const branchId = this.ensureBranch(ctx);
        if (branchId == null) {
            // Owner semua cabang: summary per pasangan
            const rows: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT l.from_branch_id, l.to_branch_id,
                        fb.name AS from_name, fb.code AS from_code,
                        tb.name AS to_name, tb.code AS to_code,
                        COUNT(*) AS total_count,
                        SUM(CASE WHEN l.status IN ('PENDING','PARTIAL') THEN l.total_amount - l.settled_amount ELSE 0 END) AS outstanding,
                        SUM(l.total_amount) AS gross_total
                 FROM inter_branch_ledger l
                 JOIN company_branches fb ON fb.id = l.from_branch_id
                 JOIN company_branches tb ON tb.id = l.to_branch_id
                 GROUP BY l.from_branch_id, l.to_branch_id, fb.name, fb.code, tb.name, tb.code
                 ORDER BY outstanding DESC`,
            );
            return {
                mode: 'all',
                pairs: rows.map(r => ({
                    fromBranchId: Number(r.from_branch_id),
                    fromBranchName: r.from_name,
                    fromBranchCode: r.from_code,
                    toBranchId: Number(r.to_branch_id),
                    toBranchName: r.to_name,
                    toBranchCode: r.to_code,
                    totalCount: Number(r.total_count),
                    outstanding: Number(r.outstanding ?? 0),
                    grossTotal: Number(r.gross_total ?? 0),
                })),
            };
        }

        // Per cabang aktif
        const outgoing: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT
                COUNT(*) AS cnt,
                COALESCE(SUM(CASE WHEN status IN ('PENDING','PARTIAL') THEN total_amount - settled_amount ELSE 0 END), 0) AS outstanding,
                COALESCE(SUM(total_amount), 0) AS total
             FROM inter_branch_ledger WHERE from_branch_id = ${branchId}`,
        );
        const incoming: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT
                COUNT(*) AS cnt,
                COALESCE(SUM(CASE WHEN status IN ('PENDING','PARTIAL') THEN total_amount - settled_amount ELSE 0 END), 0) AS outstanding,
                COALESCE(SUM(total_amount), 0) AS total
             FROM inter_branch_ledger WHERE to_branch_id = ${branchId}`,
        );
        const o = outgoing[0] ?? {};
        const i = incoming[0] ?? {};
        return {
            mode: 'single',
            branchId,
            outgoing: {
                count: Number(o.cnt ?? 0),
                outstanding: Number(o.outstanding ?? 0),
                total: Number(o.total ?? 0),
            },
            incoming: {
                count: Number(i.cnt ?? 0),
                outstanding: Number(i.outstanding ?? 0),
                total: Number(i.total ?? 0),
            },
            netPosition: Number(i.outstanding ?? 0) - Number(o.outstanding ?? 0),
        };
    }

    async detail(ctx: BranchContext, id: number) {
        const safeId = Number(id);
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT l.*,
                    fb.name AS from_branch_name, fb.code AS from_branch_code,
                    tb.name AS to_branch_name, tb.code AS to_branch_code,
                    t.invoice_number, t.customer_name, t.customer_phone,
                    t.grand_total, t.handover_status, t.created_at AS tx_created_at
             FROM inter_branch_ledger l
             JOIN company_branches fb ON fb.id = l.from_branch_id
             JOIN company_branches tb ON tb.id = l.to_branch_id
             JOIN transactions t ON t.id = l.transaction_id
             WHERE l.id = ${safeId} LIMIT 1`,
        );
        if (!rows.length) throw new NotFoundException('Ledger tidak ditemukan');
        const row = rows[0];

        // Authorization: staff hanya boleh lihat kalau salah satu branch = cabangnya
        if (!ctx.isOwner && ctx.branchId != null) {
            const from = Number(row.from_branch_id);
            const to = Number(row.to_branch_id);
            if (from !== ctx.branchId && to !== ctx.branchId) {
                throw new ForbiddenException('Ledger ini bukan untuk cabang Anda');
            }
        }

        const items: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT ti.id, ti.quantity, ti.hpp_at_time, ti.note,
                    ti.width_cm, ti.height_cm, ti.pcs,
                    pv.hpp AS variant_hpp, pv.variant_name, pv.sku,
                    p.name AS product_name, p.pricing_mode
             FROM transaction_items ti
             JOIN product_variants pv ON pv.id = ti.product_variant_id
             JOIN products p ON p.id = pv.product_id
             WHERE ti.transaction_id = ${Number(row.transaction_id)}`,
        );

        const settlements: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT * FROM ledger_settlements WHERE ledger_id = ${safeId} ORDER BY created_at DESC`,
        );

        return {
            ...this.mapLedger(row),
            items: items.map(it => ({
                id: Number(it.id),
                productName: it.product_name,
                variantName: it.variant_name,
                sku: it.sku,
                pricingMode: it.pricing_mode,
                quantity: Number(it.quantity),
                hppAtTime: Number(it.hpp_at_time ?? 0),
                variantHpp: Number(it.variant_hpp ?? 0),
                effectiveHpp: Number(it.hpp_at_time) > 0 ? Number(it.hpp_at_time) : Number(it.variant_hpp ?? 0),
                widthCm: it.width_cm != null ? Number(it.width_cm) : null,
                heightCm: it.height_cm != null ? Number(it.height_cm) : null,
                pcs: it.pcs != null ? Number(it.pcs) : null,
                note: it.note,
            })),
            settlements: settlements.map(s => ({
                id: Number(s.id),
                settlementType: s.settlement_type,
                amount: Number(s.amount),
                cashflowPayerId: s.cashflow_payer_id != null ? Number(s.cashflow_payer_id) : null,
                cashflowPayeeId: s.cashflow_payee_id != null ? Number(s.cashflow_payee_id) : null,
                stockMovementOutId: s.stock_movement_out_id != null ? Number(s.stock_movement_out_id) : null,
                stockMovementInId: s.stock_movement_in_id != null ? Number(s.stock_movement_in_id) : null,
                notes: s.notes,
                createdAt: s.created_at,
            })),
        };
    }

    /**
     * Bank accounts untuk settlement form: return akun cabang pemesan (A) & pelaksana (B)
     * untuk ledger tertentu. Authorized untuk staff yang salah satu branch-nya terlibat.
     */
    async getLedgerBankAccounts(ctx: BranchContext, id: number) {
        const safeId = Number(id);
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id, from_branch_id, to_branch_id FROM inter_branch_ledger WHERE id = ${safeId} LIMIT 1`,
        );
        if (!rows.length) throw new NotFoundException('Ledger tidak ditemukan');
        const fromBranchId = Number(rows[0].from_branch_id);
        const toBranchId = Number(rows[0].to_branch_id);

        if (!ctx.isOwner && ctx.branchId !== fromBranchId && ctx.branchId !== toBranchId) {
            throw new ForbiddenException('Akses ledger tidak diizinkan');
        }

        const [accA, accB] = await Promise.all([
            this.prisma.bankAccount.findMany({
                where: { branchId: fromBranchId, isActive: true } as any,
                orderBy: { createdAt: 'asc' },
            }),
            this.prisma.bankAccount.findMany({
                where: { branchId: toBranchId, isActive: true } as any,
                orderBy: { createdAt: 'asc' },
            }),
        ]);
        return { fromBranchId, toBranchId, fromAccounts: accA, toAccounts: accB };
    }

    /**
     * Settlement tunai: cabang pemesan (fromBranch) bayar ke cabang pelaksana (toBranch).
     *
     * Efek samping:
     * - Buat Cashflow EXPENSE di fromBranch (kategori INTER_BRANCH_SETTLEMENT)
     * - Buat Cashflow INCOME di toBranch (kategori INTER_BRANCH_SETTLEMENT)
     * - Buat LedgerSettlement dengan referensi ke dua cashflow tsb
     * - Update ledger: settledAmount += amount, status PARTIAL/SETTLED
     *
     * Atomik via $transaction. Bank account validasi:
     * - bankAccountAId (opsional) wajib milik fromBranch
     * - bankAccountBId (opsional) wajib milik toBranch
     */
    async settleWithCash(
        ctx: BranchContext,
        id: number,
        payload: {
            amount: number;
            bankAccountAId?: number | null;
            bankAccountBId?: number | null;
            notes?: string | null;
        },
    ) {
        const safeId = Number(id);
        const amount = Number(payload.amount);
        if (!amount || amount <= 0) {
            throw new BadRequestException('Nominal pembayaran harus lebih dari 0');
        }

        // Load ledger
        const ledgerRows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id, from_branch_id, to_branch_id, total_amount, settled_amount, status
             FROM inter_branch_ledger WHERE id = ${safeId} LIMIT 1`,
        );
        if (!ledgerRows.length) throw new NotFoundException('Ledger tidak ditemukan');
        const ledger = ledgerRows[0];
        const fromBranchId = Number(ledger.from_branch_id);
        const toBranchId = Number(ledger.to_branch_id);
        const outstanding = Number(ledger.total_amount) - Number(ledger.settled_amount);

        if (ledger.status === 'SETTLED') throw new BadRequestException('Ledger sudah lunas');
        if (ledger.status === 'CANCELLED') throw new BadRequestException('Ledger sudah dibatalkan');
        if (amount > outstanding + 0.01) {
            throw new BadRequestException(
                `Nominal (${amount}) melebihi sisa hutang (${outstanding})`,
            );
        }

        // Authorization: Owner bebas. Staff hanya boleh kalau branchId = fromBranch atau toBranch.
        if (!ctx.isOwner) {
            if (ctx.branchId !== fromBranchId && ctx.branchId !== toBranchId) {
                throw new ForbiddenException('Anda tidak punya akses untuk melunasi ledger ini');
            }
        }

        // Validasi bank account
        if (payload.bankAccountAId) {
            const ba = await this.prisma.bankAccount.findUnique({ where: { id: Number(payload.bankAccountAId) } });
            if (!ba) throw new BadRequestException('Rekening pembayar tidak ditemukan');
            if ((ba as any).branchId !== fromBranchId) {
                throw new BadRequestException('Rekening pembayar bukan milik cabang pemesan');
            }
        }
        if (payload.bankAccountBId) {
            const ba = await this.prisma.bankAccount.findUnique({ where: { id: Number(payload.bankAccountBId) } });
            if (!ba) throw new BadRequestException('Rekening penerima tidak ditemukan');
            if ((ba as any).branchId !== toBranchId) {
                throw new BadRequestException('Rekening penerima bukan milik cabang pelaksana');
            }
        }

        const note = payload.notes ?? null;
        const newSettled = Number(ledger.settled_amount) + amount;
        const totalAmount = Number(ledger.total_amount);
        const fullyPaid = newSettled + 0.01 >= totalAmount;
        const newStatus = fullyPaid ? 'SETTLED' : 'PARTIAL';

        // Atomic transaction
        return this.prisma.$transaction(async (tx) => {
            // 1) Cashflow EXPENSE di cabang A (pemesan/fromBranch)
            const expenseCf = await (tx as any).cashflow.create({
                data: {
                    type: 'EXPENSE',
                    category: INTER_BRANCH_SETTLEMENT_CATEGORY,
                    amount,
                    note: `Bayar titipan cetak ke cabang #${toBranchId} (ledger #${safeId})${note ? ' — ' + note : ''}`,
                    branchId: fromBranchId,
                    ...(payload.bankAccountAId ? { bankAccountId: Number(payload.bankAccountAId) } : {}),
                },
            });

            // 2) Cashflow INCOME di cabang B (pelaksana/toBranch)
            const incomeCf = await (tx as any).cashflow.create({
                data: {
                    type: 'INCOME',
                    category: INTER_BRANCH_SETTLEMENT_CATEGORY,
                    amount,
                    note: `Terima bayaran titipan cetak dari cabang #${fromBranchId} (ledger #${safeId})${note ? ' — ' + note : ''}`,
                    branchId: toBranchId,
                    ...(payload.bankAccountBId ? { bankAccountId: Number(payload.bankAccountBId) } : {}),
                },
            });

            // 3) Insert LedgerSettlement (raw — model mungkin belum ada di Prisma client)
            await tx.$executeRawUnsafe(
                `INSERT INTO ledger_settlements
                  (ledger_id, settlement_type, amount, cashflow_payer_id, cashflow_payee_id, notes, created_by_id, created_at)
                 VALUES
                  (${safeId}, 'CASH', ${amount}, ${expenseCf.id}, ${incomeCf.id},
                   ${note ? `'${note.replace(/'/g, "''")}'` : 'NULL'},
                   ${ctx.userBranchId != null ? 'NULL' : 'NULL'},
                   NOW())`,
            );

            // 4) Update ledger
            await tx.$executeRawUnsafe(
                `UPDATE inter_branch_ledger
                 SET settled_amount = ${newSettled},
                     status = '${newStatus}',
                     updated_at = NOW()
                 WHERE id = ${safeId}`,
            );

            return { ok: true, settledAmount: newSettled, status: newStatus };
        });
    }

    /**
     * Settlement via kirim bahan: cabang pemesan (fromBranch) kirim stok ke cabang pelaksana (toBranch)
     * untuk mengganti hutang bahan. Nilai pembayaran = hpp × quantity.
     *
     * Efek:
     * - Decrement BranchStock(fromBranch, variantId)
     * - Upsert BranchStock(toBranch, variantId) +qty
     * - 2 StockMovement (OUT di fromBranch, IN di toBranch) dengan referenceId ledger
     * - LedgerSettlement type=STOCK
     * - Update ledger settledAmount + status
     */
    async settleWithStock(
        ctx: BranchContext,
        id: number,
        payload: {
            productVariantId: number;
            quantity: number;
            notes?: string | null;
        },
    ) {
        const safeId = Number(id);
        const variantId = Number(payload.productVariantId);
        const qty = Number(payload.quantity);
        if (!variantId) throw new BadRequestException('Varian bahan wajib dipilih');
        if (!qty || qty <= 0) throw new BadRequestException('Jumlah harus lebih dari 0');

        const ledgerRows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id, from_branch_id, to_branch_id, total_amount, settled_amount, status
             FROM inter_branch_ledger WHERE id = ${safeId} LIMIT 1`,
        );
        if (!ledgerRows.length) throw new NotFoundException('Ledger tidak ditemukan');
        const ledger = ledgerRows[0];
        const fromBranchId = Number(ledger.from_branch_id);
        const toBranchId = Number(ledger.to_branch_id);
        const outstanding = Number(ledger.total_amount) - Number(ledger.settled_amount);

        if (ledger.status === 'SETTLED') throw new BadRequestException('Ledger sudah lunas');
        if (ledger.status === 'CANCELLED') throw new BadRequestException('Ledger sudah dibatalkan');

        if (!ctx.isOwner && ctx.branchId !== fromBranchId && ctx.branchId !== toBranchId) {
            throw new ForbiddenException('Anda tidak punya akses untuk melunasi ledger ini');
        }

        // Load variant + HPP. Kalau variant.hpp = 0, fallback ke harga beli terakhir
        // dari StockPurchaseItem di cabang pemesan (auto-fallback supaya bahan baku
        // yang HPP varian belum di-set tetap bisa dipakai untuk settle).
        const variant = await this.prisma.productVariant.findUnique({
            where: { id: variantId },
            select: { id: true, sku: true, variantName: true, hpp: true, product: { select: { name: true } } },
        });
        if (!variant) throw new NotFoundException('Varian tidak ditemukan');
        let hpp = Number(variant.hpp) || 0;
        let hppSource: 'variant' | 'lastPurchase' = 'variant';
        if (hpp <= 0) {
            const purchaseRow: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT spi.unit_price
                 FROM stock_purchase_items spi
                 JOIN stock_purchases sp ON sp.id = spi.purchase_id
                 WHERE sp.branch_id = ${fromBranchId}
                   AND spi.product_variant_id = ${variantId}
                   AND spi.unit_price IS NOT NULL
                   AND spi.unit_price > 0
                 ORDER BY spi.id DESC
                 LIMIT 1`,
            );
            const lastPrice = Number(purchaseRow?.[0]?.unit_price ?? 0);
            if (lastPrice > 0) {
                hpp = lastPrice;
                hppSource = 'lastPurchase';
            }
        }
        if (hpp <= 0) {
            throw new BadRequestException(
                `Tidak bisa hitung nilai bahan ${variant.sku}: HPP varian belum di-set DAN tidak ada riwayat pembelian dengan harga di cabang pemesan. Set HPP di Inventori atau catat pembelian dulu.`,
            );
        }
        const value = Math.round(hpp * qty * 100) / 100;
        if (value > outstanding + 0.01) {
            throw new BadRequestException(
                `Nilai kirim bahan (${value}) melebihi sisa hutang (${outstanding}). Kurangi quantity.`,
            );
        }

        // Cek stok cabang asal
        const fromBs: any = await (this.prisma as any).branchStock.findUnique({
            where: { branchId_productVariantId: { branchId: fromBranchId, productVariantId: variantId } },
            select: { stock: true },
        });
        const fromStock = Number(fromBs?.stock ?? 0);
        if (fromStock < qty) {
            throw new BadRequestException(
                `Stok ${variant.sku} di cabang pemesan tidak cukup. Tersedia: ${fromStock}, dibutuhkan: ${qty}`,
            );
        }

        const note = payload.notes ?? null;
        const newSettled = Number(ledger.settled_amount) + value;
        const totalAmount = Number(ledger.total_amount);
        const fullyPaid = newSettled + 0.01 >= totalAmount;
        const newStatus = fullyPaid ? 'SETTLED' : 'PARTIAL';
        const refId = `LEDGER-${safeId}`;

        return this.prisma.$transaction(async (tx) => {
            // Kurangi stok cabang asal
            const updatedFrom = await (tx as any).branchStock.update({
                where: { branchId_productVariantId: { branchId: fromBranchId, productVariantId: variantId } },
                data: { stock: { decrement: qty } },
            });
            // Tambah stok cabang tujuan
            const updatedTo = await (tx as any).branchStock.upsert({
                where: { branchId_productVariantId: { branchId: toBranchId, productVariantId: variantId } },
                update: { stock: { increment: qty } },
                create: { branchId: toBranchId, productVariantId: variantId, stock: qty },
            });

            const outMv = await tx.stockMovement.create({
                data: {
                    productVariantId: variantId,
                    type: 'OUT',
                    quantity: qty,
                    reason: `Bayar titipan cetak (ledger #${safeId}) ke cabang #${toBranchId}`,
                    balanceAfter: Number(updatedFrom.stock),
                    referenceId: refId,
                    branchId: fromBranchId,
                } as any,
            });
            const inMv = await tx.stockMovement.create({
                data: {
                    productVariantId: variantId,
                    type: 'IN',
                    quantity: qty,
                    reason: `Terima bahan dari cabang #${fromBranchId} (ledger #${safeId})`,
                    balanceAfter: Number(updatedTo.stock),
                    referenceId: refId,
                    branchId: toBranchId,
                } as any,
            });

            await tx.$executeRawUnsafe(
                `INSERT INTO ledger_settlements
                  (ledger_id, settlement_type, amount, stock_movement_out_id, stock_movement_in_id, notes, created_at)
                 VALUES
                  (${safeId}, 'STOCK', ${value}, ${outMv.id}, ${inMv.id},
                   ${note ? `'${note.replace(/'/g, "''")}'` : 'NULL'},
                   NOW())`,
            );

            await tx.$executeRawUnsafe(
                `UPDATE inter_branch_ledger
                 SET settled_amount = ${newSettled},
                     status = '${newStatus}',
                     updated_at = NOW()
                 WHERE id = ${safeId}`,
            );

            return {
                ok: true,
                settledAmount: newSettled,
                status: newStatus,
                valueCredited: value,
                fromStockAfter: Number(updatedFrom.stock),
                toStockAfter: Number(updatedTo.stock),
            };
        });
    }

    /**
     * List stok yang ada di cabang pemesan (fromBranch) untuk dipakai sebagai pembayaran.
     * Hanya variant dengan stock > 0 dan HPP > 0 yang dipakai supaya nilainya jelas.
     */
    async listFromBranchStock(ctx: BranchContext, id: number) {
        const safeId = Number(id);
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT l.from_branch_id, l.to_branch_id, fb.name AS from_branch_name, fb.code AS from_branch_code
             FROM inter_branch_ledger l
             JOIN company_branches fb ON fb.id = l.from_branch_id
             WHERE l.id = ${safeId} LIMIT 1`,
        );
        if (!rows.length) throw new NotFoundException('Ledger tidak ditemukan');
        const fromBranchId = Number(rows[0].from_branch_id);
        const toBranchId = Number(rows[0].to_branch_id);
        const fromBranchName: string = rows[0].from_branch_name || '';
        const fromBranchCode: string | null = rows[0].from_branch_code ?? null;
        if (!ctx.isOwner && ctx.branchId !== fromBranchId && ctx.branchId !== toBranchId) {
            throw new ForbiddenException('Akses ledger tidak diizinkan');
        }

        const stocks: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT bs.id AS branch_stock_id, bs.stock, pv.id AS variant_id, pv.sku, pv.variant_name, pv.hpp,
                    p.name AS product_name, p.pricing_mode, p.product_type
             FROM branch_stocks bs
             JOIN product_variants pv ON pv.id = bs.product_variant_id
             JOIN products p ON p.id = pv.product_id
             WHERE bs.branch_id = ${fromBranchId} AND bs.stock > 0
             ORDER BY p.name, pv.variant_name
             LIMIT 500`,
        );

        // Auto-fallback HPP: untuk varian yang variant.hpp = 0 (umum untuk bahan baku
        // yang harga belinya fluktuatif), ambil unit_price dari StockPurchase terakhir
        // di cabang ini. User tidak perlu set HPP dulu di inventori.
        const variantIds: number[] = stocks
            .map((s: any) => Number(s.variant_id))
            .filter((id: number) => Number.isFinite(id));
        const lastPurchaseMap = new Map<number, number>();
        if (variantIds.length > 0) {
            // Per variant: ambil unit_price dari stock_purchase_item terakhir
            // (max purchase id) di cabang fromBranch yg unit_price-nya tidak null.
            const purchases: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT spi.product_variant_id AS variant_id, spi.unit_price AS unit_price
                 FROM stock_purchase_items spi
                 JOIN stock_purchases sp ON sp.id = spi.purchase_id
                 INNER JOIN (
                     SELECT spi2.product_variant_id, MAX(spi2.id) AS max_id
                     FROM stock_purchase_items spi2
                     JOIN stock_purchases sp2 ON sp2.id = spi2.purchase_id
                     WHERE sp2.branch_id = ${fromBranchId}
                       AND spi2.product_variant_id IN (${variantIds.join(',')})
                       AND spi2.unit_price IS NOT NULL
                       AND spi2.unit_price > 0
                     GROUP BY spi2.product_variant_id
                 ) latest ON latest.max_id = spi.id`,
            );
            for (const p of purchases) {
                lastPurchaseMap.set(Number(p.variant_id), Number(p.unit_price) || 0);
            }
        }

        // Diagnostic counters
        const totalRow: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT COUNT(*) AS total FROM branch_stocks WHERE branch_id = ${fromBranchId}`,
        );
        const totalEntries = Number(totalRow?.[0]?.total ?? 0);
        const itemsWithStock = stocks.length;
        const itemsWithHpp = stocks.filter(s => Number(s.hpp) > 0).length;
        const itemsWithFallback = stocks.filter((s: any) =>
            Number(s.hpp) <= 0 && (lastPurchaseMap.get(Number(s.variant_id)) ?? 0) > 0,
        ).length;

        return {
            fromBranchId,
            toBranchId,
            fromBranchName,
            fromBranchCode,
            items: stocks.map((s: any) => {
                const variantId = Number(s.variant_id);
                const hppVarian = Number(s.hpp) || 0;
                const lastPurchase = lastPurchaseMap.get(variantId) ?? 0;
                // effectiveHpp: prefer HPP varian, fallback ke harga beli terakhir
                const effectiveHpp = hppVarian > 0 ? hppVarian : lastPurchase;
                return {
                    variantId,
                    sku: s.sku,
                    variantName: s.variant_name,
                    productName: s.product_name,
                    pricingMode: s.pricing_mode,
                    productType: s.product_type ?? null,
                    hpp: hppVarian,
                    lastPurchasePrice: lastPurchase,
                    effectiveHpp, // <-- nilai yang dipakai untuk hitung pembayaran (auto-fallback)
                    hppSource: hppVarian > 0 ? 'variant' : (lastPurchase > 0 ? 'lastPurchase' : 'none'),
                    stock: Number(s.stock),
                };
            }),
            diagnostics: {
                totalBranchStockEntries: totalEntries,
                entriesWithStock: itemsWithStock,
                entriesWithHpp: itemsWithHpp,
                entriesWithFallbackPrice: itemsWithFallback,
            },
        };
    }

    private mapLedger(r: any) {
        return {
            id: Number(r.id),
            transactionId: Number(r.transaction_id),
            fromBranchId: Number(r.from_branch_id),
            fromBranchName: r.from_branch_name,
            fromBranchCode: r.from_branch_code,
            toBranchId: Number(r.to_branch_id),
            toBranchName: r.to_branch_name,
            toBranchCode: r.to_branch_code,
            costAmount: Number(r.cost_amount),
            serviceFee: Number(r.service_fee),
            totalAmount: Number(r.total_amount),
            settledAmount: Number(r.settled_amount),
            outstandingAmount: Number(r.total_amount) - Number(r.settled_amount),
            status: r.status,
            notes: r.notes,
            invoiceNumber: r.invoice_number,
            customerName: r.customer_name,
            grandTotal: r.grand_total != null ? Number(r.grand_total) : null,
            handoverStatus: r.handover_status,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        };
    }
}
