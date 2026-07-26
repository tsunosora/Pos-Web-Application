import {
    computeItemValue,
    buildMatchWhere,
    aggregateByTx,
    valueByItemId,
} from './custom-metric.util';

describe('computeItemValue', () => {
    const item = { transactionId: 1, quantity: 3, pcs: 2, priceAtTime: 50000 };
    it('PCS = quantity × pcs', () => expect(computeItemValue(item, 'PCS')).toBe(6));
    it('QTY = quantity', () => expect(computeItemValue(item, 'QTY')).toBe(3));
    it('OMZET = priceAtTime × quantity', () => expect(computeItemValue(item, 'OMZET')).toBe(150000));
    it('pcs null dianggap 1 utk PCS', () =>
        expect(computeItemValue({ ...item, pcs: null }, 'PCS')).toBe(3));
});

describe('buildMatchWhere', () => {
    it('gabung OR dari produk/variant/kategori/keyword', () => {
        const w = buildMatchWhere({
            productIds: [7],
            productVariantIds: [1, 2],
            categoryIds: [5],
            nameKeywords: ['jersey'],
        });
        expect(Array.isArray(w!.OR)).toBe(true);
        expect(w!.OR.length).toBe(4); // produk + variant + kategori + 1 keyword
    });
    it('match per produk pakai productVariant.productId', () => {
        const w = buildMatchWhere({ productIds: [7, 8] });
        expect(w!.OR[0]).toEqual({ productVariant: { productId: { in: [7, 8] } } });
    });
    it('kembalikan null bila tak ada aturan (jangan match semua)', () => {
        expect(
            buildMatchWhere({ productVariantIds: [], categoryIds: [], nameKeywords: [] }),
        ).toBeNull();
    });
});

describe('aggregateByTx', () => {
    it('NOTA = jumlah tx distinct yang punya item cocok', () => {
        const items = [
            { transactionId: 1, quantity: 2, pcs: 1, priceAtTime: 10 },
            { transactionId: 1, quantity: 1, pcs: 1, priceAtTime: 10 },
            { transactionId: 2, quantity: 5, pcs: 1, priceAtTime: 10 },
        ];
        const map = aggregateByTx(items, 'NOTA');
        expect(map.get(1)).toBe(1);
        expect(map.get(2)).toBe(1);
    });
    it('PCS = agregasi per tx', () => {
        const items = [
            { transactionId: 1, quantity: 2, pcs: 3, priceAtTime: 10 },
            { transactionId: 1, quantity: 1, pcs: 1, priceAtTime: 10 },
        ];
        expect(aggregateByTx(items, 'PCS').get(1)).toBe(7); // 6 + 1
    });
});

describe('valueByItemId (Operator, level-item)', () => {
    it('PCS = nilai per item', () => {
        const map = valueByItemId(
            [{ id: 9, transactionId: 1, quantity: 2, pcs: 3, priceAtTime: 10 }],
            'PCS',
        );
        expect(map.get(9)).toBe(6);
    });
    it('NOTA di level item = 1 per item cocok', () => {
        const map = valueByItemId(
            [{ id: 9, transactionId: 1, quantity: 5, pcs: 1, priceAtTime: 10 }],
            'NOTA',
        );
        expect(map.get(9)).toBe(1);
    });
});
