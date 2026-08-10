import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';

/**
 * Proxy AI untuk Studio Desain.
 *
 * Memanggil endpoint OpenAI-compatible (`/v1/chat/completions`) — kompatibel
 * dengan 9router (github.com/decolua/9router), OpenRouter, OpenAI, dst.
 * API key HANYA hidup di server (config runtime), tak pernah ke browser.
 *
 * KONFIGURASI RUNTIME (diatur Owner via panel, disimpan sebagai file JSON —
 * TANPA perubahan schema Prisma):
 *   { enabled, baseUrl, apiKey, model }
 * Path file: env STUDIO_AI_CONFIG_PATH, default <backend>/storage/studio-ai-config.json
 *
 * Skema field tiap mode dikirim FRONTEND, jadi backend tetap generic.
 */

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string };

interface FieldSpec {
  key: string;
  type: 'text' | 'enum' | 'color' | 'boolean' | 'number' | 'array';
  options?: string[];
  core?: boolean;
  hint?: string;
}

interface ModeInfo { id: string; label: string; desc?: string }

export interface AiConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  model: string;
}

@Injectable()
export class StudioAiService {
  private readonly logger = new Logger(StudioAiService.name);

  private configPath(): string {
    if (process.env.STUDIO_AI_CONFIG_PATH) return process.env.STUDIO_AI_CONFIG_PATH;
    // __dirname runtime = <backend>/dist/studio-ai → naik 2 = <backend>
    return join(__dirname, '..', '..', 'storage', 'studio-ai-config.json');
  }

  private defaults(): AiConfig {
    return {
      enabled: process.env.AI_ENABLED === 'true',
      baseUrl: (process.env.AI_BASE_URL || 'http://localhost:20128/v1').replace(/\/$/, ''),
      apiKey: process.env.AI_API_KEY || '',
      model: process.env.AI_MODEL || 'cc/claude-sonnet-4-5',
    };
  }

  /** Baca config runtime (file JSON di-merge di atas default env). */
  async readConfig(): Promise<AiConfig> {
    const def = this.defaults();
    try {
      const raw = await fs.readFile(this.configPath(), 'utf8');
      const file = JSON.parse(raw) || {};
      return {
        enabled: typeof file.enabled === 'boolean' ? file.enabled : def.enabled,
        baseUrl: (file.baseUrl || def.baseUrl).replace(/\/$/, ''),
        apiKey: typeof file.apiKey === 'string' ? file.apiKey : def.apiKey,
        model: file.model || def.model,
      };
    } catch {
      return def; // file belum ada → pakai default env
    }
  }

  /** Tulis config runtime (merge parsial). Hanya field dikenal yang disimpan. */
  async writeConfig(patch: Partial<AiConfig> & { clearApiKey?: boolean }): Promise<AiConfig> {
    const cur = await this.readConfig();
    const next: AiConfig = {
      enabled: typeof patch.enabled === 'boolean' ? patch.enabled : cur.enabled,
      baseUrl: typeof patch.baseUrl === 'string' && patch.baseUrl.trim()
        ? patch.baseUrl.trim().replace(/\/$/, '') : cur.baseUrl,
      model: typeof patch.model === 'string' && patch.model.trim() ? patch.model.trim() : cur.model,
      // apiKey: hanya ganti kalau string non-kosong dikirim; clearApiKey → kosongkan.
      apiKey: patch.clearApiKey
        ? ''
        : (typeof patch.apiKey === 'string' && patch.apiKey.trim() ? patch.apiKey.trim() : cur.apiKey),
    };
    const p = this.configPath();
    await fs.mkdir(dirname(p), { recursive: true });
    await fs.writeFile(p, JSON.stringify(next, null, 2), 'utf8');
    return next;
  }

  private mask(key: string): string {
    if (!key) return '';
    if (key.length <= 8) return '••••';
    return `${key.slice(0, 4)}••••${key.slice(-4)}`;
  }

  /** Config utk panel Owner (apiKey DISAMARKAN). */
  async configForOwner() {
    const c = await this.readConfig();
    return {
      enabled: c.enabled,
      baseUrl: c.baseUrl,
      model: c.model,
      apiKeySet: !!c.apiKey,
      apiKeyMasked: this.mask(c.apiKey),
    };
  }

