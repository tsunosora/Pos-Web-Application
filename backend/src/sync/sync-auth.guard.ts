import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Guard untuk /sync/pull & /sync/push: terima `x-device-token` (perangkat offline) ATAU
// JWT user (klien web/PWA). Device token → set req.device (dipakai CurrentBranch untuk
// scope cabang). Token tak dikenal/nonaktif → 401.
@Injectable()
export class SyncAuthGuard implements CanActivate {
  private readonly jwt = new JwtAuthGuard();

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const raw = req.headers['x-device-token'];
    if (raw) {
      const device = await this.prisma.device.findUnique({ where: { token: String(raw) } });
      if (!device || !device.isActive) throw new UnauthorizedException('Device token ditolak');
      req.device = device;
      // Update lastSyncAt tanpa memblokir request.
      this.prisma.device
        .update({ where: { id: device.id }, data: { lastSyncAt: new Date() } })
        .catch(() => {});
      return true;
    }
    // Fallback: JWT user (klien non-device).
    return (await this.jwt.canActivate(ctx)) as boolean;
  }
}
