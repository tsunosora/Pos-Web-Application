import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Auth untuk endpoint SSE (EventSource tak bisa kirim header Authorization).
 * Token dikirim via query `?token=`. Guard berjalan SEBELUM handler/stream dibuat
 * → menolak dengan 401 bersih & menjamin tak ada event terkirim tanpa token valid.
 */
@Injectable()
export class WaSseAuthGuard implements CanActivate {
    constructor(private readonly jwt: JwtService) {}

    canActivate(ctx: ExecutionContext): boolean {
        const req = ctx.switchToHttp().getRequest();
        const token = req?.query?.token;
        if (!token || typeof token !== 'string') {
            throw new UnauthorizedException('Token wajib (query ?token=)');
        }
        try {
            req.user = this.jwt.verify(token); // konsisten dgn JwtAuthGuard
            return true;
        } catch {
            throw new UnauthorizedException('Token tidak valid');
        }
    }
}
