import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/** Header yang HANYA ada bila request datang lewat Cloudflare/tunnel (bukan dari mesin ini). */
const PROXY_HEADERS = ['cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'x-real-ip'];

/** Alamat loopback — request dari aplikasi lain di server yang sama. */
function isLoopback(addr: string | undefined): boolean {
    if (!addr) return false;
    const a = addr.replace(/^::ffff:/, '');
    return a === '127.0.0.1' || a === '::1' || a.startsWith('127.');
}

/**
 * Guard mesin-ke-mesin: memeriksa header `x-api-key` terhadap env `STAFF_KPI_API_KEY`.
 *
 * Dipakai endpoint integrasi yang dipanggil aplikasi lain di SERVER YANG SAMA
 * (mis. RateMyStaff menarik KPI karyawan), bukan oleh browser pengguna.
 *
 * Dua lapis:
 * 1. Kunci API (wajib; env kosong = akses ditolak, bukan dibiarkan terbuka).
 * 2. Hanya dari loopback. Backend ini terbuka ke internet lewat Cloudflare Tunnel,
 *    jadi tanpa lapis ini endpoint integrasi ikut terekspos ke publik. Request dari
 *    tunnel tiba dengan header Cloudflare (cf-ray dsb) walau soket-nya loopback,
 *    sehingga keduanya diperiksa. Set STAFF_KPI_ALLOW_REMOTE=true bila kelak
 *    aplikasi HR dipindah ke server lain.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const expected = process.env.STAFF_KPI_API_KEY;
        if (!expected) {
            throw new UnauthorizedException('Integrasi belum diaktifkan di server ini.');
        }

        const req = context.switchToHttp().getRequest();

        if (process.env.STAFF_KPI_ALLOW_REMOTE !== 'true') {
            const viaProxy = PROXY_HEADERS.some((h) => req.headers?.[h]);
            const local = isLoopback(req.socket?.remoteAddress ?? req.ip);
            if (viaProxy || !local) {
                throw new UnauthorizedException('Endpoint integrasi hanya untuk pemanggil lokal.');
            }
        }

        const header = req.headers?.['x-api-key'];
        const provided = Array.isArray(header) ? header[0] : header;
        if (typeof provided !== 'string' || !safeEqual(provided, expected)) {
            throw new UnauthorizedException('API key tidak valid.');
        }
        return true;
    }
}

/** Bandingkan tanpa membocorkan panjang/isi lewat waktu eksekusi. */
function safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
}
