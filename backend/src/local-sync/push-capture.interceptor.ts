import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

// Mode lokal (POSPRO_LOCAL): tangkap payload POST tertentu yang berhasil dan simpan
// ke antrean SyncPush (payload PERSIS yang dikirim frontend) untuk didorong ke pusat.
// Pusat memutar ulang lewat SyncService.applyOp (idempoten via clientId).
// Di server pusat (tanpa POSPRO_LOCAL) → langsung lewat, nol overhead.
//
// Operasi yang ditangkap (harus punya handler di applyOp):
//   POST /transactions                          → transaction.create
//   POST /cashflow                              → cashflow.create (kas manual)
//   POST /stock-purchases                       → stockPurchase.create (pembelian/stok masuk)
//   POST /stock-transfers                       → stockTransfer.create (transfer antar cabang)
//   POST /stock-opname/sessions/:id/finish      → stockOpname.finish (koreksi opname)

interface Captured {
  type: string;
  payload: unknown;
  localId: number | null;
}

const OPNAME_FINISH = /^\/stock-opname\/sessions\/([^/]+)\/finish$/;

// Petakan (path, body, response) → entri SyncPush, atau null bila tak perlu ditangkap.
function mapCapture(path: string, body: any, res: any): Captured | null {
  switch (path) {
    case '/transactions':
      return { type: 'transaction.create', payload: body, localId: res?.id ?? null };
    case '/cashflow':
      return { type: 'cashflow.create', payload: body, localId: res?.id ?? null };
    case '/stock-purchases':
      return { type: 'stockPurchase.create', payload: body, localId: res?.id ?? null };
    case '/stock-transfers':
      // createTransfer mengembalikan { referenceId } (bukan id numerik) → localId null.
      return { type: 'stockTransfer.create', payload: body, localId: null };
  }
  // Opname: sessionId ada di path (bukan body) → ikutkan ke payload agar pusat bisa
  // menerapkan koreksi stok tanpa bergantung pada baris sesi lokal.
  const m = OPNAME_FINISH.exec(path);
  if (m) {
    return {
      type: 'stockOpname.finish',
      payload: { sessionId: m[1], confirmedItems: body?.confirmedItems ?? [] },
      localId: null,
    };
  }
  return null;
}

@Injectable()
export class PushCaptureInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!process.env.POSPRO_LOCAL) return next.handle();
    const req = ctx.switchToHttp().getRequest();
    if (req.method !== 'POST') return next.handle();
    const path = String(req.path || req.url || '').split('?')[0];

    const body = req.body;
    return next.handle().pipe(
      tap((res: unknown) => {
        const captured = mapCapture(path, body, res);
        if (!captured) return;
        this.prisma.syncPush
          .create({
            data: {
              clientId: randomUUID(),
              type: captured.type,
              payload: captured.payload as any,
              localId: captured.localId,
            },
          })
          .catch(() => {
            /* jangan ganggu response utama */
          });
      }),
    );
  }
}
