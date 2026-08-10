import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StudioAiService } from './studio-ai.service';

/**
 * Endpoint AI untuk Studio Desain (butuh login POS — JWT).
 * Frontend (iframe studio) memanggil dengan Authorization: Bearer <token POS>.
 */
@UseGuards(JwtAuthGuard)
@Controller('studio-ai')
export class StudioAiController {
  constructor(private readonly svc: StudioAiService) {}

  /** Saran ide konten + rekomendasi mode. */
  @Post('ideas')
  ideas(@Body() body: { idea: string; modes: { id: string; label: string; desc?: string }[] }) {
    return this.svc.ideas(body?.idea, body?.modes || []);
  }

  /** Isi otomatis brief satu mode dari ide singkat. */
  @Post('fill')
  fill(
    @Body()
    body: {
      idea: string;
      modeLabel: string;
      fields: { key: string; type: any; options?: string[]; core?: boolean; hint?: string }[];
    },
  ) {
    return this.svc.fill(body?.idea, body?.modeLabel || '', body?.fields || []);
  }
}
