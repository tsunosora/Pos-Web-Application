import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, shareReplay } from 'rxjs/operators';

/**
 * Kunci idempotensi untuk POST pembuat data (T-23). Klien mengirim header
 * `Idempotency-Key` (satu per keranjang/percobaan). Kiriman ulang dengan kunci yang
 * sama dalam 10 menit — tombol diklik dua kali, jaringan lambat lalu diulang, dua
 * tab — mendapat HASIL YANG SAMA, bukan nota kembar. Permintaan yang masih berjalan
 * ditunggu, yang gagal tidak disimpan (boleh diulang).
 *
 * In-memory: backend berjalan satu proses (pm2 fork). Sinkron offline punya kunci
 * sendiri (sync_ops.client_id).
 */
const TTL_MS = 10 * 60_000;
const cache = new Map<string, { at: number; hasil$: Observable<unknown> }>();

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
    intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
        const req = ctx.switchToHttp().getRequest();
        const kunci = req.headers?.['idempotency-key'];
        if (typeof kunci !== 'string' || !kunci || kunci.length > 100) return next.handle();

        const now = Date.now();
        for (const [k, v] of cache) if (now - v.at > TTL_MS) cache.delete(k);

        const k = `${req.user?.userId ?? req.board?.name ?? 'anon'}|${req.method} ${req.path}|${kunci}`;
        const ada = cache.get(k);
        if (ada) return ada.hasil$;

        const hasil$ = next.handle().pipe(
            catchError((e) => { cache.delete(k); return throwError(() => e); }),
            shareReplay(1),
        );
        cache.set(k, { at: now, hasil$ });
        return hasil$;
    }
}
