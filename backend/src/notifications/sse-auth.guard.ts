import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Auth stream notifikasi (EventSource tak bisa kirim header → token lewat ?token=).
 * Dicek di guard, SEBELUM header SSE terkirim: token sah & akun masih aktif. Dulu hanya
 * tanda tangan token — karyawan yang dinonaktifkan tetap menerima notifikasi s/d token habis.
 */
@Injectable()
export class NotifSseAuthGuard implements CanActivate {
    constructor(private readonly jwt: JwtService, private readonly prisma: PrismaService) {}

    async canActivate(ctx: ExecutionContext): Promise<boolean> {
        const req = ctx.switchToHttp().getRequest();
        const token = req?.query?.token;
        if (!token || typeof token !== 'string') throw new UnauthorizedException();
        let payload: any;
        try {
            payload = this.jwt.verify(token);
        } catch {
            throw new UnauthorizedException();
        }
        const u = await this.prisma.user.findUnique({ where: { id: Number(payload?.sub) }, select: { isActive: true } });
        if (!u || u.isActive === false) throw new UnauthorizedException();
        req.user = payload;
        return true;
    }
}
