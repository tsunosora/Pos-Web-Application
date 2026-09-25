import {
    CanActivate,
    ExecutionContext,
    HttpException,
    HttpStatus,
    Injectable,
    Logger,
} from '@nestjs/common';
import { clientIp as ipAsli } from '../auth/pin-throttle.interceptor';
import { samaAman } from '../common/utils/sama-aman';

/**
 * Penjaga API baca-lead untuk website toko (`/storefront/*`). Website tidak lagi login dengan
 * akun PosPro; ia mengirim header `X-Storefront-Read-Token` yang harus cocok dengan env
 * STOREFRONT_READ_TOKEN.
 *
 * - Env KOSONG → endpoint dianggap mati (403), bukan terbuka. Ini kebalikan dari
 *   STOREFRONT_TOKEN (kunci KIRIM order) yang sengaja permisif saat kosong demi transisi.
 * - Token dibandingkan waktu-tetap; token salah/kosong dicatat `[SECURITY]`.
 * - Rate limit sederhana 60 permintaan/menit per IP (dasbor website memanggil beberapa
 *   endpoint per muat halaman; bukan endpoint yang perlu dipukul terus-menerus).
 *
 * Dua token ini TERPISAH dan tidak boleh saling menggantikan: yang satu izin menulis order,
 * yang ini izin membaca lead website.
 */
@Injectable()
export class StorefrontReadGuard implements CanActivate {
    private readonly logger = new Logger('Security');
    private readonly hits = new Map<string, number[]>();
    private lastPrune = 0;

    private static readonly MIN = 60_000;
    private static readonly IP_MIN = 60;

    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        const token = process.env.STOREFRONT_READ_TOKEN;
        const sent = String(req.headers?.['x-storefront-read-token'] ?? '');
        const ip = String(ipAsli(req) ?? '').slice(0, 64);

        if (!token) {
            this.logger.warn(`[SECURITY] storefront_read_nonaktif ip=${ip} (STOREFRONT_READ_TOKEN belum diisi)`);
            throw new HttpException(
                { ok: false, message: 'API baca lead website belum diaktifkan.' },
                HttpStatus.FORBIDDEN,
            );
        }
        if (!sent || !samaAman(sent, token)) {
            this.logger.warn(`[SECURITY] storefront_read_ditolak ip=${ip} header=${sent ? 'salah' : 'kosong'}`);
            throw new HttpException(
                { ok: false, message: 'Token baca lead tidak dikenal.' },
                HttpStatus.FORBIDDEN,
            );
        }

        const now = Date.now();
        const { MIN } = StorefrontReadGuard;
        if (now - this.lastPrune > MIN) {
            this.lastPrune = now;
            for (const [k, arr] of this.hits) {
                const kept = arr.filter((t) => now - t < MIN);
                if (kept.length) this.hits.set(k, kept);
                else this.hits.delete(k);
            }
        }
        const arr = (this.hits.get(ip) ?? []).filter((t) => now - t < MIN);
        if (arr.length >= StorefrontReadGuard.IP_MIN) {
            this.logger.warn(`[SECURITY] storefront_read_throttle ip=${ip} inMin=${arr.length}`);
            throw new HttpException(
                { ok: false, message: 'Terlalu banyak permintaan. Coba lagi sebentar.' },
                HttpStatus.TOO_MANY_REQUESTS,
            );
        }
        arr.push(now);
        this.hits.set(ip, arr);
        return true;
    }
}
