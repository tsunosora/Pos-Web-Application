import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'crypto';

/**
 * Guard mesin-ke-mesin: memeriksa header `x-api-key` terhadap env `STAFF_KPI_API_KEY`.
 *
 * Dipakai endpoint integrasi yang dipanggil aplikasi lain (mis. RateMyStaff menarik
 * KPI karyawan), bukan oleh browser pengguna — jadi tidak lewat JWT/sesi.
 * Bila env belum diisi, akses SELALU ditolak (bukan dibiarkan terbuka).
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const expected = process.env.STAFF_KPI_API_KEY;
        if (!expected) {
            throw new UnauthorizedException('Integrasi belum diaktifkan di server ini.');
        }

        const req = context.switchToHttp().getRequest();
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
