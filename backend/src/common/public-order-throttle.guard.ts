import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
} from '@nestjs/common';
import { clientIp as ipAsli } from '../auth/pin-throttle.interceptor';
import { samaAman } from './utils/sama-aman';

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
 *
 * KUNCI ASAL ORDER: bila env STOREFRONT_TOKEN terisi, endpoint ini HANYA menerima request
 * ber-header `x-storefront-token` yang cocok — bot yang menembak API langsung (melewati
 * anti-spam website) ditolak 403. Bila env kosong, perilaku lama dipertahankan (rate limit
 * saja) supaya token bisa dipasang di website LEBIH DULU tanpa memutus order yang berjalan.
 */
@Injectable()
export class PublicOrderThrottleGuard implements CanActivate {
    private readonly logger = new Logger('Security');
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
        let dariToko = false;

        const token = process.env.STOREFRONT_TOKEN;
        const sent = String(req.headers?.['x-storefront-token'] ?? '');
        // Perbandingan waktu-tetap: token tidak bisa ditebak dari selisih waktu jawaban.
        const tokenCocok = !!token && !!sent && samaAman(sent, token);
        if (token && !tokenCocok) {
            this.logger.warn(`[SECURITY] storefront_token_ditolak ip=${ipAsli(req)} header=${sent ? 'salah' : 'kosong'}`);
            throw new HttpException(
                { ok: false, message: 'Order hanya diterima lewat website resmi.' },
                HttpStatus.FORBIDDEN,
            );
        }
        const clientIp = req.headers?.['x-client-ip'];
        if (tokenCocok && clientIp) {
            key = 'cust:' + String(clientIp).slice(0, 64);
            dariToko = true;
            limMin = PublicOrderThrottleGuard.CUST_MIN;
            limHour = PublicOrderThrottleGuard.CUST_HOUR;
        } else {
            // Di balik Cloudflare Tunnel soket selalu 127.0.0.1 → pakai IP asli (cf-connecting-ip),
            // kalau tidak semua pemanggil langsung berbagi satu kuota & satu penyerang menghabiskannya.
            const ip = ipAsli(req);
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
        // Pengaman global hanya untuk pemanggil TANPA token toko: dulu beberapa IP yang menembak API
        // langsung menghabiskan kuota global & semua order asli dari website ditolak sampai 1 jam.
        const globalHour = dariToko ? 0 : this.global.filter((t) => now - t < HOUR).length;

        if (inMin >= limMin || inHour >= limHour || globalHour >= PublicOrderThrottleGuard.GLOBAL_HOUR) {
            // Catat untuk monitor keamanan (deteksi abuse/flooding endpoint publik).
            const reason = globalHour >= PublicOrderThrottleGuard.GLOBAL_HOUR ? 'global' : (inMin >= limMin ? 'per-min' : 'per-hour');
            this.logger.warn(`[SECURITY] throttle_block key=${key} reason=${reason} inMin=${inMin} inHour=${inHour} globalHour=${globalHour}`);
            throw new HttpException(
                { ok: false, message: 'Terlalu banyak permintaan order. Mohon coba beberapa saat lagi.' },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }

        arr.push(now);
        this.hits.set(key, arr);
        if (!dariToko) this.global.push(now);
        return true;
    }
}
