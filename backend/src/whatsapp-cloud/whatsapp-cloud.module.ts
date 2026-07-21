import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudApiService } from './cloud-api.service';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { WhatsappCloudController } from './whatsapp-cloud.controller';
import { WhatsappWebhookController } from './webhook.controller';
import { InboxService } from './inbox.service';
import { TemplatesService } from './templates.service';

/**
 * WhatsApp CRM via Cloud API resmi Meta (Graph API).
 * TERPISAH dari modul lama `../whatsapp` (whatsapp-web.js, tidak resmi).
 * Fase 0–4 inbox + sinkron CRM; Fase 5 template Meta.
 */
@Module({
  imports: [PrismaModule],
  controllers: [WhatsappCloudController, WhatsappWebhookController],
  providers: [CloudApiService, WhatsappCloudService, InboxService, TemplatesService],
  exports: [CloudApiService, WhatsappCloudService, InboxService, TemplatesService],
})
export class WhatsappCloudModule {}
