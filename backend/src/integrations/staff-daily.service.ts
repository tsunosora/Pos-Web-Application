import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeName } from './staff-kpi.aggregate';
import { lineTotalOf } from '../transactions/area-unit.util';

export type DailyRow = {
    date: string; // YYYY-MM-DD
    /** Kasir/CS: nota lunas yang ditutup orang ini. */
    transactions: number;
    /** Nilai nota yang dia tutup sebagai kasir. */
    omzet: number;
    /** Desainer: sales order yang dia kerjakan hari itu. */
    designJobs: number;
    /** Nilai nota dari sales order yang dia desain. */
    designOmzet: number;
    /** Jasa desain yang benar-benar terjual di order itu, dipecah per jenjang. */
    designServices: DesignService[];
    /** Jumlah jasa desain (semua jenjang). */
    designServiceCount: number;
    /** Nilai rupiah jasa desainnya saja (bukan nilai nota) — ukuran bobot pekerjaan. */
    designServiceValue: number;
    /** Operator: bobot kredit perpindahan kartu produksi (0.5 bila berdua, dst). */
    operatorJobs: number;
    /** Task/piket yang dia selesaikan hari itu, tepat waktu. */
    tasksOnTime: number;
    /** Task/piket yang dia selesaikan hari itu tapi lewat tenggat. */
    tasksLate: number;
    /** Nilai item produksi yang dia kerjakan, dibagi rata bila dikerjakan beberapa orang. */
    operatorOmzet: number;
    /** Jumlah ketiga peran — "hari itu saya menghasilkan berapa". */
    totalOmzet: number;
};

/** Satu jenjang jasa desain (Easy A / Standar / Medium / Hard, dst). */
export type DesignService = {
    level: string;
    qty: number;
    value: number;
};

export type StaffDailyResponse = {
    userId: number;
    name: string;
    from: string;
    to: string;
    days: DailyRow[];
    totals: Omit<DailyRow, 'date'>;
};

