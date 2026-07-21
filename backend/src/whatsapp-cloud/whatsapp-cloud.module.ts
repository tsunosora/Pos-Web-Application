import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudApiService } from './cloud-api.service';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { WhatsappCloudController } from './whatsapp-cloud.controller';
import { WhatsappWebhookController } from './webhook.controller';
import { InboxService } from './inbox.service';

/**
 * WhatsApp CRM via Cloud API resmi Meta (Graph API).
 * TERPISAH dari modul lama `../whatsapp` (whatsapp-web.js, tidak resmi).
 * Rilis pertama = Fase 0–4 (inbox + sinkron CRM). Lihat README.md.
 */
@Module({
  imports: [PrismaModule],
  controllers: [WhatsappCloudController, WhatsappWebhookController],
  providers: [CloudApiService, WhatsappCloudService, InboxService],
  exports: [CloudApiService, WhatsappCloudService, InboxService],
})
export class WhatsappCloudModule {}
