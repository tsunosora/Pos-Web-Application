import type { PrismaService } from '../prisma/prisma.service';

/**
 * Hasil hitungan cost ledger untuk satu transaksi titipan.
 * Semua nilai dalam Rupiah, sudah di-round 2 desimal.
 */
export interface LedgerCostBreakdown {
    bahanCost: number;       // HPP variant utama + BOM ingredients (raw materials)
    klikCost: number;        // Total click logs (jasa cetak mesin paper)
    serviceFee: number;      // (bahanCost + klikCost) × titipanFeePercent / 100
    totalAmount: number;     // bahanCost + klikCost + serviceFee
    items: number;           // jumlah transaction items dipakai
    clickQuantity: number;   // total qty klik (untuk reference)
    hasClickCost: boolean;   // true kalau ada click logs > 0 (= titipan paper print)
}

/**
 * Hitung total cost untuk Inter-Branch Ledger berdasarkan transaksi titipan.
 *
 * Formula:
 *   bahanCost = Σ per item:
 *     - HPP variant utama × effectiveQty
 *     - + Σ BOM (product-level ingredients) × HPP raw × effectiveQty
 *     - + Σ BOM (variant-level ingredients) × HPP raw × effectiveQty (skip isServiceCost)
 *
 *   Catatan effectiveQty:
 *     - UNIT product: qty langsung
 *     - AREA_BASED: areaCm2/10000 × pcs (terhitung dari areaCm2)
 *
 *   klikCost = Σ click_logs.total_cost untuk semua transactionItem di tx ini
 *
 *   serviceFee = (bahanCost + klikCost) × titipanFeePercent / 100
 *   totalAmount = bahanCost + klikCost + serviceFee
 *
 * Pakai raw SQL via $queryRawUnsafe untuk konsistensi dengan helper lain
 * yang sudah pakai pattern ini (Prisma stale client workaround).
 */
export async function computeLedgerCost(
    prisma: PrismaService,
    txId: number,
    titipanFeePercent: number = 20,
): Promise<LedgerCostBreakdown> {
    const safeId = Number(txId);

    // 1. Variant utama HPP per item
    const items: any[] = await prisma.$queryRawUnsafe(
        `SELECT ti.id, ti.quantity, ti.hpp_at_time, ti.area_cm2,
                pv.id AS variant_id, pv.hpp AS variant_hpp,
                p.pricing_mode
         FROM transaction_items ti
         JOIN product_variants pv ON pv.id = ti.product_variant_id
         JOIN products p ON p.id = pv.product_id
         WHERE ti.transaction_id = ${safeId}`,
    );

    let bahanCost = 0;
    const itemEffectiveQty = new Map<number, number>(); // tx_item_id → effectiveQty (dipakai juga utk BOM)

    for (const it of items) {
        const txItemId = Number(it.id);
        const qty = Number(it.quantity) || 0;
        const hppAt = Number(it.hpp_at_time) || 0;
        const variantHpp = Number(it.variant_hpp) || 0;
        const baseHpp = hppAt > 0 ? hppAt : variantHpp;
        const isAreaBased = it.pricing_mode === 'AREA_BASED';
        const areaM2 = isAreaBased && it.area_cm2 ? Number(it.area_cm2) / 10000 : 0;
        // For AREA_BASED: effectiveQty = total m² (areaCm2/10000); harga & BOM dihitung per m²
        // For UNIT: effectiveQty = qty
        const effectiveQty = isAreaBased ? areaM2 : qty;
        itemEffectiveQty.set(txItemId, effectiveQty);
        bahanCost += baseHpp * effectiveQty;
    }

    // 2. BOM product-level ingredients (raw materials)
    const productBom: any[] = await prisma.$queryRawUnsafe(
        `SELECT ti.id AS tx_item_id, i.quantity AS ing_qty, rmv.hpp AS raw_hpp
         FROM transaction_items ti
         JOIN product_variants pv ON pv.id = ti.product_variant_id
         JOIN ingredients i ON i.product_id = pv.product_id
         LEFT JOIN product_variants rmv ON rmv.id = i.raw_material_variant_id
         WHERE ti.transaction_id = ${safeId}
           AND i.raw_material_variant_id IS NOT NULL`,
    );
    for (const b of productBom) {
        const eff = itemEffectiveQty.get(Number(b.tx_item_id)) ?? 0;
        const ingQty = Number(b.ing_qty) || 0;
        const rawHpp = Number(b.raw_hpp) || 0;
        bahanCost += ingQty * rawHpp * eff;
    }

    // 3. BOM variant-level ingredients (skip isServiceCost — itu jasa, bukan bahan)
    const variantBom: any[] = await prisma.$queryRawUnsafe(
        `SELECT ti.id AS tx_item_id, vi.quantity AS ing_qty, rmv.hpp AS raw_hpp
         FROM transaction_items ti
         JOIN variant_ingredients vi ON vi.variant_id = ti.product_variant_id
         LEFT JOIN product_variants rmv ON rmv.id = vi.raw_material_variant_id
         WHERE ti.transaction_id = ${safeId}
           AND vi.raw_material_variant_id IS NOT NULL
           AND vi.is_service_cost = 0`,
    );
    for (const b of variantBom) {
        const eff = itemEffectiveQty.get(Number(b.tx_item_id)) ?? 0;
        const ingQty = Number(b.ing_qty) || 0;
        const rawHpp = Number(b.raw_hpp) || 0;
        bahanCost += ingQty * rawHpp * eff;
    }

    // 4. Click logs total cost
    const clickAgg: any[] = await prisma.$queryRawUnsafe(
        `SELECT COALESCE(SUM(cl.total_cost), 0) AS total_click,
                COALESCE(SUM(cl.quantity), 0) AS click_qty
         FROM click_logs cl
         JOIN transaction_items ti ON ti.id = cl.transaction_item_id
         WHERE ti.transaction_id = ${safeId}`,
    );
    const klikCost = Number(clickAgg?.[0]?.total_click ?? 0);
    const clickQuantity = Number(clickAgg?.[0]?.click_qty ?? 0);

    // 5. Round + serviceFee + total
    bahanCost = Math.round(bahanCost * 100) / 100;
    const klikCostR = Math.round(klikCost * 100) / 100;
    const subtotal = bahanCost + klikCostR;
    const serviceFee = Math.round((subtotal * titipanFeePercent) / 100 * 100) / 100;
    const totalAmount = Math.round((subtotal + serviceFee) * 100) / 100;

    return {
        bahanCost,
        klikCost: klikCostR,
        serviceFee,
        totalAmount,
        items: items.length,
        clickQuantity,
        hasClickCost: klikCostR > 0,
    };
}
