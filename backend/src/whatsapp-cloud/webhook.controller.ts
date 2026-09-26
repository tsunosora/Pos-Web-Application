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
 *
 * JANGAN PERNAH memasang `@ButuhFitur` di sini, dan jangan menyatukan kelas ini dengan
 * `WhatsappCloudController` (yang berkode `wa.cloud`). Meta memanggil URL ini tanpa sesi
 * pengguna: sekali dijawab 403 Meta menonaktifkan webhooknya, dan sejak itu pesan pelanggan
 * hilang tanpa jejak — juga untuk klien yang paketnya MEMANG memuat WhatsApp. Kalau kunci
 * lisensinya tidak memuat `wa.cloud`, yang pantas ditolak adalah orang yang membuka inbox,
 * bukan pesan pelanggan yang sudah sampai.
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

        // Galat per pesan di-log internal; hanya galat DB SEMENTARA yang dilempar (503) supaya Meta
        // mengirim ulang — pesan yang sudah tersimpan dilewati saat kiriman ulang.
        await this.inbox.ingestWebhook(body);
        return { ok: true };
    }
}
