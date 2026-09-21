import { CallHandler, ExecutionContext, HttpException, HttpStatus, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

/**
 * Pembatas tebakan PIN (papan kerja, SO desainer, papan tugas, HR, KPI).
 * PIN 4 digit hanya punya 10.000 kemungkinan — tanpa pembatas bisa habis
 * ditebak dalam hitungan detik. Pola sama dengan LoginThrottleService:
 * in-memory per IP, tanpa dependency tambahan.
 *
 * Kegagalan = balasan `{ valid: false }` atau galat 400/401/403 "PIN salah/tidak valid"
 * (bukan galat lain yang kebetulan menyebut PIN, mis. "PIN belum terhubung ke akun").
 * Sukses TIDAK mereset hitungan: pemegang satu PIN sah tidak boleh bisa
 * "mencuci" hitungan lalu lanjut menebak PIN orang lain.
 *
 * Env: PIN_FAIL_WINDOW_MS (default 10 menit), PIN_FAIL_MAX (10), PIN_LOCK_MS (10 menit).
 */
const WINDOW = Number(process.env.PIN_FAIL_WINDOW_MS ?? 10 * 60_000);
const MAX_FAILS = Number(process.env.PIN_FAIL_MAX ?? 10);
const LOCK_MS = Number(process.env.PIN_LOCK_MS ?? 10 * 60_000);

// Disimpan di tingkat modul: interceptor bisa diinstansiasi per modul Nest,
// tetapi hitungannya harus satu untuk seluruh aplikasi.
const attempts = new Map<string, number[]>();
const lockedUntil = new Map<string, number>();
let lastPrune = 0;

export function clientIp(req: any): string {
    // Header proksi hanya dipercaya bila koneksi datang dari mesin ini (cloudflared/proksi lokal).
    // Backend juga mendengar di LAN: dulu klien LAN bisa mengarang cf-connecting-ip tiap
    // permintaan → pembatas tebakan PIN & batas penilaian CS tak pernah kena.
    const asal = String(req?.socket?.remoteAddress || req?.connection?.remoteAddress || '');
    const lokal = asal === '127.0.0.1' || asal === '::1' || asal === '::ffff:127.0.0.1';
    if (!lokal) return asal || req?.ip || 'unknown';
    const cf = req?.headers?.['cf-connecting-ip'];
    if (typeof cf === 'string' && cf) return cf.trim();
    const xff = req?.headers?.['x-forwarded-for'];
    if (typeof xff === 'string' && xff) return xff.split(',')[0].trim();
    return req?.ip || req?.socket?.remoteAddress || 'unknown';
}

function prune(now: number) {
    if (now - lastPrune < WINDOW) return;
    lastPrune = now;
    for (const [k, arr] of attempts) {
        const kept = arr.filter((t) => now - t < WINDOW);
        if (kept.length) attempts.set(k, kept);
        else attempts.delete(k);
    }
    for (const [k, until] of lockedUntil) if (until <= now) lockedUntil.delete(k);
}

function lockSeconds(ip: string): number {
    const until = lockedUntil.get(ip) ?? 0;
    const now = Date.now();
    return until > now ? Math.ceil((until - now) / 1000) : 0;
}

function recordFailure(ip: string): { locked: boolean; fails: number } {
    const now = Date.now();
    prune(now);
    const arr = (attempts.get(ip) ?? []).filter((t) => now - t < WINDOW);
    arr.push(now);
    attempts.set(ip, arr);
    if (arr.length >= MAX_FAILS) {
        lockedUntil.set(ip, now + LOCK_MS);
        attempts.delete(ip);
        return { locked: true, fails: arr.length };
    }
    return { locked: false, fails: arr.length };
}

/** Hanya untuk pengujian. */
export function resetPinThrottle() {
    attempts.clear();
    lockedUntil.clear();
}

function isPinFailure(err: any): boolean {
    const status = typeof err?.getStatus === 'function' ? err.getStatus() : 0;
    if (![400, 401, 403].includes(status)) return false;
    const r = typeof err.getResponse === 'function' ? err.getResponse() : null;
    const msg = typeof r === 'string' ? r : String(r?.message ?? err.message ?? '');
    return /\bpin\b[^.]*\b(salah|tidak valid|invalid)\b/i.test(msg);
}

@Injectable()
export class PinThrottleInterceptor implements NestInterceptor {
    private readonly logger = new Logger('PinThrottle');

    intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
        const req = ctx.switchToHttp().getRequest();
        const ip = clientIp(req);
        const wait = lockSeconds(ip);
        if (wait > 0) {
            const menit = Math.ceil(wait / 60);
            throw new HttpException(
                { statusCode: 429, message: `Terlalu banyak PIN salah. Coba lagi dalam ${menit} menit.`, retryAfter: wait },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
        const fail = () => {
            const { locked, fails } = recordFailure(ip);
            this.logger.warn(`[SECURITY] pin_failed path=${req.path} ip=${ip} fails=${fails}${locked ? ' -> LOCKED' : ''}`);
        };
        return next.handle().pipe(
            tap((res) => { if (res && typeof res === 'object' && res.valid === false) fail(); }),
            catchError((err) => {
                if (isPinFailure(err)) fail();
                return throwError(() => err);
            }),
        );
    }
}
