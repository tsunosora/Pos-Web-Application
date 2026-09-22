import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { samaAman } from '../common/utils/sama-aman';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Ringkasan HR harian dari RateMyStaff (aplikasi absensi, jalan di :3007).
 *
 * Arah panggilan: browser → backend PosPro → RateMyStaff. Kuncinya (`HR_API_KEY`)
 * hanya ada di server; endpoint RateMyStaff sendiri menolak pemanggil non-loopback.
 *
 * Aturan penting: kartu ini cuma pelengkap dashboard — kalau RateMyStaff mati,
 * JANGAN melempar error. Balas `{ available: false }` supaya dashboard PosPro
 * tetap utuh.
 */
export type HrSummary = {
    available: boolean;
    reason?: string;
    date?: string;
    generatedAt?: string;
    attendance?: {
        employees: number; present: number; onTime: number;
        late: number; leave: number; notYetIn: number; rate: number;
    };
    lateToday?: { name: string; clockIn: string; lateMinutes: number }[];
    onLeaveToday?: { name: string; reason?: string | null }[];
    pendingLeave?: number;
    points?: { enabled: boolean; periodLabel?: string; top?: { name: string; points: number }[] };
};

/** Tautan portal pribadi karyawan di RateMyStaff (`/me/<token>`). */
export type HrMyPortal = {
    found: boolean;
    name?: string;
    portalUrl?: string;
    hasPin?: boolean;
};

@Injectable()
export class HrSummaryService {
    constructor(private readonly prisma: PrismaService) { }

    private readonly log = new Logger('HrSummary');
    /** Kartu sekilas tak perlu real-time; cache melindungi RateMyStaff dari polling. */
    private static readonly CACHE_MS = 60_000;
    /** Kegagalan di-cache lebih pendek supaya pulih cepat begitu RateMyStaff hidup lagi. */
    private static readonly CACHE_GAGAL_MS = 15_000;
    private static readonly TIMEOUT_MS = 5_000;

    private cache: { at: number; data: HrSummary } | null = null;
    /** Tautan portal jarang berubah → cache per user 10 menit. */
    private static readonly CACHE_PORTAL_MS = 10 * 60_000;
    private portalCache = new Map<number, { at: number; data: HrMyPortal }>();
    /** Satu panggilan keluar saja walau beberapa pengguna membuka dashboard bersamaan. */
    private inflight: Promise<HrSummary> | null = null;

    private get url(): string {
        return process.env.HR_SUMMARY_URL || 'http://127.0.0.1:3007/api/integrations/hr-summary';
    }

    async summary(): Promise<HrSummary> {
        const umur = this.cache ? Date.now() - this.cache.at : Infinity;
        const batas = this.cache?.data.available
            ? HrSummaryService.CACHE_MS
            : HrSummaryService.CACHE_GAGAL_MS;
        if (this.cache && umur < batas) return this.cache.data;
        if (this.inflight) return this.inflight;

        this.inflight = this.ambil().finally(() => {
            this.inflight = null;
        });
        return this.inflight;
    }

    private async ambil(): Promise<HrSummary> {
        const key = process.env.HR_API_KEY;
        if (!key) return this.simpan({ available: false, reason: 'HR_API_KEY belum diisi di .env' });

        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), HrSummaryService.TIMEOUT_MS);
        try {
            const res = await fetch(this.url, {
                headers: { 'x-api-key': key, accept: 'application/json' },
                signal: ac.signal,
            });
            if (!res.ok) {
                this.log.warn(`RateMyStaff menjawab HTTP ${res.status}`);
                return this.simpan({ available: false, reason: `HTTP ${res.status}` });
            }
            const data = (await res.json()) as Omit<HrSummary, 'available'>;
            return this.simpan({ available: true, ...data });
        } catch (e: unknown) {
            const pesan = e instanceof Error ? e.message : String(e);
            const timeout = pesan.includes('abort');
            this.log.warn(`Gagal menghubungi RateMyStaff: ${timeout ? 'timeout 5 detik' : pesan}`);
            return this.simpan({ available: false, reason: timeout ? 'timeout' : 'tidak bisa dihubungi' });
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Tautan portal absensi milik SATU orang. `userId` diambil dari JWT pemakai
     * di controller — tidak pernah dari input — supaya tak bisa meminta tautan
     * orang lain.
     */
    async myPortal(userId: number): Promise<HrMyPortal> {
        if (!Number.isInteger(userId) || userId <= 0) return { found: false };
        const cached = this.portalCache.get(userId);
        if (cached && Date.now() - cached.at < HrSummaryService.CACHE_PORTAL_MS) return cached.data;

        const key = process.env.HR_API_KEY;
        if (!key) return { found: false };

        const base = this.url.replace(/\/hr-summary$/, '/my-portal');
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), HrSummaryService.TIMEOUT_MS);
        try {
            const res = await fetch(`${base}?posproUserId=${userId}`, {
                headers: { 'x-api-key': key, accept: 'application/json' },
                signal: ac.signal,
            });
            if (!res.ok) return { found: false };
            const data = (await res.json()) as HrMyPortal;
            const out: HrMyPortal = data?.found ? data : { found: false };
            this.portalCache.set(userId, { at: Date.now(), data: out });
            return out;
        } catch {
            // RateMyStaff mati → kartu kecil ini cukup disembunyikan, bukan error.
            return { found: false };
        } finally {
            clearTimeout(timer);
        }
    }

    /**
     * Versi untuk halaman ber-PIN (/so-designer, /produksi, /cetak): di sana orang
     * masuk dengan nama + PIN, bukan email. PIN diverifikasi dulu — sama seperti
     * pop-up piket — lalu dipetakan ke akun login yang tertaut.
     */
    async myPortalByPin(designerId: number, pin: string): Promise<HrMyPortal> {
        const id = Number(designerId);
        if (!Number.isInteger(id) || id <= 0 || !pin) throw new UnauthorizedException('PIN salah.');

        const d = await (this.prisma as any).designer.findUnique({
            where: { id },
            select: { id: true, pin: true, isActive: true, userId: true },
        });
        if (!d || !d.isActive || !samaAman(d.pin, pin)) throw new UnauthorizedException('PIN salah.');

        // Belum ditautkan ke akun login → tidak ada portal yang bisa ditunjuk.
        if (!d.userId) return { found: false };
        return this.myPortal(d.userId);
    }

    private simpan(data: HrSummary): HrSummary {
        this.cache = { at: Date.now(), data };
        return data;
    }
}