/** Gabungkan jenjang jasa desain dari banyak hari menjadi satu ringkasan. */
function mergeServices(list: DesignService[]): DesignService[] {
    const m = new Map<string, DesignService>();
    for (const d of list) {
        const g = m.get(d.level) ?? { level: d.level, qty: 0, value: 0 };
        g.qty += d.qty;
        g.value += d.value;
        m.set(d.level, g);
    }
    return [...m.values()]
        .map((d) => ({ ...d, value: Math.round((d.value + Number.EPSILON) * 100) / 100 }))
        .sort((a, b) => b.value - a.value);
}

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

        const [txs, orders, activities, tasks] = await Promise.all([
            // Ambil nota yang menyebut nama ini di salah satu kolom kasir; aturan
            // "kredit ke penutup transaksi" diterapkan setelahnya.
            this.prisma.transaction.findMany({
                // Hari penjualan = hari LUNAS (paidAt), sama dengan omzet di KPI. Dulu tanggal nota:
                // nota 30 Sep yang lunas 2 Okt tak pernah muncul di Oktober.
                where: {
                    status: 'PAID',
                    paidAt: { gte: start, lte: end },
                    OR: aliases.flatMap((n) => [{ cashierName: n }, { checkoutCashierName: n }]),
                },
                select: { createdAt: true, paidAt: true, grandTotal: true, cashierName: true, checkoutCashierName: true },
            }),
            // Desainer: nilai order diambil dari nota yang lahir dari sales order itu.
            this.prisma.salesOrder.findMany({
                where: { designerName: { in: aliases }, createdAt: { gte: start, lte: end } },
                select: {
                    createdAt: true,
                    transactionId: true,
                    transaction: { select: { status: true, grandTotal: true } },
                },
            }),
            // Operator: kartu produksi yang dia pindahkan. ProductionJobActivity hanya
            // menyimpan jobId (tanpa relasi Prisma), jadi nilainya diambil menyusul.
            // Hanya langkah SELESAI kerja operator (sama dengan leaderboard). Dulu setiap aksi kartu
            // (tiap pindah tahap, catatan QC, unggah bukti) menambah nilai job sekali lagi.
            this.prisma.productionJobActivity.findMany({
                where: {
                    actorName: { in: aliases }, createdAt: { gte: start, lte: end },
                    action: 'STAGE_CHANGE', actorRole: 'OPERATOR', toStage: { in: ['KIRIM', 'SELESAI'] },
                },
                select: { createdAt: true, actorWeight: true, jobId: true },
            }),
            // Task/piket dipetakan lewat id user (bukan nama), jadi selalu tepat orangnya.
            this.prisma.taskItem.findMany({
                where: { assigneeId: user.id, completedAt: { gte: start, lte: end } },
                select: { completedAt: true, dueDate: true },
            }),
        ]);

        // Nilai tiap kartu produksi = qty x harga saat transaksi.
        const jobIds = [...new Set(activities.map((a) => a.jobId))];
        const jobs = jobIds.length
            ? await this.prisma.productionJob.findMany({
                where: { id: { in: jobIds } },
                select: {
                    id: true,
                    transactionItem: { select: { quantity: true, priceAtTime: true, pcs: true, areaCm2: true, unitType: true } },
                },
            })
            : [];
        const jobValue = new Map(
            jobs.map((j) => [
                j.id,
                // Item area: harga per m² × luas × pcs (dulu harga × quantity = nilai spanduk jauh terlalu kecil).
                j.transactionItem ? lineTotalOf(j.transactionItem) : 0,
            ]),
        );

        // Jasa desain adalah PRODUK di PosPro ("Jasa Desain") dengan varian berjenjang
        // (Easy A/B, Standar, Medium, Hard). Jumlah sales order saja menyamakan Easy A
        // dengan Hard, padahal bedanya belasan kali lipat — jadi jenjangnya ikut diambil.
        const soTxIds = orders.map((o) => o.transactionId).filter((id): id is number => id != null);
        const designItems = soTxIds.length
            ? await this.prisma.transactionItem.findMany({
                where: {
                    transactionId: { in: soTxIds },
                    productVariant: { product: { name: { contains: 'desain' } } },
                },
                select: {
                    transactionId: true,
                    quantity: true,
                    priceAtTime: true,
                    productVariant: { select: { variantName: true } },
                },
            })
            : [];
        // Tanggal mengikuti sales order-nya (saat desain dikerjakan), bukan tanggal nota.
        const dateOfTx = new Map<number, string>();
        for (const o of orders) {
            if (o.transactionId != null) dateOfTx.set(o.transactionId, ymd(o.createdAt));
        }

        const byDate = new Map<string, DailyRow>();
        const row = (date: string): DailyRow => {
            const r = byDate.get(date) ?? {
                date,
                transactions: 0,
                omzet: 0,
                designJobs: 0,
                designOmzet: 0,
                designServices: [],
                designServiceCount: 0,
                designServiceValue: 0,
                operatorJobs: 0,
                operatorOmzet: 0,
                tasksOnTime: 0,
                tasksLate: 0,
                totalOmzet: 0,
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
            const tgl = t.paidAt ?? t.createdAt;
            if (!tgl) continue;
            const r = row(ymd(tgl));
            r.transactions += 1;
            r.omzet += Number(t.grandTotal);
        }
        for (const o of orders) {
            const r = row(ymd(o.createdAt));
            r.designJobs += 1;
            // Hanya nota lunas yang dihitung sebagai omzet — seragam dengan sisi kasir.
            if (o.transaction?.status === 'PAID') r.designOmzet += Number(o.transaction.grandTotal);
        }
        for (const it of designItems) {
            const date = it.transactionId != null ? dateOfTx.get(it.transactionId) : undefined;
            if (!date) continue;
            const r = row(date);
            const level = it.productVariant?.variantName?.trim() || 'Tanpa jenjang';
            const value = Number(it.priceAtTime) * it.quantity;
            const found = r.designServices.find((d) => d.level === level);
            if (found) {
                found.qty += it.quantity;
                found.value += value;
            } else {
                r.designServices.push({ level, qty: it.quantity, value });
            }
            r.designServiceCount += it.quantity;
            r.designServiceValue += value;
        }

        // Satu job dihitung sekali per orang (bobot terbesar), pada hari langkah terakhirnya.
        const perJob = new Map<number, { createdAt: Date; actorWeight: number | null; jobId: number }>();
        for (const a of activities) {
            if (!jobValue.has(a.jobId)) continue; // job/nota sudah dihapus
            const lama = perJob.get(a.jobId);
            if (!lama || (a.actorWeight ?? 1) > (lama.actorWeight ?? 1) || ((a.actorWeight ?? 1) === (lama.actorWeight ?? 1) && a.createdAt > lama.createdAt)) perJob.set(a.jobId, a);
        }
        for (const a of perJob.values()) {
            const r = row(ymd(a.createdAt));
            const weight = a.actorWeight ?? 1;
            r.operatorJobs += weight;
            // Dibagi sesuai bobot: kerja berdua = setengah nilai per orang.
            r.operatorOmzet += (jobValue.get(a.jobId) ?? 0) * weight;
        }

        for (const t of tasks) {
            if (!t.completedAt) continue;
            const r = row(ymd(t.completedAt));
            // Tanpa tenggat tak mungkin terlambat.
            if (t.dueDate && t.completedAt > t.dueDate) r.tasksLate += 1;
            else r.tasksOnTime += 1;
        }

        const days = [...byDate.values()]
            .map((r) => ({
                ...r,
                omzet: round2(r.omzet),
                designOmzet: round2(r.designOmzet),
                designServiceValue: round2(r.designServiceValue),
                designServices: r.designServices
                    .map((d) => ({ ...d, value: round2(d.value) }))
                    .sort((a, b) => b.value - a.value),
                operatorJobs: round2(r.operatorJobs),
                operatorOmzet: round2(r.operatorOmzet),
                totalOmzet: round2(r.omzet + r.designOmzet + r.operatorOmzet),
            }))
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
                designOmzet: round2(days.reduce((s, d) => s + d.designOmzet, 0)),
                designServices: mergeServices(days.flatMap((d) => d.designServices)),
                designServiceCount: days.reduce((s, d) => s + d.designServiceCount, 0),
                designServiceValue: round2(days.reduce((s, d) => s + d.designServiceValue, 0)),
                operatorJobs: round2(days.reduce((s, d) => s + d.operatorJobs, 0)),
                operatorOmzet: round2(days.reduce((s, d) => s + d.operatorOmzet, 0)),
                tasksOnTime: days.reduce((s, d) => s + d.tasksOnTime, 0),
                tasksLate: days.reduce((s, d) => s + d.tasksLate, 0),
                totalOmzet: round2(days.reduce((s, d) => s + d.totalOmzet, 0)),
            },
        };
    }
}
