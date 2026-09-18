import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeName } from './staff-kpi.aggregate';

export type DailyRow = {
    date: string; // YYYY-MM-DD
    /** Kasir/CS: nota lunas yang ditutup orang ini. */
    transactions: number;
    omzet: number;
    /** Desainer: sales order yang dia kerjakan hari itu. */
    designJobs: number;
    /** Operator: bobot kredit perpindahan kartu produksi (0.5 bila berdua, dst). */
    operatorJobs: number;
};

export type StaffDailyResponse = {
    userId: number;
    name: string;
    from: string;
    to: string;
    days: DailyRow[];
    totals: Omit<DailyRow, 'date'>;
};

/** Date lokal -> "YYYY-MM-DD" (samakan dengan kalender kantor, bukan UTC). */
function ymd(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate(),
    ).padStart(2, '0')}`;
}

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Angka harian per orang — dipakai aplikasi HR untuk menampilkan "hari ini saya
 * menghasilkan berapa" di samping data absensi.
 *
 * Semua atribusi di PosPro memakai NAMA (tabel transaksi, sales order, dan aktivitas
 * produksi tidak menyimpan id user), jadi nama user dicocokkan setelah dinormalisasi.
 */
@Injectable()
export class StaffDailyService {
    constructor(private readonly prisma: PrismaService) { }

    async daily(params: { userId: number; from: string; to: string }): Promise<StaffDailyResponse> {
        const user = await this.prisma.user.findUnique({
            where: { id: params.userId },
            select: { id: true, name: true },
        });
        if (!user?.name) throw new NotFoundException('User tidak ditemukan / tanpa nama.');

        const start = new Date(`${params.from}T00:00:00`);
        const end = new Date(`${params.to}T23:59:59.999`);

        // Nama orang ini bisa tercatat beda di data operasional (mis. user "Damara"
        // memakai nama desainer "Damar"). Designer.name adalah alias resminya, jadi
        // semua alias ikut dicocokkan — bukan hanya User.name.
        const designers = await this.prisma.designer.findMany({
            where: { userId: user.id },
            select: { name: true },
        });
        const aliases = [user.name, ...designers.map((d) => d.name)].filter(Boolean);
        const aliasKeys = new Set(aliases.map((n) => normalizeName(n)));

        const [txs, orders, activities] = await Promise.all([
            // Ambil nota yang menyebut nama ini di salah satu kolom kasir; aturan
            // "kredit ke penutup transaksi" diterapkan setelahnya.
            this.prisma.transaction.findMany({
                where: {
                    status: 'PAID',
                    createdAt: { gte: start, lte: end },
                    OR: aliases.flatMap((n) => [{ cashierName: n }, { checkoutCashierName: n }]),
                },
                select: { createdAt: true, grandTotal: true, cashierName: true, checkoutCashierName: true },
            }),
            this.prisma.salesOrder.findMany({
                where: { designerName: { in: aliases }, createdAt: { gte: start, lte: end } },
                select: { createdAt: true },
            }),
            this.prisma.productionJobActivity.findMany({
                where: { actorName: { in: aliases }, createdAt: { gte: start, lte: end } },
                select: { createdAt: true, actorWeight: true },
            }),
        ]);

        const byDate = new Map<string, DailyRow>();
        const row = (date: string): DailyRow => {
            const r = byDate.get(date) ?? {
                date,
                transactions: 0,
                omzet: 0,
                designJobs: 0,
                operatorJobs: 0,
            };
            byDate.set(date, r);
            return r;
        };

        for (const t of txs) {
            // Kredit hanya bila orang ini yang MENUTUP nota (atau pembuatnya, bila
            // penutupnya kosong) — konsisten dengan agregat di staff-kpi.
            const credited = normalizeName(t.checkoutCashierName || t.cashierName);
            if (!aliasKeys.has(credited)) continue;
            // Transaction.createdAt boleh null di skema; tanpa tanggal tak bisa
            // ditempatkan di hari mana pun.
            if (!t.createdAt) continue;
            const r = row(ymd(t.createdAt));
            r.transactions += 1;
            r.omzet += Number(t.grandTotal);
        }
        for (const o of orders) row(ymd(o.createdAt)).designJobs += 1;
        for (const a of activities) row(ymd(a.createdAt)).operatorJobs += a.actorWeight ?? 1;

        const days = [...byDate.values()]
            .map((r) => ({ ...r, omzet: round2(r.omzet), operatorJobs: round2(r.operatorJobs) }))
            .sort((a, b) => a.date.localeCompare(b.date));

        return {
            userId: user.id,
            name: user.name,
            from: params.from,
            to: params.to,
            days,
            totals: {
                transactions: days.reduce((s, d) => s + d.transactions, 0),
                omzet: round2(days.reduce((s, d) => s + d.omzet, 0)),
                designJobs: days.reduce((s, d) => s + d.designJobs, 0),
                operatorJobs: round2(days.reduce((s, d) => s + d.operatorJobs, 0)),
            },
        };
    }
}
