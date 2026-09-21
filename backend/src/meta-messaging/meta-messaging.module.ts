import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MetaApiService } from './meta-api.service';
import { SocialInboxService } from './social-inbox.service';
import { SocialCommentsService } from './social-comments.service';
import { LeadsModule } from '../crm/leads/leads.module';
import { MetaMessagingController } from './meta-messaging.controller';
import { SocialWebhookController } from './social-webhook.controller';

/**
 * Inbox sosial: Instagram DM + Facebook Messenger (Messenger Platform / Graph API).
 * Terpisah dari WhatsApp Cloud. DM (webhook messages) + komentar postingan
 * (webhook comments/feed): terima, balas publik / lewat DM, sembunyikan.
 */
@Module({
    imports: [PrismaModule, LeadsModule],
    controllers: [MetaMessagingController, SocialWebhookController],
    providers: [MetaApiService, SocialInboxService, SocialCommentsService],
    exports: [SocialInboxService],
})
export class MetaMessagingModule {}
