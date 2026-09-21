import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Auth untuk endpoint SSE (EventSource tak bisa kirim header Authorization).
 * Token dikirim via query `?token=`. Guard berjalan SEBELUM handler/stream dibuat
 * → menolak dengan 401 bersih & menjamin tak ada event terkirim tanpa token valid.
 */
@Injectable()
export class WaSseAuthGuard implements CanActivate {
    constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const token = req?.query?.token;
        if (!token || typeof token !== 'string') {
            throw new UnauthorizedException('Token wajib (query ?token=)');
        }
        let payload: any;
        try {
            payload = this.jwt.verify(token);
        } catch {
            throw new UnauthorizedException('Token tidak valid');
        }
        // Sama dengan JwtAuthGuard: akun nonaktif ditolak (dulu stream tetap jalan s/d token habis).
        const u = await this.prisma.user.findUnique({ where: { id: Number(payload?.sub) }, select: { isActive: true } });
        if (!u || u.isActive === false) throw new UnauthorizedException('Akun nonaktif');
        req.user = payload; // konsisten dgn JwtAuthGuard
        return true;
    }
}
