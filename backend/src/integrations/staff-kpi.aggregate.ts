/**
 * Fungsi agregasi murni untuk KPI karyawan (tanpa Prisma) — supaya bisa diuji langsung.
 * Dipakai StaffKpiService setelah menarik baris mentah dari database.
 */

export type CsRatingRow = {
    assignedCsId: number | null;
    stars: number | null;
    answer: boolean | null;
};

export type TaskRow = {
    assigneeId: number | null;
    status: string;
    dueDate: Date | null;
    completedAt: Date | null;
};

/** Hasil groupBy transaksi: satu baris per pasangan nama kasir. */
export type SalesGroup = {
    cashierName: string | null;
    checkoutCashierName: string | null;
    count: number;
    grandTotal: number;
};

export type CsRatingKpi = {
    count: number;
    avgStars: number;
    satisfiedCount: number;
    satisfactionRate: number;
};

export type TaskKpi = {
    assigned: number;
    done: number;
    late: number;
    completionRate: number;
};

export type SalesKpi = {
    transactions: number;
    grandTotal: number;
    averageTicket: number;
};

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

function percent(part: number, whole: number): number {
    return whole > 0 ? round2((part / whole) * 100) : 0;
}

/**
 * Samakan bentuk nama sebelum dicocokkan (kasir hanya tersimpan sebagai teks).
 * Huruf kecil, spasi rangkap dirapikan.
 */
export function normalizeName(name: string | null | undefined): string {
    return (name ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Rata-rata bintang & tingkat kepuasan per user (hanya baris yang punya assignedCsId). */
export function aggregateCsRatings(rows: CsRatingRow[]): Map<number, CsRatingKpi> {
    const acc = new Map<number, { count: number; starSum: number; starCount: number; satisfied: number }>();

    for (const r of rows) {
        if (r.assignedCsId == null) continue;
        const g = acc.get(r.assignedCsId) ?? { count: 0, starSum: 0, starCount: 0, satisfied: 0 };
        g.count += 1;
        if (r.stars != null) {
            g.starSum += r.stars;
            g.starCount += 1;
        }
        // Puas = bintang 4-5, atau jawaban ya pada pertanyaan tutup.
        if (r.answer === true || (r.stars != null && r.stars >= 4)) g.satisfied += 1;
        acc.set(r.assignedCsId, g);
    }

    const out = new Map<number, CsRatingKpi>();
    for (const [userId, g] of acc) {
        out.set(userId, {
            count: g.count,
            avgStars: g.starCount > 0 ? round2(g.starSum / g.starCount) : 0,
            satisfiedCount: g.satisfied,
            satisfactionRate: percent(g.satisfied, g.count),
        });
    }
    return out;
}

/**
 * Ketuntasan tugas per user. `late` = selesai lewat tenggat, atau belum selesai
 * padahal tenggatnya sudah lewat (`now`).
 */
export function aggregateTasks(rows: TaskRow[], now: Date): Map<number, TaskKpi> {
    const acc = new Map<number, TaskKpi>();

    for (const r of rows) {
        if (r.assigneeId == null) continue;
        const g = acc.get(r.assigneeId) ?? { assigned: 0, done: 0, late: 0, completionRate: 0 };
        g.assigned += 1;

        const done = r.status === 'DONE' || r.completedAt != null;
        if (done) g.done += 1;

        if (r.dueDate) {
            const overdue = done
                ? r.completedAt != null && r.completedAt > r.dueDate
                : r.dueDate < now;
            if (overdue) g.late += 1;
        }
        acc.set(r.assigneeId, g);
    }

    for (const g of acc.values()) g.completionRate = percent(g.done, g.assigned);
    return acc;
}

/**
 * Penjualan per nama kasir. Kredit diberikan ke **penutup transaksi**
 * (`checkoutCashierName`); bila kosong, jatuh ke `cashierName` (pembuat nota).
 * Kunci peta sudah dinormalisasi lewat normalizeName().
 */
export function aggregateSales(groups: SalesGroup[]): Map<string, SalesKpi> {
    const acc = new Map<string, { transactions: number; grandTotal: number }>();

    for (const g of groups) {
        const key = normalizeName(g.checkoutCashierName || g.cashierName);
        if (!key) continue;
        const cur = acc.get(key) ?? { transactions: 0, grandTotal: 0 };
        cur.transactions += g.count;
        cur.grandTotal += g.grandTotal;
        acc.set(key, cur);
    }

    const out = new Map<string, SalesKpi>();
    for (const [key, v] of acc) {
        out.set(key, {
            transactions: v.transactions,
            grandTotal: round2(v.grandTotal),
            averageTicket: v.transactions > 0 ? Math.round(v.grandTotal / v.transactions) : 0,
        });
    }
    return out;
}
