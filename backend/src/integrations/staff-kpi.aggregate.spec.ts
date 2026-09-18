import {
    aggregateCsRatings,
    aggregateSales,
    aggregateTasks,
    normalizeName,
} from './staff-kpi.aggregate';

describe('normalizeName', () => {
    it('merapikan spasi & huruf besar', () => {
        expect(normalizeName('  Rina   Wati ')).toBe('rina wati');
    });
    it('null/kosong jadi string kosong', () => {
        expect(normalizeName(null)).toBe('');
        expect(normalizeName(undefined)).toBe('');
    });
});

describe('aggregateCsRatings', () => {
    it('rata-rata bintang & tingkat kepuasan per user', () => {
        const out = aggregateCsRatings([
            { assignedCsId: 1, stars: 5, answer: true },
            { assignedCsId: 1, stars: 4, answer: null },
            { assignedCsId: 1, stars: 2, answer: false },
            { assignedCsId: 2, stars: 3, answer: null },
        ]);
        expect(out.get(1)).toEqual({
            count: 3,
            avgStars: 3.67,
            satisfiedCount: 2, // bintang 5 & 4
            satisfactionRate: 66.67,
        });
        expect(out.get(2)?.satisfiedCount).toBe(0);
    });

    it('baris tanpa assignedCsId diabaikan (tak bisa dipetakan ke orang)', () => {
        const out = aggregateCsRatings([{ assignedCsId: null, stars: 5, answer: true }]);
        expect(out.size).toBe(0);
    });

    it('jawaban ya tanpa bintang tetap dihitung puas', () => {
        const out = aggregateCsRatings([{ assignedCsId: 7, stars: null, answer: true }]);
        expect(out.get(7)).toEqual({ count: 1, avgStars: 0, satisfiedCount: 1, satisfactionRate: 100 });
    });
});

describe('aggregateTasks', () => {
    const now = new Date('2026-09-18T10:00:00');

    it('menghitung selesai & terlambat', () => {
        const out = aggregateTasks(
            [
                // selesai tepat waktu
                { assigneeId: 1, status: 'DONE', dueDate: new Date('2026-09-17T17:00:00'), completedAt: new Date('2026-09-17T16:00:00') },
                // selesai tapi lewat tenggat
                { assigneeId: 1, status: 'DONE', dueDate: new Date('2026-09-16T17:00:00'), completedAt: new Date('2026-09-17T09:00:00') },
                // belum selesai & tenggat sudah lewat
                { assigneeId: 1, status: 'TODO', dueDate: new Date('2026-09-17T17:00:00'), completedAt: null },
                // belum selesai tapi tenggat masih nanti -> bukan telat
                { assigneeId: 1, status: 'TODO', dueDate: new Date('2026-09-20T17:00:00'), completedAt: null },
            ],
            now,
        );
        expect(out.get(1)).toEqual({ assigned: 4, done: 2, late: 2, completionRate: 50 });
    });

    it('tugas tanpa tenggat tak pernah dianggap telat', () => {
        const out = aggregateTasks([{ assigneeId: 2, status: 'TODO', dueDate: null, completedAt: null }], now);
        expect(out.get(2)).toEqual({ assigned: 1, done: 0, late: 0, completionRate: 0 });
    });

    it('completedAt terisi dianggap selesai walau status belum DONE', () => {
        const out = aggregateTasks(
            [{ assigneeId: 3, status: 'IN_PROGRESS', dueDate: null, completedAt: new Date('2026-09-17T09:00:00') }],
            now,
        );
        expect(out.get(3)?.done).toBe(1);
    });

    it('tugas tanpa assignee diabaikan', () => {
        expect(aggregateTasks([{ assigneeId: null, status: 'DONE', dueDate: null, completedAt: null }], now).size).toBe(0);
    });
});

describe('aggregateSales', () => {
    it('kredit jatuh ke penutup transaksi, bukan pembuat nota', () => {
        const out = aggregateSales([
            { cashierName: 'Budi', checkoutCashierName: 'Rina', count: 2, grandTotal: 200000 },
        ]);
        expect(out.get('rina')).toEqual({ transactions: 2, grandTotal: 200000, averageTicket: 100000 });
        expect(out.has('budi')).toBe(false);
    });

    it('tanpa penutup, jatuh ke pembuat nota', () => {
        const out = aggregateSales([
            { cashierName: 'Budi', checkoutCashierName: null, count: 1, grandTotal: 50000 },
        ]);
        expect(out.get('budi')?.transactions).toBe(1);
    });

    it('nama dengan beda kapital/spasi digabung jadi satu orang', () => {
        const out = aggregateSales([
            { cashierName: null, checkoutCashierName: 'Rina Wati', count: 1, grandTotal: 100000 },
            { cashierName: null, checkoutCashierName: '  rina   wati ', count: 3, grandTotal: 300000 },
        ]);
        expect(out.size).toBe(1);
        expect(out.get('rina wati')).toEqual({ transactions: 4, grandTotal: 400000, averageTicket: 100000 });
    });

    it('baris tanpa nama sama sekali dibuang', () => {
        expect(aggregateSales([{ cashierName: null, checkoutCashierName: null, count: 5, grandTotal: 1 }]).size).toBe(0);
    });
});
