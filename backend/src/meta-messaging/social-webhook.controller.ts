import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SocialInboxService } from './social-inbox.service';
import { verifyMetaSignature } from '../whatsapp-cloud/signature.util';
import { Logger } from '@nestjs/common';

/**
 * Webhook Messenger + Instagram (Messenger Platform). URL PUBLIK tanpa JWT.
 * Set di Meta App: callback = https://<domain>/social/webhook (fields: messages).
 * Verify token: META_VERIFY_TOKEN (fallback WA_VERIFY_TOKEN). Signature: WA_APP_SECRET.
 */
@Controller('social/webhook')
export class SocialWebhookController {
    private readonly logger = new Logger(SocialWebhookController.name);
    constructor(private readonly inbox: SocialInboxService) {}

    @Get()
    verify(@Query() query: Record<string, string>): string {
        const token = process.env.META_VERIFY_TOKEN || process.env.WA_VERIFY_TOKEN;
        if (query['hub.mode'] === 'subscribe' && query['hub.verify_token'] && query['hub.verify_token'] === token) {
            return query['hub.challenge'];
        }
        throw new ForbiddenException('verify_token tidak cocok');
    }

    @Post()
    @HttpCode(200)
    async receive(@Req() req: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature: string, @Body() body: any) {
        const appSecret = process.env.WA_APP_SECRET;
        const object = body?.object ?? null;
        const entries = Array.isArray(body?.entry) ? body.entry.length : 0;
        let signatureOk: boolean | null = null;
        if (appSecret) signatureOk = verifyMetaSignature(req.rawBody, signature, appSecret);
        // Catat SETIAP hit (termasuk yang gagal signature) untuk diagnosa.
        this.inbox.recordWebhookHit({ object, entries, signatureOk });
        this.logger.log(`Webhook social masuk: object=${object} entries=${entries} sig=${signatureOk}`);
        if (appSecret && !signatureOk) {
            this.logger.warn('Signature webhook social tidak valid — ditolak');
            return { ok: false };
        }
        await this.inbox.ingestWebhook(body);
        return { ok: true };
    }
}
