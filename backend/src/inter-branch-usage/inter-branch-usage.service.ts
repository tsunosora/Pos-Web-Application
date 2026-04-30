import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';

export interface InterBranchUsageMovement {
    movementId: number;
    txInvoiceNumber: string | null;
    txCheckoutNumber: string | null;
    customerName: string | null;
    qty: number;
    valueRupiah: number;
    date: string;
    transactionId: number | null;
}

export interface InterBranchUsageItem {
    variantId: number;
    sku: string;
    productName: string;
    variantName: string | null;
    pricingMode: string | null;
    productType: string | null;
    totalQty: number;
    totalValue: number;
    movements: InterBranchUsageMovement[];
}

export interface InterBranchUsagePerBranch {
    branchId: number;
    branchName: string;
    branchCode: string | null;
    txCount: number;
    items: InterBranchUsageItem[];
    totalValue: number;
}

export interface InterBranchUsageReport {
    period: { start: string | null; end: string | null };
    productionBranchId: number | null;
    productionBranchName: string | null;
    perBranch: InterBranchUsagePerBranch[];
    grandTotal: number;
    grandQty: number;
    grandTxCount: number;
}

/**
 * Service: Laporan Bahan Titipan Antar Cabang.
 *
 * Tujuan: kasih owner visibility "bahan dari cabang Pusat dipakai untuk order
 * cabang mana, qty berapa, nilai berapa" — supaya tracking bahan jelas walau
 * sistem tidak pakai ledger formal untuk titipan banner.
 *
 * Sumber data: tabel `stock_movements` dengan filter:
 *   - branch_id = production branch (default Pusat / cabang yang punya mesin)
 *   - type = 'OUT'
 *   - reference_id link ke transaksi titipan (transaction.production_branch_id != transaction.branch_id)
 *
 * Untuk tiap movement:
 *   - Resolve transaksi via reference_id (`tx-<invoiceNumber>` atau `JOB-...`)
 *   - Skip kalau bukan titipan
 *   - Hitung nilai = qty × HPP varian (fallback ke harga beli terakhir kalau hpp 0)
 *
 * Group hasil per cabang asal transaksi (transaction.branch_id) → per varian.
 */
@Injectable()
export class InterBranchUsageService {
    constructor(private prisma: PrismaService) { }

