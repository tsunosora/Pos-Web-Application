import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { DiscordService } from './discord.service';

/**
 * Global exception filter: pertahankan respons HTTP standar, lalu teruskan error
 * level server (>=500) ke Discord channel #sistem. Error 4xx (validasi/not found)
 * TIDAK dikirim agar tidak spam. Ada throttle anti-duplikat 60 detik.
 */
@Catch()
export class DiscordExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger('ExceptionFilter');
    private lastSent = new Map<string, number>();
    private readonly THROTTLE_MS = 60_000;

    constructor(private readonly discord: DiscordService) {}

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const res = ctx.getResponse();
        const req = ctx.getRequest();

        const status = exception instanceof HttpException
            ? exception.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const payload = exception instanceof HttpException
            ? exception.getResponse()
            : { statusCode: status, message: 'Internal server error' };

        // Respons ke client (format standar Nest)
        try {
            res.status(status).json(
                typeof payload === 'string' ? { statusCode: status, message: payload } : payload,
            );
        } catch { /* response mungkin sudah terkirim */ }

        // Hanya teruskan error server ke Discord
        if (status >= 500) {
            const err = exception as any;
            const msg = err?.message || String(exception);
            const where = `${req?.method || ''} ${req?.url || ''}`.trim();
            this.logger.error(`${where} → ${msg}`, err?.stack);

            const key = `${where}|${msg}`.slice(0, 200);
            const now = Date.now();
            const last = this.lastSent.get(key) || 0;
            if (now - last > this.THROTTLE_MS) {
                this.lastSent.set(key, now);
                // fire-and-forget — jangan blokir respons
                this.discord.notifyError({ context: where || 'Unknown', message: msg });
            }
        }
    }
}
