import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
} from '@nestjs/common';

/**
 * Rate limit in-memory untuk endpoint order publik (`POST /orders/public`).
 * Tanpa dependency tambahan. Tujuan: mencegah "boom order" (ribuan lead sampah).
 *
 * Catatan arsitektur: order dari website di-PROXY oleh server hosting toko
 * (PHP memanggil PosPro), jadi dari sisi backend SEMUA order website tampak
 * berasal dari 1 IP (hosting). Karena itu:
 *  - Bila request membawa header `x-storefront-token` yang cocok dengan env
 *    STOREFRONT_TOKEN, kita percaya `x-client-ip` (IP customer asli yang
 *    diteruskan PHP) dan menerapkan limit KETAT per-customer.
 *  - Selain itu (mis. serangan langsung ke API), kunci = IP soket pemanggil
 *    dengan limit lebih longgar + ada circuit breaker global.
 * Limit presisi per-customer untuk jalur website tetap ditegakkan juga di sisi
 * PHP (yang melihat REMOTE_ADDR asli).
 */
@Injectable()
export class PublicOrderThrottleGuard implements CanActivate {
    private readonly hits = new Map<string, number[]>();
    private global: number[] = [];
    private lastPrune = 0;

    private static readonly MIN = 60_000;
    private static readonly HOUR = 3_600_000;
    // Per-customer (IP asli diteruskan PHP via token tepercaya)
    private static readonly CUST_MIN = 5;
    private static readonly CUST_HOUR = 20;
    // Per-IP soket (mis. hit langsung ke API, atau hosting IP tanpa token)
    private static readonly IP_MIN = 15;
    private static readonly IP_HOUR = 80;
    // Pengaman global lintas semua kunci (anti header-spoofing flood)
    private static readonly GLOBAL_HOUR = 300;

    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        const now = Date.now();
        const { MIN, HOUR } = PublicOrderThrottleGuard;

        let key: string;
        let limMin: number;
        let limHour: number;

        const token = process.env.STOREFRONT_TOKEN;
        const sent = String(req.headers?.['x-storefront-token'] ?? '');
        const clientIp = req.headers?.['x-client-ip'];
        if (token && sent && sent === token && clientIp) {
            key = 'cust:' + String(clientIp).slice(0, 64);
            limMin = PublicOrderThrottleGuard.CUST_MIN;
            limHour = PublicOrderThrottleGuard.CUST_HOUR;
        } else {
            const ip = req.ip || req.socket?.remoteAddress || 'unknown';
            key = 'ip:' + String(ip).slice(0, 64);
            limMin = PublicOrderThrottleGuard.IP_MIN;
            limHour = PublicOrderThrottleGuard.IP_HOUR;
        }

        // Bersih-bersih berkala agar Map tidak tumbuh tanpa batas.
        if (now - this.lastPrune > MIN) {
            this.lastPrune = now;
            for (const [k, arr] of this.hits) {
                const kept = arr.filter((t) => now - t < HOUR);
                if (kept.length) this.hits.set(k, kept);
                else this.hits.delete(k);
            }
            this.global = this.global.filter((t) => now - t < HOUR);
        }

        const arr = (this.hits.get(key) ?? []).filter((t) => now - t < HOUR);
        const inMin = arr.filter((t) => now - t < MIN).length;
        const inHour = arr.length;
        const globalHour = this.global.filter((t) => now - t < HOUR).length;

        if (inMin >= limMin || inHour >= limHour || globalHour >= PublicOrderThrottleGuard.GLOBAL_HOUR) {
            throw new HttpException(
                { ok: false, message: 'Terlalu banyak permintaan order. Mohon coba beberapa saat lagi.' },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        arr.push(now);
        this.hits.set(key, arr);
        this.global.push(now);
        return true;
    }
}
