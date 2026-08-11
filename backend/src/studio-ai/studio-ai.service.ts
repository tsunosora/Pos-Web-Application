import { Injectable, Logger, ServiceUnavailableException, BadRequestException } from '@nestjs/common';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { APP_GUIDE } from './app-guide';

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
  enabled: boolean;       // master: fitur AI (autofill studio) aktif
  chatEnabled: boolean;   // sub: widget chat asisten aktif (bisa dimatikan terpisah)
  aiName: string;         // nama asisten (tampil di widget & persona chat)
  aiGreeting: string;     // sapaan pembuka di layar chat kosong
  aiAvatar: string;       // avatar: emoji ATAU URL gambar (kosong = ikon default)
  baseUrl: string;
  apiKey: string;
  model: string;
}

@Injectable()
export class StudioAiService {
  private readonly logger = new Logger(StudioAiService.name);

  constructor(private readonly prisma: PrismaService) {}

  private configPath(): string {
    if (process.env.STUDIO_AI_CONFIG_PATH) return process.env.STUDIO_AI_CONFIG_PATH;
    // cwd = root backend (pm2 exec cwd & npm dev), DI LUAR dist/. Penting: kalau
    // simpan di dalam dist/ (mis. __dirname = dist/src/studio-ai), file config
    // TERHAPUS tiap backend di-rebuild (dist/ diregenerasi) → AI mati diam-diam.
    return join(process.cwd(), 'storage', 'studio-ai-config.json');
  }

  private defaults(): AiConfig {
    return {
      enabled: process.env.AI_ENABLED === 'true',
      chatEnabled: process.env.AI_CHAT_ENABLED !== 'false', // default ON saat AI aktif
      aiName: process.env.AI_NAME || 'Asisten VolikoPrint',
      aiGreeting: process.env.AI_GREETING || 'Halo! Saya bantu seputar produk, harga, HPP, dan penggunaan aplikasi ini.',
      aiAvatar: process.env.AI_AVATAR || '',
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
        chatEnabled: typeof file.chatEnabled === 'boolean' ? file.chatEnabled : def.chatEnabled,
        aiName: typeof file.aiName === 'string' && file.aiName.trim() ? file.aiName : def.aiName,
        aiGreeting: typeof file.aiGreeting === 'string' && file.aiGreeting.trim() ? file.aiGreeting : def.aiGreeting,
        aiAvatar: typeof file.aiAvatar === 'string' ? file.aiAvatar : def.aiAvatar,
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
      chatEnabled: typeof patch.chatEnabled === 'boolean' ? patch.chatEnabled : cur.chatEnabled,
      aiName: typeof patch.aiName === 'string' && patch.aiName.trim() ? patch.aiName.trim() : cur.aiName,
      aiGreeting: typeof patch.aiGreeting === 'string' && patch.aiGreeting.trim() ? patch.aiGreeting.trim() : cur.aiGreeting,
      aiAvatar: typeof patch.aiAvatar === 'string' ? patch.aiAvatar.trim() : cur.aiAvatar,
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
      chatEnabled: c.chatEnabled,
      aiName: c.aiName,
      aiGreeting: c.aiGreeting,
      aiAvatar: c.aiAvatar,
      baseUrl: c.baseUrl,
      model: c.model,
      apiKeySet: !!c.apiKey,
      apiKeyMasked: this.mask(c.apiKey),
    };
  }

