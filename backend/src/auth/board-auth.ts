import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { getJwtSecret } from './jwt-secret.util';

/**
 * Token papan kerja (/produksi, /cetak): perangkat di lantai produksi tidak login
 * dengan akun, cukup PIN. Setelah PIN benar, server memberi token berumur pendek
 * yang wajib dikirim di header `X-Board-Token` untuk memanggil endpoint papan kerja.
 *
 * Ditandatangani dengan rahasia TURUNAN (bukan JWT_SECRET polos) supaya token
 * papan kerja tidak pernah lolos sebagai token login akun, dan sebaliknya.
 */
export interface BoardSession {
    branchId: number | null;
    designerId: number | null;
    name: string | null;
}

const BOARD_TTL = process.env.BOARD_TOKEN_EXPIRES || '24h'; // sama dgn umur sesi PIN di frontend
const boardSecret = () => `${getJwtSecret()}:papan-kerja`;

export function signBoardToken(jwt: JwtService, s: Partial<BoardSession>): string {
    return jwt.sign(
        { typ: 'board', bid: s.branchId ?? null, did: s.designerId ?? null, nm: s.name ?? null },
        { secret: boardSecret(), expiresIn: BOARD_TTL as any },
    );
}

/** Sesi papan kerja pada request ini (null bila yang memanggil akun login biasa). */
export function boardSessionOf(req: any): BoardSession | null {
    return req?.board ?? null;
}

// Satu instance guard JWT biasa, dipakai ulang sebagai jalur kedua.
const UserJwtGuard = AuthGuard('jwt');

/**
 * Lolos bila request membawa token papan kerja yang sah ATAU token login akun.
 * Papan kerja → `req.board` diisi; akun login → `req.user` seperti JwtAuthGuard.
 */
@Injectable()
export class BoardOrUserGuard implements CanActivate {
    private readonly userGuard = new UserJwtGuard();

    constructor(private readonly jwt: JwtService) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const raw = req.headers?.['x-board-token'];
        if (typeof raw === 'string' && raw) {
            try {
                const p: any = this.jwt.verify(raw, { secret: boardSecret() });
                if (p?.typ === 'board') {
                    const sesi: BoardSession = { branchId: p.bid ?? null, designerId: p.did ?? null, name: p.nm ?? null };
                    req.board = sesi;
                    return true;
                }
            } catch { /* token kedaluwarsa/palsu → coba jalur akun login */ }
        }
        if (req.headers?.authorization) {
            try {
                if (await this.userGuard.canActivate(ctx)) return true;
            } catch { /* jatuh ke 401 di bawah */ }
        }
        throw new UnauthorizedException('Sesi papan kerja berakhir. Masukkan PIN lagi.');
    }
}

/** Papan kerja tidak perlu nomor HP pelanggan — kosongkan untuk sesi papan kerja. */
export function hidePhonesForBoard<T>(req: any, data: T): T {
    if (!boardSessionOf(req)) return data;
    const strip = (row: any) => {
        if (row?.transaction && 'customerPhone' in row.transaction) row.transaction.customerPhone = null;
        return row;
    };
    if (Array.isArray(data)) data.forEach(strip);
    else if (Array.isArray((data as any)?.rows)) (data as any).rows.forEach(strip);
    return data;
}
