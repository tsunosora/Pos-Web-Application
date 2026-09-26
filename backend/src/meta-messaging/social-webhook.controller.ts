import { Body, Controller, ForbiddenException, Get, Headers, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SocialInboxService } from './social-inbox.service';
import { SocialCommentsService } from './social-comments.service';
import { verifyMetaSignature } from '../whatsapp-cloud/signature.util';
import { Logger } from '@nestjs/common';

/**
 * Webhook Messenger + Instagram (Messenger Platform). URL PUBLIK tanpa JWT.
 * Set di Meta App: callback = https://<domain>/social/webhook (fields: messages,
 * comments untuk Instagram; messages, feed untuk Facebook Page).
 * Verify token: META_VERIFY_TOKEN (fallback WA_VERIFY_TOKEN). Signature: IG_APP_SECRET
 * (Instagram API with Instagram Login) atau WA_APP_SECRET (aplikasi Meta).
 *
 * JANGAN PERNAH dijaga `@ButuhFitur` (mis. `social.inbox` seperti `/social` yang lain):
 * Meta memanggilnya tanpa sesi pengguna, dan 403 membuat Meta menonaktifkan webhooknya →
 * DM & komentar masuk hilang tanpa jejak. Kelasnya sengaja terpisah dari
 * `MetaMessagingController` supaya dekorator di sana tidak pernah sampai ke sini.
 */
@Controller('social/webhook')
export class SocialWebhookController {
    private readonly logger = new Logger(SocialWebhookController.name);
    constructor(
        private readonly inbox: SocialInboxService,
        private readonly comments: SocialCommentsService,
    ) {}

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
        // "Instagram API with Instagram Login" menandatangani webhook dengan
        // Instagram App Secret — BERBEDA dari App Secret aplikasi Meta yang dipakai
        // WhatsApp/Messenger. Dulu hanya WA_APP_SECRET yang dicoba, sehingga semua
        // webhook Instagram ditolak (sig=false). Kini keduanya dicoba.
        const secrets = [
            ['IG_APP_SECRET', process.env.IG_APP_SECRET],
            ['WA_APP_SECRET', process.env.WA_APP_SECRET],
        ].filter((s): s is [string, string] => !!s[1]);
        const object = body?.object ?? null;
        const entries = Array.isArray(body?.entry) ? body.entry.length : 0;
        const fields = Array.isArray(body?.entry)
            ? [...new Set(body.entry.flatMap((e: any) => [
                ...(Array.isArray(e?.messaging) ? ['messaging'] : []),
                ...(Array.isArray(e?.changes) ? e.changes.map((c: any) => c?.field) : []),
            ]))].join(',')
            : '';
        let signatureOk: boolean | null = null;
        let secretUsed: string | null = null;
        if (secrets.length) {
            const cocok = secrets.find(([, s]) => verifyMetaSignature(req.rawBody, signature, s));
            signatureOk = !!cocok;
            secretUsed = cocok ? cocok[0] : null;
        }
        // Catat SETIAP hit (termasuk yang gagal signature) untuk diagnosa.
        this.inbox.recordWebhookHit({ object, entries, fields, signatureOk });
        this.logger.log(`Webhook social masuk: object=${object} entries=${entries} fields=${fields || '-'} sig=${signatureOk}${secretUsed ? ` (${secretUsed})` : ''}`);
        if (secrets.length && !signatureOk) {
            this.logger.warn(`Signature webhook social tidak valid — ditolak (dicoba: ${secrets.map(([n]) => n).join(', ')})`);
            return { ok: false };
        }
        await this.inbox.ingestWebhook(body);
        await this.comments.ingestWebhook(body);
        return { ok: true };
    }
}