  /** Status ringkas utk semua user login (studio menampilkan/menyembunyikan bar). */
  async status() {
    const c = await this.readConfig();
    return { enabled: !!(c.enabled && c.baseUrl), model: c.model };
  }

  /** Tes koneksi ke endpoint AI (dipanggil Owner). Tidak melempar — kembalikan {ok,message}. */
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    const c = await this.readConfig();
    if (!c.baseUrl) return { ok: false, message: 'Base URL belum diisi.' };
    try {
      const out = await this.chat(c, [{ role: 'user', content: 'Balas hanya dengan kata: OK' }], 0);
      return { ok: true, message: `Terhubung. Balasan model: "${out.trim().slice(0, 40)}"` };
    } catch (e: any) {
      return { ok: false, message: e?.message || 'Gagal terhubung.' };
    }
  }

  /** Panggil chat completion (non-stream) dan kembalikan teks jawaban. */
  private async chat(cfg: AiConfig, messages: ChatMsg[], temperature = 0.7): Promise<string> {
    const doFetch: any = (globalThis as any).fetch;
    if (!doFetch) throw new ServiceUnavailableException('fetch tidak tersedia (butuh Node 18+)');

    let res: any;
    try {
      res = await doFetch(`${cfg.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: cfg.model, messages, temperature, stream: false }),
      });
    } catch (e: any) {
      this.logger.error(`AI upstream tidak terjangkau: ${e?.message}`);
      throw new ServiceUnavailableException(
        'Server AI tidak terjangkau. Pastikan 9router berjalan & Base URL benar (mis. IP Tailscale PC).',
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.error(`AI upstream ${res.status}: ${body.slice(0, 500)}`);
      throw new ServiceUnavailableException(`AI upstream error (${res.status}). Cek token/model 9router.`);
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new ServiceUnavailableException('Format balasan AI tak dikenali.');
    return content;
  }

  /** Ambil objek/array JSON pertama dari teks (toleran code-fence / teks tambahan). */
  private parseJson<T = any>(raw: string): T {
    let s = raw.trim();
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1].trim();
    const start = s.search(/[[{]/);
    if (start === -1) throw new ServiceUnavailableException('AI tidak mengembalikan JSON.');
    const open = s[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0, end = -1;
    for (let i = start; i < s.length; i++) {
      if (s[i] === open) depth++;
      else if (s[i] === close) { depth--; if (depth === 0) { end = i; break; } }
    }
    const slice = end === -1 ? s.slice(start) : s.slice(start, end + 1);
    try { return JSON.parse(slice); }
    catch { throw new ServiceUnavailableException('AI mengembalikan JSON tidak valid.'); }
  }

  /** Pastikan AI aktif & terkonfigurasi sebelum dipakai. */
  private async requireEnabled(): Promise<AiConfig> {
    const c = await this.readConfig();
    if (!c.enabled) throw new ServiceUnavailableException('AI Studio sedang nonaktif. Aktifkan di menu Owner.');
    if (!c.baseUrl) throw new ServiceUnavailableException('AI Studio belum dikonfigurasi (Base URL kosong).');
    return c;
  }

  /** Saran ide konten + rekomendasi mode. */
  async ideas(idea: string, modes: ModeInfo[]): Promise<{ ideas: any[] }> {
    if (!idea?.trim()) throw new BadRequestException('Ide/brief kosong.');
    const cfg = await this.requireEnabled();
    const modeList = (modes || [])
      .map((m) => `- ${m.id}: ${m.label}${m.desc ? ` — ${m.desc}` : ''}`)
      .join('\n');

    const system =
      'Kamu adalah content strategist untuk bisnis percetakan & desain di Indonesia. ' +
      'Tugasmu mengusulkan ide konten sosial media yang menjual. ' +
      'Balas HANYA JSON valid, tanpa penjelasan, tanpa code fence.';
    const user =
      `Ide/produk dari user: "${idea.trim()}"\n\n` +
      `Mode konten yang tersedia:\n${modeList}\n\n` +
      `Buat 4 ide konten berbeda. Untuk tiap ide pilih SATU modeId paling cocok dari daftar di atas.\n` +
      `Balas array JSON: [{"title": "...", "hook": "...", "modeId": "...", "reason": "..."}].\n` +
      `title = judul ide singkat, hook = kalimat pembuka menarik, reason = alasan singkat (<=12 kata). Bahasa Indonesia.`;

    const raw = await this.chat(cfg, [{ role: 'system', content: system }, { role: 'user', content: user }], 0.8);
    const arr = this.parseJson<any[]>(raw);
    const validIds = new Set((modes || []).map((m) => m.id));
    const ideas = (Array.isArray(arr) ? arr : [])
      .filter((x) => x && typeof x.title === 'string')
      .map((x) => ({
        title: String(x.title).slice(0, 120),
        hook: String(x.hook || '').slice(0, 200),
        modeId: validIds.has(x.modeId) ? x.modeId : (modes?.[0]?.id ?? ''),
        reason: String(x.reason || '').slice(0, 120),
      }))
      .slice(0, 6);
    return { ideas };
  }

  /** Isi otomatis brief satu mode. `fields` = spesifikasi dari frontend. */
  async fill(idea: string, modeLabel: string, fields: FieldSpec[]): Promise<{ values: Record<string, any> }> {
    if (!idea?.trim()) throw new BadRequestException('Ide/brief kosong.');
    if (!Array.isArray(fields) || !fields.length) throw new BadRequestException('Skema field kosong.');
    const cfg = await this.requireEnabled();

    const spec = fields
      .map((f) => {
        const base = `- "${f.key}" (${f.type})${f.core ? ' [INTI]' : ''}${f.hint ? ` — ${f.hint}` : ''}`;
        if (f.type === 'enum' && f.options?.length) {
          return `${base}\n    pilih SATU persis dari: ${f.options.map((o) => JSON.stringify(o)).join(', ')}`;
        }
        if (f.type === 'color') return `${base} — nilai hex, mis "#2dd4bf"`;
        if (f.type === 'boolean') return `${base} — true/false`;
        if (f.type === 'array') return `${base} — array string pendek (maks 5)`;
        if (f.type === 'number') return `${base} — angka`;
        return base;
      })
      .join('\n');

    const system =
      'Kamu adalah creative director yang mengisi brief desain untuk bisnis Indonesia. ' +
      'Isi SEMUA field semenarik & sepersuasif mungkin, konsisten satu sama lain. ' +
      'Untuk field enum, WAJIB pilih salah satu nilai yang diizinkan PERSIS. ' +
      'Field teks tulis dalam Bahasa Indonesia yang menjual (kecuali istilah teknis). ' +
      'Balas HANYA satu objek JSON valid, tanpa penjelasan, tanpa code fence.';
    const user =
      `Mode: ${modeLabel}\n` +
      `Ide/produk dari user: "${idea.trim()}"\n\n` +
      `Field yang harus diisi:\n${spec}\n\n` +
      `Balas objek JSON dengan tepat key-key di atas sebagai propertinya.`;

    const raw = await this.chat(cfg, [{ role: 'system', content: system }, { role: 'user', content: user }], 0.7);
    const obj = this.parseJson<Record<string, any>>(raw);

    const values: Record<string, any> = {};
    for (const f of fields) {
      if (!(f.key in (obj || {}))) continue;
      const v = obj[f.key];
      if (v === null || v === undefined) continue;
      switch (f.type) {
        case 'enum':
          if (f.options?.length) {
            const match = f.options.find((o) => String(o).toLowerCase() === String(v).toLowerCase());
            if (match) values[f.key] = match;
          }
          break;
        case 'boolean':
          values[f.key] = v === true || v === 'true';
          break;
        case 'number':
          if (!isNaN(Number(v))) values[f.key] = Number(v);
          break;
        case 'array':
          values[f.key] = Array.isArray(v)
            ? v.map((x) => String(x)).slice(0, 8)
            : String(v).split(/[,\n]/).map((x) => x.trim()).filter(Boolean).slice(0, 8);
          break;
        case 'color':
          if (/^#?[0-9a-fA-F]{3,8}$/.test(String(v))) values[f.key] = String(v).startsWith('#') ? String(v) : `#${v}`;
          break;
        default:
          values[f.key] = String(v);
      }
    }
    return { values };
  }
}