    async report(
        ctx: BranchContext,
        params: { startDate?: string; endDate?: string; productionBranchId?: number },
    ): Promise<InterBranchUsageReport> {
        // Resolve cabang produksi target (default = cabang aktif user kalau ada,
        // atau cabang pertama yang aktif kalau Owner mode "Semua Cabang")
        let productionBranchId: number | null = params.productionBranchId ?? ctx.branchId ?? null;
        let productionBranchName: string | null = null;

        if (productionBranchId == null) {
            // Owner mode "Semua Cabang" tanpa filter eksplisit → ambil cabang pertama
            const first: any = await (this.prisma as any).companyBranch.findFirst({
                where: { isActive: true },
                orderBy: { id: 'asc' },
                select: { id: true, name: true },
            });
            if (first) {
                productionBranchId = first.id;
                productionBranchName = first.name;
            }
        } else {
            const b: any = await (this.prisma as any).companyBranch.findUnique({
                where: { id: productionBranchId },
                select: { name: true },
            });
            productionBranchName = b?.name ?? null;
        }

        if (productionBranchId == null) {
            // Tidak ada cabang aktif sama sekali — kembalikan laporan kosong
            return {
                period: { start: params.startDate ?? null, end: params.endDate ?? null },
                productionBranchId: null,
                productionBranchName: null,
                perBranch: [],
                grandTotal: 0,
                grandQty: 0,
                grandTxCount: 0,
            };
        }

        // Build date range filter
        const dateClauses: string[] = [`sm.branch_id = ${productionBranchId}`, `sm.type = 'OUT'`];
        if (params.startDate) {
            const start = `${params.startDate} 00:00:00`;
            dateClauses.push(`sm.created_at >= '${start}'`);
        }
        if (params.endDate) {
            const end = `${params.endDate} 23:59:59`;
            dateClauses.push(`sm.created_at <= '${end}'`);
        }
        const whereSql = dateClauses.join(' AND ');

        // Ambil semua StockMovement OUT dari cabang produksi target
        const movements: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT sm.id, sm.product_variant_id, sm.quantity, sm.reason, sm.reference_id,
                    sm.created_at, sm.branch_id,
                    pv.sku, pv.variant_name, pv.hpp,
                    p.name AS product_name, p.pricing_mode, p.product_type
             FROM stock_movements sm
             JOIN product_variants pv ON pv.id = sm.product_variant_id
             JOIN products p ON p.id = pv.product_id
             WHERE ${whereSql}
             ORDER BY sm.created_at DESC
             LIMIT 5000`,
        );

        if (!movements.length) {
            return {
                period: { start: params.startDate ?? null, end: params.endDate ?? null },
                productionBranchId,
                productionBranchName,
                perBranch: [],
                grandTotal: 0,
                grandQty: 0,
                grandTxCount: 0,
            };
        }

        // Resolve transaction info dari reference_id.
        // Format yang dipakai sistem:
        //   "tx-<invoiceNumber>"   — dari checkout/edit/hapus transaksi
        //   "JOB-<date>-<seq>"     — dari operator klik "Mulai Job" (lookup via productionJob)
        //   "BATCH-<seq>"          — dari batch print (skip — kompleksitas tidak sebanding)
        const refs = Array.from(new Set(
            movements.map((m: any) => m.reference_id).filter((r: any) => typeof r === 'string'),
        )) as string[];
        const txInvoices = refs.filter(r => r.startsWith('tx-')).map(r => r.slice(3));
        const jobNumbers = refs.filter(r => r.startsWith('JOB-'));

        const txByInvoice = new Map<string, any>();
        if (txInvoices.length) {
            const txs: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT t.id, t.invoice_number, t.checkout_number, t.customer_name,
                        t.branch_id, t.production_branch_id,
                        b.name AS branch_name, b.code AS branch_code
                 FROM transactions t
                 LEFT JOIN company_branches b ON b.id = t.branch_id
                 WHERE t.invoice_number IN (${txInvoices.map(i => `'${i.replace(/'/g, "''")}'`).join(',')})`,
            );
            for (const t of txs) txByInvoice.set(t.invoice_number, t);
        }
        const txByJob = new Map<string, any>();
        if (jobNumbers.length) {
            const jobs: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT pj.job_number,
                        t.id, t.invoice_number, t.checkout_number, t.customer_name,
                        t.branch_id, t.production_branch_id,
                        b.name AS branch_name, b.code AS branch_code
                 FROM production_jobs pj
                 JOIN transactions t ON t.id = pj.transaction_id
                 LEFT JOIN company_branches b ON b.id = t.branch_id
                 WHERE pj.job_number IN (${jobNumbers.map(j => `'${j.replace(/'/g, "''")}'`).join(',')})`,
            );
            for (const j of jobs) txByJob.set(j.job_number, j);
        }

        // Lookup harga beli terakhir per variant di cabang produksi (untuk fallback HPP)
        const variantIds = Array.from(new Set(movements.map((m: any) => Number(m.product_variant_id))));
        const lastPriceMap = new Map<number, number>();
        if (variantIds.length > 0) {
            const purchases: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT spi.product_variant_id AS variant_id, spi.unit_price AS unit_price
                 FROM stock_purchase_items spi
                 JOIN stock_purchases sp ON sp.id = spi.purchase_id
                 INNER JOIN (
                     SELECT spi2.product_variant_id, MAX(spi2.id) AS max_id
                     FROM stock_purchase_items spi2
                     JOIN stock_purchases sp2 ON sp2.id = spi2.purchase_id
                     WHERE sp2.branch_id = ${productionBranchId}
                       AND spi2.product_variant_id IN (${variantIds.join(',')})
                       AND spi2.unit_price IS NOT NULL AND spi2.unit_price > 0
                     GROUP BY spi2.product_variant_id
                 ) latest ON latest.max_id = spi.id`,
            );
            for (const p of purchases) {
                lastPriceMap.set(Number(p.variant_id), Number(p.unit_price) || 0);
            }
        }

        // Filter movement: hanya yang link ke transaksi titipan (production_branch_id != branch_id)
        // dan group per cabang asal transaksi
        type GroupKey = number; // branchId asal transaksi
        const branchMap = new Map<GroupKey, {
            branchInfo: { id: number; name: string; code: string | null };
            txIds: Set<number>;
            itemsMap: Map<number, InterBranchUsageItem>;
            totalValue: number;
        }>();

        let grandTotal = 0;
        let grandQty = 0;

        for (const m of movements) {
            const ref: string | null = m.reference_id ?? null;
            let tx: any = null;
            if (ref) {
                if (ref.startsWith('tx-')) tx = txByInvoice.get(ref.slice(3));
                else if (ref.startsWith('JOB-')) tx = txByJob.get(ref);
            }
            if (!tx) continue;

            const txBranchId = Number(tx.branch_id);
            const txProdBranchId = tx.production_branch_id != null ? Number(tx.production_branch_id) : null;
            // Skip kalau bukan titipan (branch sama dengan production branch)
            if (txProdBranchId == null || txBranchId === txProdBranchId) continue;
            // Skip kalau cabang produksi di transaksi tidak match dengan filter
            if (txProdBranchId !== productionBranchId) continue;

            // Hitung nilai movement
            const variantId = Number(m.product_variant_id);
            const qty = Number(m.quantity) || 0;
            const variantHpp = Number(m.hpp) || 0;
            const lastPrice = lastPriceMap.get(variantId) ?? 0;
            const effectiveHpp = variantHpp > 0 ? variantHpp : lastPrice;
            const value = Math.round(qty * effectiveHpp * 100) / 100;

            // Get/init group untuk cabang asal
            if (!branchMap.has(txBranchId)) {
                branchMap.set(txBranchId, {
                    branchInfo: { id: txBranchId, name: tx.branch_name || `Cabang #${txBranchId}`, code: tx.branch_code ?? null },
                    txIds: new Set(),
                    itemsMap: new Map(),
                    totalValue: 0,
                });
            }
            const group = branchMap.get(txBranchId)!;
            group.txIds.add(Number(tx.id));

            // Get/init item per variant
            if (!group.itemsMap.has(variantId)) {
                group.itemsMap.set(variantId, {
                    variantId,
                    sku: m.sku,
                    productName: m.product_name,
                    variantName: m.variant_name,
                    pricingMode: m.pricing_mode,
                    productType: m.product_type,
                    totalQty: 0,
                    totalValue: 0,
                    movements: [],
                });
            }
            const item = group.itemsMap.get(variantId)!;
            item.totalQty += qty;
            item.totalValue += value;
            item.movements.push({
                movementId: Number(m.id),
                txInvoiceNumber: tx.invoice_number,
                txCheckoutNumber: tx.checkout_number,
                customerName: tx.customer_name,
                qty,
                valueRupiah: value,
                date: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
                transactionId: Number(tx.id),
            });

            group.totalValue += value;
            grandTotal += value;
            grandQty += qty;
        }

        // Round final values
        const perBranch: InterBranchUsagePerBranch[] = Array.from(branchMap.values()).map(g => ({
            branchId: g.branchInfo.id,
            branchName: g.branchInfo.name,
            branchCode: g.branchInfo.code,
            txCount: g.txIds.size,
            totalValue: Math.round(g.totalValue * 100) / 100,
            items: Array.from(g.itemsMap.values()).map(it => ({
                ...it,
                totalQty: Math.round(it.totalQty * 10000) / 10000,
                totalValue: Math.round(it.totalValue * 100) / 100,
            })).sort((a, b) => b.totalValue - a.totalValue),
        })).sort((a, b) => b.totalValue - a.totalValue);

        return {
            period: { start: params.startDate ?? null, end: params.endDate ?? null },
            productionBranchId,
            productionBranchName,
            perBranch,
            grandTotal: Math.round(grandTotal * 100) / 100,
            grandQty: Math.round(grandQty * 10000) / 10000,
            grandTxCount: perBranch.reduce((s, b) => s + b.txCount, 0),
        };
    }
}
