import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentBranch } from '../common/branch-context.decorator';
import { StudioAiService } from './studio-ai.service';

const OWNER_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN'];

/**
 * Endpoint AI Studio Desain (butuh login POS — JWT).
 * - config/test: Owner-only (kelola token 9router).
 * - status/ideas/fill: semua user login (dipakai desainer di iframe studio).
 */
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('studio-ai')
export class StudioAiController {
  constructor(private readonly svc: StudioAiService) {}

  // ── Config (Owner) ──────────────────────────────────────────
  @Get('config')
  @Roles(...OWNER_ROLES)
  getConfig() {
    return this.svc.configForOwner();
  }

  @Put('config')
  @Roles(...OWNER_ROLES)
  updateConfig(
    @Body() body: { enabled?: boolean; chatEnabled?: boolean; aiName?: string; baseUrl?: string; model?: string; apiKey?: string; clearApiKey?: boolean },
  ) {
    return this.svc.writeConfig(body || {}).then(() => this.svc.configForOwner());
  }

  @Post('test')
  @Roles(...OWNER_ROLES)
  test() {
    return this.svc.testConnection();
  }

  // ── Pemakaian (semua user login) ────────────────────────────
  @Get('status')
  status() {
    return this.svc.status();
  }

  @Post('ideas')
  ideas(@Body() body: { idea: string; modes: { id: string; label: string; desc?: string }[] }) {
    return this.svc.ideas(body?.idea, body?.modes || []);
  }

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

  /** Asisten chat scoped VolikoPrint (semua user login; HPP di-gate owner/admin). */
  @Post('chat')
  chat(
    @Body() body: { message: string; history?: { role: string; content: string }[] },
    @CurrentBranch() ctx: any,
  ) {
    return this.svc.chatAssistant(body?.message, body?.history || [], ctx?.roleName ?? null);
  }
}
