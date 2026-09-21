import { BadRequestException, Body, Controller, ForbiddenException, Get, Header, HttpCode, Logger, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { appendFile, mkdir, readFile } from 'fs/promises';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';

const LOG_FILE = join(process.cwd(), 'storage', 'meta-data-deletion.jsonl');

interface DeletionRecord {
    at: string;
    code: string;
    userId: string | null;
    secret: string;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
const b64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Data Deletion Callback Meta (Pengaturan aplikasi → Dasar → Penghapusan Data
 * Pengguna → URL Callback). URL PUBLIK tanpa JWT:
 *   POST https://<api>/social/data-deletion  (form: signed_request=…)
 * Meta mengirim `signed_request` saat pengguna meminta datanya dihapus; kita
 * wajib menjawab JSON { url, confirmation_code }. ID di dalamnya adalah ID
 * pengguna berlingkup aplikasi — tidak sama dengan ID kontak DM/komentar yang kita
 * simpan — jadi permintaan dicatat + dikabarkan ke Discord untuk diproses staf
 * (paling lambat 30 hari, sesuai halaman /hapus-data).
 */
@Controller('social/data-deletion')
export class DataDeletionController {
    private readonly logger = new Logger(DataDeletionController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly discord: DiscordService,
    ) {}

    @Post()
    @HttpCode(200)
    async request(@Req() req: Request, @Body() body: any) {
        const signed: string | undefined = body?.signed_request;
        if (!signed) throw new BadRequestException('signed_request wajib diisi');
        const parsed = this.parseSignedRequest(signed);
        if (!parsed) throw new ForbiddenException('signed_request tidak valid');

        const code = randomBytes(5).toString('hex').toUpperCase();
        const rec: DeletionRecord = { at: new Date().toISOString(), code, userId: parsed.data.user_id ? String(parsed.data.user_id) : null, secret: parsed.secret };
        await mkdir(join(process.cwd(), 'storage'), { recursive: true });
        await appendFile(LOG_FILE, JSON.stringify(rec) + '\n');
        this.logger.log(`Permintaan hapus data Meta diterima: kode=${code} (${parsed.secret})`);
        this.discord
            .send('error', {
                title: '🗑️ Permintaan hapus data dari Meta',
                description: `Seseorang meminta datanya dihapus lewat Facebook/Instagram.\nKode konfirmasi: **${code}**\nID pengguna (lingkup aplikasi): ${rec.userId ?? '-'}`,
                color: 0xf59e0b,
                footer: 'PosPro · Proses paling lambat 30 hari (lihat halaman /hapus-data)',
            })
            .catch(() => undefined);

        // Di balik Cloudflare: protokol asli ada di x-forwarded-proto (sama seperti tautan media WA).
        const proto = String(req.get('x-forwarded-proto') || req.protocol).split(',')[0].trim();
        const base = (process.env.PUBLIC_BASE_URL || `${proto}://${req.get('host')}`).replace(/\/+$/, '');
        const statusUrl = `${base}/social/data-deletion?kode=${code}`;
        return { url: statusUrl, confirmation_code: code };
    }

    /** Halaman status yang dibuka pengguna dari tautan Meta. */
    @Get()
    @Header('Content-Type', 'text/html; charset=utf-8')
    async status(@Query('kode') kode?: string) {
        const store = await this.prisma.storeSettings.findFirst({ select: { storeName: true, storePhone: true } }).catch(() => null);
        const name = esc(store?.storeName || 'Toko kami');
        const phone = store?.storePhone ? esc(store.storePhone) : null;
        const clean = (kode || '').toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 20);
        const found = clean ? await this.findRecord(clean) : null;
        const isi = !clean
            ? `<p>Halaman ini menampilkan status permintaan penghapusan data yang dikirim lewat Facebook/Instagram.</p>`
            : found
                ? `<p>Permintaan penghapusan data Anda <b>sudah kami terima</b> pada ${esc(new Date(found.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }))} WIB.</p>
                   <p>Kode konfirmasi: <b style="font-size:1.3em;letter-spacing:.08em">${clean}</b></p>
                   <p>Data Anda akan dihapus paling lambat <b>30 hari</b>.${phone ? ` Pertanyaan dapat disampaikan ke WhatsApp ${phone} dengan menyebut kode ini.` : ''}</p>
                   <p lang="en" style="color:#555">Your data deletion request was received. Confirmation code: <b>${clean}</b>. It will be processed within 30 days.</p>`
                : `<p>Kode <b>${esc(clean)}</b> tidak ditemukan.${phone ? ` Hubungi WhatsApp ${phone}.` : ''}</p>`;
        return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Status Penghapusan Data — ${name}</title></head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.6;color:#111">
<p style="color:#4f46e5;font-weight:600;margin:0">${name}</p><h1 style="margin:.2em 0 1em">Status Penghapusan Data</h1>${isi}</body></html>`;
    }

    /** Verifikasi `signed_request` (HMAC-SHA256 atas payload base64url) dengan App Secret Meta / Instagram. */
    private parseSignedRequest(signed: string): { data: any; secret: string } | null {
        const [sig, payload] = signed.split('.', 2);
        if (!sig || !payload) return null;
        let data: any;
        try {
            data = JSON.parse(b64url(payload).toString('utf8'));
        } catch {
            return null;
        }
        if (String(data?.algorithm || '').toUpperCase() !== 'HMAC-SHA256') return null;
        const got = b64url(sig);
        for (const [name, secret] of [['WA_APP_SECRET', process.env.WA_APP_SECRET], ['IG_APP_SECRET', process.env.IG_APP_SECRET]] as const) {
            if (!secret) continue;
            const want = createHmac('sha256', secret).update(payload).digest();
            if (want.length === got.length && timingSafeEqual(want, got)) return { data, secret: name };
        }
        return null;
    }

    private async findRecord(code: string): Promise<DeletionRecord | null> {
        const text = await readFile(LOG_FILE, 'utf8').catch(() => '');
        for (const line of text.split('\n').reverse()) {
            try {
                const r = JSON.parse(line) as DeletionRecord;
                if (r.code === code) return r;
            } catch {
                /* baris rusak dilewati */
            }
        }
        return null;
    }
}
