import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

/**
 * WhatsApp CRM via Cloud API resmi Meta (Graph API).
 * TERPISAH dari modul lama `../whatsapp` (whatsapp-web.js, tidak resmi).
 * Rilis pertama = Fase 0–4 (inbox + sinkron CRM). Lihat README.md.
 */
@Module({
  imports: [PrismaModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class WhatsappCloudModule {}
