import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { createHmac } from 'crypto';
import { getJwtSecret } from './jwt-secret.util';
import { PrismaService } from '../prisma/prisma.service';

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

/** Sidik PIN (HMAC, dipotong) — token ikut gugur bila PIN diganti. */
export function sidikPin(pin: string | null | undefined): string {
    return createHmac('sha256', boardSecret()).update(String(pin ?? '')).digest('base64url').slice(0, 12);
}

export function signBoardToken(jwt: JwtService, s: Partial<BoardSession>, pin?: string | null): string {
    return jwt.sign(
        { typ: 'board', bid: s.branchId ?? null, did: s.designerId ?? null, nm: s.name ?? null, ...(pin != null ? { pv: sidikPin(pin) } : {}) },
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
    private readonly cekCache = new Map<string, { ok: boolean; at: number }>();

    constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

    /**
     * Token masih sah? Karyawan dinonaktifkan / PIN (karyawan atau PIN operator cabang) diganti →
     * token lama gugur. Dulu tetap berlaku 24 jam: tablet karyawan yang keluar masih bisa
     * memulai/menyelesaikan job atas namanya. Hasil disimpan 30 detik agar tidak membebani DB.
     */
    private async masihBerlaku(p: any): Promise<boolean> {
        const kunci = `${p.did ?? ''}|${p.bid ?? ''}|${p.pv ?? ''}`;
        const c = this.cekCache.get(kunci);
        if (c && Date.now() - c.at < 30_000) return c.ok;
        let ok = true;
        const db: any = this.prisma;
        if (p.did != null) {
            const d = await db.designer.findUnique({ where: { id: Number(p.did) }, select: { isActive: true, pin: true } });
            ok = !!d?.isActive && (!p.pv || sidikPin(d.pin) === p.pv);
        } else if (p.pv) {
            const bs = p.bid != null ? await db.branchSettings.findUnique({ where: { branchId: Number(p.bid) }, select: { operatorPin: true } }) : null;
            let pin = bs?.operatorPin ?? null;
            if (!pin) pin = (await db.storeSettings.findFirst({ select: { operatorPin: true } }))?.operatorPin ?? null;
            ok = !!pin && sidikPin(pin) === p.pv;
        }
        if (this.cekCache.size > 500) this.cekCache.clear();
        this.cekCache.set(kunci, { ok, at: Date.now() });
        return ok;
    }

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const raw = req.headers?.['x-board-token'];
        if (typeof raw === 'string' && raw) {
            try {
                const p: any = this.jwt.verify(raw, { secret: boardSecret() });
                if (p?.typ === 'board' && (await this.masihBerlaku(p))) {
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
