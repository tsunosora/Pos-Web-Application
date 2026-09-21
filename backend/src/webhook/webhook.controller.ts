import { Controller, Post, Headers, Body, HttpCode, Req } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Controller('webhook')
export class WebhookController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly notificationsService: NotificationsService,
    ) { }

    @Post('github')
    @HttpCode(200)
    async handleGithub(
        @Headers('x-hub-signature-256') signature: string,
        @Headers('x-github-event') event: string,
        @Body() payload: any,
        @Req() req: any,
    ) {
        const settings = await this.prisma.storeSettings.findFirst();
        const secret = (settings as any)?.githubWebhookSecret;

        // Verifikasi signature jika secret sudah di-set
        if (secret) {
            if (!signature) return { ok: false };
            // Tanda tangan GitHub dihitung atas body MENTAH — JSON.stringify ulang tak selalu sama
            // (spasi/urutan), jadi kiriman asli bisa ditolak.
            const expected = 'sha256=' + createHmac('sha256', secret)
                .update(req?.rawBody ?? Buffer.from(JSON.stringify(payload)))
                .digest('hex');
            try {
                const sigBuf = Buffer.from(signature);
                const expBuf = Buffer.from(expected);
                if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
                    return { ok: false };
                }
            } catch {
                return { ok: false };
            }
        }

        // Hanya proses event push (commit)
        if (event === 'push' && payload?.commits?.length > 0) {
            // Cek apakah notif github commit diaktifkan
            if ((settings as any)?.notifyGithubCommit === false) return { ok: true };

            const pusher = payload.pusher?.name || 'Developer';
            const branch = (payload.ref as string)?.replace('refs/heads/', '') || 'main';
            const commitMsg = payload.commits[0]?.message?.split('\n')[0] || 'Update';
            const commitCount = payload.commits.length;

            this.notificationsService.emit({
                type: 'update',
                title: `🔄 Pembaruan Aplikasi`,
                message: `${pusher} push ${commitCount} commit ke ${branch}: "${commitMsg}"`,
            });

            // Forward ke Discord jika diset
            const discordUrl = (settings as any)?.discordWebhookUrl;
            if (discordUrl) {
                await this.notificationsService.sendToDiscord(
                    discordUrl,
                    `🔄 **Pembaruan Aplikasi**\n👤 ${pusher} push **${commitCount}** commit ke \`${branch}\`\n📝 ${commitMsg}`,
                );
            }
        }

        return { ok: true };
    }
}
