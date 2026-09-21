import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Jejak audit ringan untuk aksi yang mengubah angka uang tanpa nota (mis. HPP varian,
 * T-38): setelah BERHASIL, catat siapa (akun), kapan, jalur, dan ringkasan kiriman ke
 * log backend (`[AUDIT] …`, tersimpan di log pm2). Tidak mengubah alur permintaan.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
    private readonly logger = new Logger('Audit');

    intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
        const req = ctx.switchToHttp().getRequest();
        return next.handle().pipe(
            tap(() => {
                let isi = '';
                try { isi = JSON.stringify(req.body ?? {}).slice(0, 400); } catch { /* abaikan */ }
                this.logger.warn(
                    `[AUDIT] ${req.method} ${req.originalUrl || req.url} user=${req.user?.userId ?? '?'} email=${req.user?.email ?? '?'} isi=${isi}`,
                );
            }),
        );
    }
}
