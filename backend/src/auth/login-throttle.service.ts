import { Injectable } from '@nestjs/common';

/**
 * Proteksi brute-force untuk /auth/login: in-memory, tanpa dependency tambahan.
 * Setelah MAX_FAILS login gagal dari satu IP dalam WINDOW, IP itu dikunci
 * (ditolak 429) selama LOCK_MS. Login sukses langsung mereset hitungan.
 *
 * Konfigurasi via env (punya default aman):
 *   LOGIN_FAIL_WINDOW_MS  jendela hitung kegagalan (default 10 menit)
 *   LOGIN_FAIL_MAX        jumlah gagal sebelum dikunci (default 8)
 *   LOGIN_LOCK_MS         lama penguncian (default 15 menit)
 */
@Injectable()
export class LoginThrottleService {
    private readonly attempts = new Map<string, number[]>();
    private readonly lockedUntil = new Map<string, number>();
    private lastPrune = 0;

    private readonly WINDOW = Number(process.env.LOGIN_FAIL_WINDOW_MS ?? 10 * 60_000);
    private readonly MAX_FAILS = Number(process.env.LOGIN_FAIL_MAX ?? 8);
    private readonly LOCK_MS = Number(process.env.LOGIN_LOCK_MS ?? 15 * 60_000);

    /** Sisa detik penguncian, atau 0 bila tidak terkunci. */
    isLocked(ip: string): number {
        const until = this.lockedUntil.get(ip) ?? 0;
        const now = Date.now();
        return until > now ? Math.ceil((until - now) / 1000) : 0;
    }

    /** Catat satu kegagalan. Mengembalikan apakah IP kini terkunci + jumlah gagal. */
    recordFailure(ip: string): { locked: boolean; fails: number } {
        const now = Date.now();
        this.prune(now);
        const arr = (this.attempts.get(ip) ?? []).filter((t) => now - t < this.WINDOW);
        arr.push(now);
        this.attempts.set(ip, arr);
        if (arr.length >= this.MAX_FAILS) {
            this.lockedUntil.set(ip, now + this.LOCK_MS);
            this.attempts.delete(ip);
            return { locked: true, fails: arr.length };
        }
        return { locked: false, fails: arr.length };
    }

    /** Reset setelah login sukses. */
    reset(ip: string): void {
        this.attempts.delete(ip);
        this.lockedUntil.delete(ip);
    }

    private prune(now: number): void {
        if (now - this.lastPrune < this.WINDOW) return;
        this.lastPrune = now;
        for (const [k, arr] of this.attempts) {
            const kept = arr.filter((t) => now - t < this.WINDOW);
            if (kept.length) this.attempts.set(k, kept);
            else this.attempts.delete(k);
        }
        for (const [k, until] of this.lockedUntil) {
            if (until <= now) this.lockedUntil.delete(k);
        }
    }
}
