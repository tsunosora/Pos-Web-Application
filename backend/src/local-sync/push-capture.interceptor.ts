import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

// Mode lokal (POSPRO_LOCAL): tangkap payload POST /transactions yang berhasil dan
// simpan ke antrean SyncPush (payload PERSIS yang dikirim frontend) untuk didorong
// ke pusat. Di server pusat (tanpa POSPRO_LOCAL) → langsung lewat, nol overhead.
@Injectable()
export class PushCaptureInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!process.env.POSPRO_LOCAL) return next.handle();
    const req = ctx.switchToHttp().getRequest();
    const path = String(req.path || req.url || '').split('?')[0];
    const isTxCreate = req.method === 'POST' && path === '/transactions';
    if (!isTxCreate) return next.handle();

    const payload = req.body;
    return next.handle().pipe(
      tap((res: { id?: number } | undefined) => {
        const localId = res?.id ?? null;
        this.prisma.syncPush
          .create({ data: { clientId: randomUUID(), type: 'transaction.create', payload, localId } })
          .catch(() => {
            /* jangan ganggu response utama */
          });
      }),
    );
  }
}
