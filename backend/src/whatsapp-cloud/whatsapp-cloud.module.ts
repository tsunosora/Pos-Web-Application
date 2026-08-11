import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudApiService } from './cloud-api.service';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { WhatsappCloudController } from './whatsapp-cloud.controller';
import { WhatsappWebhookController } from './webhook.controller';
import { InboxService } from './inbox.service';
import { MediaStorageService } from './media-storage.service';
import { TemplatesService } from './templates.service';
import { BroadcastService } from './broadcast.service';
import { AutoReplyService } from './auto-reply.service';
import { RemindersService } from './reminders.service';
import { AnalyticsService } from './analytics.service';
import { WaQrService } from './qr.service';
import { WaQuickReplyService } from './quick-reply.service';
import { CatalogService } from './catalog.service';
import { WaEventsService } from './wa-events.service';
import { WaSseAuthGuard } from './wa-sse-auth.guard';

/**
 * WhatsApp CRM via Cloud API resmi Meta (Graph API).
 * TERPISAH dari modul lama `../whatsapp` (whatsapp-web.js, tidak resmi).
 * Fase 0–4 inbox; 5 template; 6 broadcast; 7 auto-reply; 8 reminder; 9 analitik.
 */
@Module({
  imports: [PrismaModule],
  controllers: [WhatsappCloudController, WhatsappWebhookController],
  providers: [CloudApiService, WhatsappCloudService, InboxService, MediaStorageService, TemplatesService, BroadcastService, AutoReplyService, RemindersService, AnalyticsService, WaQrService, WaQuickReplyService, CatalogService, WaEventsService, WaSseAuthGuard],
  exports: [CloudApiService, WhatsappCloudService, InboxService, MediaStorageService, TemplatesService, BroadcastService, AutoReplyService, RemindersService, AnalyticsService, WaQrService, WaQuickReplyService, CatalogService, WaEventsService],
})
export class WhatsappCloudModule {}
