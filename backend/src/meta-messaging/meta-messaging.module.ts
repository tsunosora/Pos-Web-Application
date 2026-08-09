import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MetaApiService } from './meta-api.service';
import { SocialInboxService } from './social-inbox.service';
import { MetaMessagingController } from './meta-messaging.controller';
import { SocialWebhookController } from './social-webhook.controller';

/**
 * Inbox sosial: Instagram DM + Facebook Messenger (Messenger Platform / Graph API).
 * Terpisah dari WhatsApp Cloud. Fase 1: terima pesan (webhook) + balas + inbox dasar.
 */
@Module({
    imports: [PrismaModule],
    controllers: [MetaMessagingController, SocialWebhookController],
    providers: [MetaApiService, SocialInboxService],
    exports: [SocialInboxService],
})
export class MetaMessagingModule {}
