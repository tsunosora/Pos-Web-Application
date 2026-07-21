import {
    Controller,
    Get,
    Post,
    Query,
    Body,
    Req,
    Headers,
    HttpCode,
    ForbiddenException,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { InboxService } from './inbox.service';
import { verifyMetaSignature } from './signature.util';

/**
 * Endpoint webhook Meta (PUBLIK — tanpa JWT). Satu URL untuk semua channel;
 * routing per cabang dilakukan InboxService via metadata.phone_number_id.
 * Set di Meta: https://<domain>/whatsapp/webhook (field: messages).
 */
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
    private readonly logger = new Logger(WhatsappWebhookController.name);

    constructor(private readonly inbox: InboxService) {}

    /** Verifikasi kepemilikan webhook (dipanggil Meta sekali saat setup). */
    @Get()
    verify(@Query() query: Record<string, string>): string {
        const mode = query['hub.mode'];
        const token = query['hub.verify_token'];
        const challenge = query['hub.challenge'];
        if (mode === 'subscribe' && token && token === process.env.WA_VERIFY_TOKEN) {
            return challenge;
        }
        throw new ForbiddenException('verify_token tidak cocok');
    }

    /** Terima notifikasi (pesan masuk & status). Balas 200 cepat. */
    @Post()
    @HttpCode(200)
    async receive(
        @Req() req: RawBodyRequest<Request>,
        @Headers('x-hub-signature-256') signature: string,
        @Body() body: any,
    ) {
        const appSecret = process.env.WA_APP_SECRET;
        // Enforce signature bila app secret dikonfigurasi (produksi).
        if (appSecret) {
            const ok = verifyMetaSignature(req.rawBody, signature, appSecret);
            if (!ok) {
                this.logger.warn('Signature webhook WA tidak valid — ditolak');
                throw new UnauthorizedException('signature tidak valid');
            }
        } else {
            this.logger.warn('WA_APP_SECRET belum diset — signature webhook TIDAK diverifikasi');
        }

        // InboxService.ingestWebhook tidak pernah melempar (error di-log internal).
        await this.inbox.ingestWebhook(body);
        return { ok: true };
    }
}
