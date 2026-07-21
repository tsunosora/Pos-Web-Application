import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CloudApiService } from './cloud-api.service';
import { WhatsappCloudService } from './whatsapp-cloud.service';
import { WhatsappCloudController } from './whatsapp-cloud.controller';

/**
 * WhatsApp CRM via Cloud API resmi Meta (Graph API).
 * TERPISAH dari modul lama `../whatsapp` (whatsapp-web.js, tidak resmi).
 * Rilis pertama = Fase 0–4 (inbox + sinkron CRM). Lihat README.md.
 */
@Module({
  imports: [PrismaModule],
  controllers: [WhatsappCloudController],
  providers: [CloudApiService, WhatsappCloudService],
  exports: [CloudApiService, WhatsappCloudService],
})
export class WhatsappCloudModule {}
