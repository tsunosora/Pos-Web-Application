import { Body, Controller, Get, Post, Put, Res, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentBranch } from '../common/branch-context.decorator';
import { StudioAiService } from './studio-ai.service';

// Batas masukan ke AI (kuota berbayar): dulu teks & riwayat tanpa batas (body JSON sampai 10 MB).
const potong = (v: unknown, max: number) => String(v ?? '').slice(0, max);
const riwayatAman = (h: unknown) =>
  (Array.isArray(h) ? h : []).slice(-20).map((m: any) => ({ role: String(m?.role ?? ''), content: potong(m?.content, 4000) }));

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
    @Body() body: { enabled?: boolean; chatEnabled?: boolean; aiName?: string; aiGreeting?: string; aiAvatar?: string; baseUrl?: string; model?: string; apiKey?: string; clearApiKey?: boolean },
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
    return this.svc.ideas(potong(body?.idea, 2000), (body?.modes || []).slice(0, 20));
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
    return this.svc.fill(potong(body?.idea, 2000), potong(body?.modeLabel, 200), (body?.fields || []).slice(0, 40));
  }

  /** Asisten chat scoped ke toko ini (semua user login; HPP di-gate owner/admin). */
  @Post('chat')
  chat(
    @Body() body: { message: string; history?: { role: string; content: string }[] },
    @CurrentBranch() ctx: any,
  ) {
    return this.svc.chatAssistant(potong(body?.message, 4000), riwayatAman(body?.history), ctx?.roleName ?? null);
  }

  /**
   * Versi STREAMING dari /chat (Server-Sent Events). Mengirim token AI real-time
   * saat mengetik → frontend menampilkannya bertahap. Frame:
   *   event: token → data: "<potongan teks>"
   *   event: done  → data: { refused, products }
   *   event: error → data: { message }
   */
  @Post('chat/stream')
  async chatStream(
    @Body() body: { message: string; history?: { role: string; content: string }[] },
    @CurrentBranch() ctx: any,
    @Res() res: any,
  ) {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // cegah nginx buffer SSE
    res.flushHeaders?.();
    const sse = (event: string, data: any) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    try {
      const result = await this.svc.chatAssistantStream(
        potong(body?.message, 4000),
        riwayatAman(body?.history),
        ctx?.roleName ?? null,
        (delta) => sse('token', delta),
      );
      sse('done', { refused: result.refused, products: result.products });
    } catch (e: any) {
      sse('error', { message: e?.message || 'Gagal menghubungi asisten.' });
    } finally {
      res.end();
    }
  }
}