  /** Status ringkas utk semua user login (studio bar & widget chat gating). */
  async status() {
    const c = await this.readConfig();
    const usable = !!(c.enabled && c.baseUrl);
    return {
      enabled: usable,
      chatEnabled: usable && c.chatEnabled,
      model: c.model,
      aiName: c.aiName,
      aiGreeting: c.aiGreeting,
      aiAvatar: c.aiAvatar,
    };
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
      // Undici membungkus error jaringan di e.cause.code — inilah petunjuk akar masalah.
      const code = e?.cause?.code || e?.code || '';
      let host = cfg.baseUrl;
      try { host = new URL(cfg.baseUrl).host; } catch { /* keep as-is */ }
      const hint: Record<string, string> = {
        ECONNREFUSED: `Koneksi DITOLAK di ${host}. Host terjangkau tapi tak ada yang mendengar di port itu → 9router mati, atau bind ke 127.0.0.1 saja (jalankan dgn HOSTNAME=0.0.0.0).`,
        ETIMEDOUT: `TIMEOUT ke ${host}. Server tak bisa menjangkau host → Tailscale belum konek di kedua sisi, IP salah, atau firewall PC blokir port.`,
        EHOSTUNREACH: `Host ${host} TAK TERJANGKAU (routing/Tailscale down).`,
        ENETUNREACH: `Jaringan ke ${host} tak terjangkau (Tailscale/routing).`,
        ENOTFOUND: `Hostname ${host} TAK DITEMUKAN (DNS). Pakai IP Tailscale, bukan nama.`,
        EAI_AGAIN: `Gagal resolve DNS ${host}. Pakai IP Tailscale langsung.`,
        ECONNRESET: `Koneksi ke ${host} diputus (mungkin https↔http salah, atau reverse proxy).`,
      };
      const detail = hint[code] || `${code || e?.message || 'error tak dikenal'} → ${host}.`;
      this.logger.error(`AI upstream tidak terjangkau (${code}): ${e?.message} url=${cfg.baseUrl}`);
      throw new ServiceUnavailableException(`Server AI tidak terjangkau. ${detail}`);
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

  // ── Asisten Chat (scoped VolikoPrint) ───────────────────────────

  private static STOPWORDS = new Set([
    'harga', 'hpp', 'berapa', 'untuk', 'yang', 'dan', 'atau', 'produk', 'jual', 'modal',
    'margin', 'ada', 'apa', 'ini', 'itu', 'dengan', 'dari', 'saya', 'tolong', 'mohon',
    'bisa', 'cek', 'info', 'list', 'daftar', 'ukuran', 'warna', 'stok', 'stock', 'kah',
    'per', 'buah', 'pcs', 'meter', 'harganya', 'total', 'mau', 'pesan', 'order',
  ]);

  private keywords(msg: string): string[] {
    const toks = (msg || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 3 && !StudioAiService.STOPWORDS.has(w));
    return Array.from(new Set(toks)).slice(0, 6);
  }

  private rupiah(d: any): string {
    const n = Number(d?.toString?.() ?? d);
    return isNaN(n) ? '-' : `Rp${n.toLocaleString('id-ID')}`;
  }

  /** Cari produk dari kata kunci pesan → konteks teks (HPP hanya bila canHpp). */
  private async productContext(message: string, canHpp: boolean): Promise<string> {
    const kws = this.keywords(message);
    if (!kws.length) return '';
    let products: any[] = [];
    try {
      products = await this.prisma.product.findMany({
        where: { isActive: true, OR: kws.map((k) => ({ name: { contains: k } })) },
        select: {
          name: true,
          variants: { select: { variantName: true, sku: true, price: true, hpp: true, stock: true } },
        },
        take: 15,
      });
    } catch (e: any) {
      this.logger.error(`product search gagal: ${e?.message}`);
      return '';
    }
    const lines: string[] = [];
    for (const p of products) {
      for (const v of p.variants || []) {
        const vname = v.variantName || v.sku || '';
        const hpp = canHpp ? `, HPP ${this.rupiah(v.hpp)}` : '';
        lines.push(`- ${p.name}${vname ? ` (${vname})` : ''}: jual ${this.rupiah(v.price)}${hpp}, stok ${v.stock}`);
        if (lines.length >= 40) break;
      }
      if (lines.length >= 40) break;
    }
    return lines.join('\n');
  }

  /** Ringkasan katalog (nama produk per kategori) untuk penalaran/rekomendasi. */
  private async catalogOverview(): Promise<string> {
    let products: any[] = [];
    try {
      products = await this.prisma.product.findMany({
        where: { isActive: true },
        select: { name: true, category: { select: { name: true } } },
        orderBy: { name: 'asc' },
        take: 150,
      });
    } catch (e: any) {
      this.logger.error(`catalog overview gagal: ${e?.message}`);
      return '';
    }
    if (!products.length) return '';
    const byCat: Record<string, string[]> = {};
    for (const p of products) {
      const cat = p.category?.name || 'Lainnya';
      (byCat[cat] ||= []).push(p.name);
    }
    return Object.entries(byCat)
      .map(([cat, names]) => `• ${cat}: ${names.join(', ')}`)
      .join('\n');
  }

  private guideKeywords(msg: string): string[] {
    const drop = new Set([
      'yang', 'untuk', 'dari', 'atau', 'dengan', 'bagaimana', 'gimana', 'apa', 'apakah',
      'tolong', 'saya', 'ada', 'ini', 'itu', 'buat', 'mau', 'kah', 'cara', 'pakai', 'aplikasi', 'gmn',
    ]);
    return Array.from(
      new Set((msg || '').toLowerCase().split(/[^a-z0-9]+/i).filter((w) => w.length >= 3 && !drop.has(w))),
    ).slice(0, 8);
  }

  /** Retrieval panduan aplikasi: ambil section paling relevan dgn pertanyaan. */
  private guideContext(message: string): string {
    const kws = this.guideKeywords(message);
    if (!kws.length) return '';
    const sections = APP_GUIDE.split(/\n## /).map((s, i) => (i === 0 ? s : '## ' + s));
    return sections
      .map((sec) => {
        const low = sec.toLowerCase();
        let score = 0;
        for (const k of kws) if (low.includes(k)) score++;
        return { sec, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((s) => s.sec.trim())
      .join('\n\n');
  }

  /** Produk terdaftar yang namanya DISEBUT di jawaban AI → jadi card di chat. */
  private async recommendedCards(reply: string): Promise<any[]> {
    if (!reply) return [];
    let products: any[] = [];
    try {
      products = await this.prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true, name: true, imageUrl: true,
          category: { select: { name: true } },
          variants: { select: { price: true, variantImageUrl: true } },
        },
        take: 500,
      });
    } catch (e: any) {
      this.logger.error(`cards fetch gagal: ${e?.message}`);
      return [];
    }
    const low = reply.toLowerCase();
    const cards: any[] = [];
    for (const p of products) {
      if (!p.name || p.name.length < 4) continue;
      if (!low.includes(p.name.toLowerCase())) continue;
      const prices = (p.variants || [])
        .map((v: any) => Number(v.price?.toString?.() ?? v.price))
        .filter((n: number) => !isNaN(n));
      const min = prices.length ? Math.min(...prices) : null;
      const max = prices.length ? Math.max(...prices) : null;
      const priceLabel = min === null ? '' : min === max ? this.rupiah(min) : `${this.rupiah(min)} – ${this.rupiah(max)}`;
      const image = p.imageUrl || (p.variants || []).find((v: any) => v.variantImageUrl)?.variantImageUrl || null;
      cards.push({ id: p.id, name: p.name, category: p.category?.name || '', image, priceLabel });
      if (cards.length >= 6) break;
    }
    return cards;
  }

  /** Daftar topik panduan (semua heading ## ) — biar AI tahu cakupan sistem. */
  private guideToc(): string {
    return (APP_GUIDE.match(/^## .+$/gm) || []).map((h) => '- ' + h.replace(/^## /, '')).join('\n');
  }

  /**
   * Asisten chat scoped VolikoPrint dengan barrier 2 tahap:
   * (1) klasifikasi on-topic → kalau bukan, tolak; (2) retrieval + jawab.
   */
  async chatAssistant(
    message: string,
    history: { role: string; content: string }[],
    roleName: string | null,
  ): Promise<{ reply: string; refused: boolean; products: any[] }> {
    if (!message?.trim()) throw new BadRequestException('Pesan kosong.');
    const cfg = await this.requireEnabled();
    if (!cfg.chatEnabled) throw new ServiceUnavailableException('Chat asisten sedang dinonaktifkan oleh Owner.');
    const role = (roleName || '').toUpperCase();
    const canHpp = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'].includes(role);

    // ── Barrier tahap 1: klasifikasi topik ──
    const clsSystem = 'Kamu penjaga topik untuk asisten internal toko percetakan "VolikoPrint". Longgar tapi tegas. Jawab HANYA satu kata.';
    const clsUser =
      `Pesan user: "${message.trim()}"\n\n` +
      `Jawab "YA" jika pesan ini MASIH masuk akal dibahas asisten toko percetakan: produk/harga/HPP/stok, rekomendasi produk, ` +
      `hitung margin/diskon, ide promo/desain/marketing untuk toko ini, layanan pelanggan, operasional, memakai aplikasi POS ini, ` +
      `ATAU sekadar sapaan/basa-basi/tanya kemampuan asisten.\n` +
      `Jawab "TIDAK" HANYA jika jelas di luar itu (pengetahuan umum dunia, perusahaan lain, coding, politik, agama, gosip, tugas sekolah, dsb).\n` +
      `Kalau ragu, jawab "YA". Jawab HANYA "YA" atau "TIDAK".`;
    const verdict = (await this.chat(cfg, [
      { role: 'system', content: clsSystem },
      { role: 'user', content: clsUser },
    ], 0)).trim().toUpperCase();
    if (!verdict.startsWith('YA')) {
      return {
        refused: true,
        products: [],
        reply: 'Maaf, saya hanya membantu seputar VolikoPrint — produk, harga, HPP, perhitungan margin, dan penggunaan aplikasi ini. Silakan tanyakan hal terkait itu ya 🙏',
      };
    }

    // ── Tahap 2: retrieval + jawab ──
    const [ctxData, overview] = await Promise.all([
      this.productContext(message, canHpp),
      this.catalogOverview(),
    ]);
    const guide = this.guideContext(message);
    const sys = [
      `Kamu "${cfg.aiName}" — asisten internal toko percetakan VolikoPrint yang ramah, cerdas, dan enak diajak ngobrol. Bicara santai & manusiawi, boleh sedikit hangat/berempati. JANGAN kaku seperti robot. Kalau ditanya namamu, sebut "${cfg.aiName}".`,
      'Kamu BOLEH diajak berpikir & berdiskusi: menimbang pilihan, kasih rekomendasi beserta alasannya, bertanya balik kalau info kurang, dan memberi ide (promo, desain, cara jual, layanan pelanggan).',
      'Fokus: produk/harga/HPP/stok, rekomendasi produk, hitung harga/margin/diskon, ide untuk toko, dan cara pakai aplikasi ini. Kalau ada yang benar-benar keluar topik toko, tolak dengan halus & ramah lalu arahkan ke hal yang bisa kamu bantu.',
      'KEJUJURAN DATA:',
      '- Harga/HPP: pakai HANYA "DATA PRODUK TERKAIT". Jangan mengarang angka; kalau tak ketemu, bilang apa adanya & minta nama lebih spesifik atau tawarkan alternatif.',
      '- Rekomendasi produk: sarankan HANYA dari "DAFTAR PRODUK TERDAFTAR", tapi jelaskan kenapa cocok (kelebihan, buat kebutuhan apa) dengan bahasa yang mengalir.',
      '- Kamu SUDAH memahami sistem aplikasi ini dari "PANDUAN APLIKASI" + "DAFTAR TOPIK PANDUAN" di bawah — anggap itu pengetahuanmu sendiri. Untuk pertanyaan cara pakai/sistem, jawab LANGSUNG, jelas, & percaya diri, sebutkan menu/path-nya (mis. /inventory, /settings/users). JANGAN menyuruh user membuka halaman /help — kamulah asistennya.',
      '- Kalau suatu hal benar-benar TIDAK ada di panduan dan kamu tetap tidak yakin, JANGAN mengarang langkah/menu. Jujur bilang belum tersedia, lalu arahkan: untuk perbaikan bug atau permintaan tambah fitur, hubungi developer via WhatsApp wa.me/6289669180127 (089669180127).',
      canHpp ? '' : '- Jangan sebut/menerka HPP/modal; kalau ditanya, bilang hanya Owner/Admin yang bisa melihatnya.',
      'GAYA MENULIS (layar chat sempit — WAJIB rapi & mudah dibaca):',
      '- Ringkas. Paragraf pendek 1–2 kalimat, beri baris kosong antar bagian.',
      '- Kalau menawarkan/membandingkan beberapa produk, pakai poin diawali "- ", tebalkan nama produk dengan **Nama Produk**, sebutkan harga di baris yang sama bila ada.',
      '- Uang format Rupiah (mis. **Rp150.000**). JANGAN pakai tabel.',
    ].filter(Boolean).join('\n');
    const dataBlock =
      `DATA PRODUK TERKAIT (harga${canHpp ? '/HPP' : ''}, dari database):\n` +
      `${ctxData || '(tidak ada produk cocok dengan kata kunci pertanyaan)'}\n\n` +
      `DAFTAR PRODUK TERDAFTAR (untuk rekomendasi — HANYA boleh menyarankan dari daftar ini):\n` +
      `${overview || '(katalog kosong)'}` +
      (guide ? `\n\nPANDUAN APLIKASI — bagian relevan (jawab dari sini, sebut menu/path):\n${guide}` : '') +
      `\n\nDAFTAR TOPIK PANDUAN (cakupan sistem yang kamu kuasai):\n${this.guideToc()}`;

    const msgs: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
      { role: 'system', content: `${sys}\n\n${dataBlock}` },
    ];
    for (const h of Array.isArray(history) ? history.slice(-8) : []) {
      if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
        msgs.push({ role: h.role, content: h.content.slice(0, 4000) });
      }
    }
    msgs.push({ role: 'user', content: message.trim() });

    const reply = (await this.chat(cfg, msgs, 0.6)).trim();
    const products = await this.recommendedCards(reply);
    return { reply, refused: false, products };
  }
}
