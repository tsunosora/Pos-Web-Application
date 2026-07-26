export type CountMode = 'PCS' | 'QTY' | 'OMZET' | 'NOTA';

export interface MatchRule {
    productIds?: number[] | null;
    productVariantIds?: number[] | null;
    categoryIds?: number[] | null;
    nameKeywords?: string[] | null;
}

export interface RawItem {
    transactionId: number;
    quantity: number | null;
    pcs: number | null;
    priceAtTime: number | null;
}

/** Nilai satu item untuk mode non-NOTA. */
export function computeItemValue(item: RawItem, mode: CountMode): number {
    const qty = Number(item.quantity) || 0;
    const pcs = Number(item.pcs) || 1;
    const price = Number(item.priceAtTime) || 0;
    switch (mode) {
        case 'QTY':
            return qty;
        case 'OMZET':
            return price * qty;
        case 'PCS':
        default:
            return qty * pcs;
    }
}

/** Where Prisma untuk TransactionItem yang cocok (OR). Null bila tak ada aturan. */
export function buildMatchWhere(rule: MatchRule): { OR: any[] } | null {
    const or: any[] = [];
    if (rule.productIds?.length) {
        or.push({ productVariant: { productId: { in: rule.productIds } } });
    }
    if (rule.productVariantIds?.length) {
        or.push({ productVariantId: { in: rule.productVariantIds } });
    }
    if (rule.categoryIds?.length) {
        or.push({ productVariant: { product: { categoryId: { in: rule.categoryIds } } } });
    }
    for (const kw of rule.nameKeywords ?? []) {
        const k = kw.trim();
        if (!k) continue;
        or.push({
            OR: [
                { customName: { contains: k } },
                { productVariant: { product: { name: { contains: k } } } },
            ],
        });
    }
    return or.length ? { OR: or } : null;
}

/** Agregasi item cocok → Map<txId, nilai>. NOTA = 1 per tx yang punya item cocok. */
export function aggregateByTx(items: RawItem[], mode: CountMode): Map<number, number> {
    const map = new Map<number, number>();
    if (mode === 'NOTA') {
        for (const it of items) map.set(it.transactionId, 1);
        return map;
    }
    for (const it of items) {
        map.set(it.transactionId, (map.get(it.transactionId) ?? 0) + computeItemValue(it, mode));
    }
    return map;
}

/**
 * Nilai per TransactionItem (utk atribusi level-item Operator) → Map<itemId, nilai>.
 * NOTA di level item = 1 per item cocok (nanti dijumlah per operator).
 */
export function valueByItemId(
    items: (RawItem & { id: number })[],
    mode: CountMode,
): Map<number, number> {
    const map = new Map<number, number>();
    for (const it of items) {
        map.set(it.id, mode === 'NOTA' ? 1 : computeItemValue(it, mode));
    }
    return map;
}
