import { Injectable, Logger } from '@nestjs/common';

export interface WaSendResult {
    waMessageId: string | null;
}

export interface WaPhoneInfo {
    verifiedName?: string;
    displayNumber?: string;
}

/**
 * Klien tipis untuk WhatsApp Business Cloud API resmi Meta (Graph API).
 * PER CABANG: setiap method menerima `phoneNumberId` (dari WaChannel), token
 * System User level-Business diambil dari env (WA_ACCESS_TOKEN).
 *
 * Tanpa dependensi HTTP tambahan — pakai `fetch` global (Node 20+) & process.env,
 * mengikuti pola modul lain di proyek.
 */
@Injectable()
export class CloudApiService {
    private readonly logger = new Logger(CloudApiService.name);

    /** true kalau integrasi diaktifkan (env). */
    get enabled(): boolean {
        return (process.env.WA_CLOUD_ENABLED || '').toLowerCase() === 'true';
    }

    private get version(): string {
        return process.env.WA_GRAPH_VERSION || 'v23.0';
    }

    private get token(): string {
        return process.env.WA_ACCESS_TOKEN || '';
    }

    private url(path: string): string {
        return `https://graph.facebook.com/${this.version}/${path}`;
    }

    /** Panggilan Graph API generik dengan penanganan error terbaca. */
    private async graph(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<any> {
        if (!this.token) {
            throw new Error('WA_ACCESS_TOKEN belum diset');
        }
        const res = await fetch(this.url(path), {
            method,
            headers: {
                Authorization: `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: body != null ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = (json as any)?.error;
            // Utamakan pesan ramah Meta (error_user_msg) → jauh lebih jelas dari "Invalid parameter".
            const friendly = err?.error_user_msg || err?.error_user_title;
            const detail = friendly || err?.message || res.statusText || 'unknown';
            const code = !friendly && err?.code != null ? ` (code ${err.code})` : '';
            this.logger.warn(`Graph API ${res.status} ${method} ${path}: ${detail}${code}`);
            throw new Error(friendly ? detail : `WhatsApp Cloud API ${res.status}: ${detail}${code}`);
        }
        return json;
    }

    /**
     * Kirim pesan teks (hanya sah di dalam jendela layanan 24 jam).
     * @param phoneNumberId phone_number_id channel pengirim (dari Meta).
     * @param to nomor tujuan format 62xxx (tanpa '+').
     */
    async sendText(
        phoneNumberId: string,
        to: string,
        text: string,
        contextMessageId?: string,
    ): Promise<WaSendResult> {
        const json = await this.graph('POST', `${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { preview_url: false, body: text },
            ...(contextMessageId ? { context: { message_id: contextMessageId } } : {}),
        });
        return { waMessageId: json?.messages?.[0]?.id ?? null };
    }

    /** Kirim reaksi emoji ke sebuah pesan (emoji kosong = hapus reaksi). */
    async sendReaction(
        phoneNumberId: string,
        to: string,
        messageId: string,
        emoji: string,
    ): Promise<WaSendResult> {
        const json = await this.graph('POST', `${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'reaction',
            reaction: { message_id: messageId, emoji: emoji || '' },
        });
        return { waMessageId: json?.messages?.[0]?.id ?? null };
    }

    /**
     * Kirim pesan template pra-approve Meta (satu-satunya cara di LUAR jendela 24 jam,
     * juga dipakai broadcast).
     * @param components komponen template Meta (header/body/button params).
     */
    async sendTemplate(
        phoneNumberId: string,
        to: string,
        name: string,
        lang: string,
        components: any[] = [],
    ): Promise<WaSendResult> {
        const json = await this.graph('POST', `${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name,
                language: { code: lang },
                ...(components.length ? { components } : {}),
            },
        });
        return { waMessageId: json?.messages?.[0]?.id ?? null };
    }

    /** Unggah media ke Meta → media_id (langkah 1 sebelum sendMedia). */
    async uploadMedia(
        phoneNumberId: string,
        buffer: Buffer,
        mime: string,
        filename: string,
    ): Promise<string> {
        if (!this.token) throw new Error('WA_ACCESS_TOKEN belum diset');
        const form = new FormData();
        form.append('messaging_product', 'whatsapp');
        form.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), filename);
        const res = await fetch(this.url(`${phoneNumberId}/media`), {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.token}` },
            body: form,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const detail = (json as any)?.error?.message || res.statusText;
            this.logger.warn(`Upload media gagal ${res.status}: ${detail}`);
            throw new Error(`Upload media gagal ${res.status}: ${detail}`);
        }
        return (json as any)?.id;
    }

    /** Kirim pesan media (image/document/audio/video) via media_id (langkah 2). */
    async sendMedia(
        phoneNumberId: string,
        to: string,
        kind: 'image' | 'document' | 'audio' | 'video',
        mediaId: string,
        opts: { caption?: string; filename?: string; contextMessageId?: string } = {},
    ): Promise<WaSendResult> {
        const media: Record<string, string> = { id: mediaId };
        if (opts.caption && kind !== 'audio') media.caption = opts.caption;
        if (opts.filename && kind === 'document') media.filename = opts.filename;
        const json = await this.graph('POST', `${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: kind,
            [kind]: media,
            ...(opts.contextMessageId ? { context: { message_id: opts.contextMessageId } } : {}),
        });
        return { waMessageId: json?.messages?.[0]?.id ?? null };
    }

    /** Tandai pesan masuk sebagai dibaca (memicu centang biru di sisi pelanggan). Best-effort. */
    async markAsRead(phoneNumberId: string, messageId: string): Promise<void> {
        try {
            await this.graph('POST', `${phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                status: 'read',
                message_id: messageId,
            });
        } catch (e) {
            this.logger.warn(`Gagal tandai dibaca ${messageId}: ${(e as Error).message}`);
        }
    }

    // ─── Profil Bisnis (per nomor) ───────────────────────────────────────────

    /** Ambil profil bisnis WhatsApp nomor (about, deskripsi, alamat, dll). */
    async getBusinessProfile(phoneNumberId: string): Promise<Record<string, any>> {
        const json = await this.graph(
            'GET',
            `${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`,
        );
        return json?.data?.[0] ?? {};
    }

    /** Perbarui profil bisnis WhatsApp nomor. Field yg undefined tidak disentuh. */
    async updateBusinessProfile(
        phoneNumberId: string,
        data: {
            about?: string;
            address?: string;
            description?: string;
            email?: string;
            vertical?: string;
            websites?: string[];
        },
    ): Promise<void> {
        const payload: Record<string, any> = { messaging_product: 'whatsapp' };
        for (const k of ['about', 'address', 'description', 'email', 'vertical'] as const) {
            if (data[k] !== undefined) payload[k] = data[k];
        }
        if (data.websites !== undefined) payload.websites = data.websites.filter((w) => w?.trim());
        await this.graph('POST', `${phoneNumberId}/whatsapp_business_profile`, payload);
    }

    private get appId(): string {
        return process.env.WA_APP_ID || '';
    }

    /**
     * Ganti foto profil nomor. Alur Resumable Upload API Meta (3 langkah):
     *  1) buat sesi upload di /{app_id}/uploads → upload_session_id
     *  2) POST byte ke sesi (Authorization: OAuth) → handle `h`
     *  3) set whatsapp_business_profile { profile_picture_handle: h }
     */
    async updateProfilePicture(
        phoneNumberId: string,
        buffer: Buffer,
        mime: string,
        filename: string,
    ): Promise<void> {
        if (!this.token) throw new Error('WA_ACCESS_TOKEN belum diset');
        if (!this.appId) {
            throw new Error('WA_APP_ID belum diset di server (.env) — perlu App ID Meta untuk unggah foto profil');
        }
        // 1) sesi upload
        const sessUrl =
            this.url(`${this.appId}/uploads`) +
            `?file_name=${encodeURIComponent(filename)}&file_length=${buffer.length}` +
            `&file_type=${encodeURIComponent(mime)}&access_token=${encodeURIComponent(this.token)}`;
        const sessRes = await fetch(sessUrl, { method: 'POST' });
        const sess = await sessRes.json().catch(() => ({}));
        if (!sessRes.ok || !(sess as any)?.id) {
            throw new Error(`Gagal buat sesi upload: ${(sess as any)?.error?.message || sessRes.status}`);
        }
        // 2) unggah byte
        const upRes = await fetch(this.url(`${(sess as any).id}`), {
            method: 'POST',
            headers: { Authorization: `OAuth ${this.token}`, file_offset: '0', 'Content-Type': mime },
            body: new Uint8Array(buffer),
        });
        const up = await upRes.json().catch(() => ({}));
        if (!upRes.ok || !(up as any)?.h) {
            throw new Error(`Gagal unggah foto: ${(up as any)?.error?.message || upRes.status}`);
        }
        // 3) set handle sebagai foto profil
        await this.graph('POST', `${phoneNumberId}/whatsapp_business_profile`, {
            messaging_product: 'whatsapp',
            profile_picture_handle: (up as any).h,
        });
    }

    /** Info nomor untuk health-check (verifikasi kredensial tanpa kirim pesan). */
    async getPhoneNumberInfo(phoneNumberId: string): Promise<WaPhoneInfo> {
        const json = await this.graph('GET', `${phoneNumberId}?fields=verified_name,display_phone_number`);
        return {
            verifiedName: json?.verified_name,
            displayNumber: json?.display_phone_number,
        };
    }

    // ─── Manajemen Template (per WABA) ───────────────────────────────────────

    /** Ajukan template baru ke Meta (butuh review). @returns { id, status, category }. */
    async createTemplate(
        wabaId: string,
        payload: { name: string; language: string; category: string; components: any[] },
    ): Promise<{ id: string; status: string; category: string }> {
        return this.graph('POST', `${wabaId}/message_templates`, payload);
    }

    /** Ambil semua template di WABA (untuk sinkron status). */
    async listTemplates(wabaId: string): Promise<any[]> {
        const json = await this.graph(
            'GET',
            `${wabaId}/message_templates?fields=name,status,category,language,rejected_reason,id&limit=200`,
        );
        return json?.data ?? [];
    }

    // ─── Katalog produk (Meta Commerce) ──────────────────────────────────────

    /** Ambil catalog_id yang terhubung ke WABA (bila tak diset manual di channel). */
    async getWabaCatalogId(wabaId: string): Promise<string | null> {
        const json = await this.graph('GET', `${wabaId}/product_catalogs?fields=id,name&limit=1`);
        return json?.data?.[0]?.id ?? null;
    }

    /** Daftar produk katalog. */
    async listCatalogProducts(catalogId: string): Promise<any[]> {
        const fields = 'id,retailer_id,name,description,price,currency,image_url,url,availability';
        const json = await this.graph('GET', `${catalogId}/products?fields=${fields}&limit=200`);
        return json?.data ?? [];
    }

    /** Buat produk baru di katalog. Returns { id }. */
    async createCatalogProduct(catalogId: string, payload: Record<string, unknown>): Promise<any> {
        return this.graph('POST', `${catalogId}/products`, payload);
    }

    /** Update produk katalog (by product id). */
    async updateCatalogProduct(productId: string, payload: Record<string, unknown>): Promise<any> {
        return this.graph('POST', `${productId}`, payload);
    }

    /** Hapus produk katalog (by product id). */
    async deleteCatalogProduct(productId: string): Promise<any> {
        return this.graph('DELETE', `${productId}`);
    }

    // ─── Media inbound ───────────────────────────────────────────────────────

    /**
     * Unduh biner media inbound dari Meta. Dua langkah wajib:
     *  1) GET /{media_id} → { url, mime_type } (URL lookaside rahasia & kedaluwarsa).
     *  2) GET url pakai Authorization: Bearer token → biner.
     * Selalu resolusi ulang dari media_id (URL di webhook bisa sudah basi).
     */
    async getMediaBinary(mediaId: string): Promise<{ buffer: Buffer; contentType: string }> {
        if (!this.token) throw new Error('WA_ACCESS_TOKEN belum diset');
        const meta = await this.graph('GET', `${mediaId}`);
        const url: string | undefined = meta?.url;
        const mime: string = meta?.mime_type || 'application/octet-stream';
        if (!url) throw new Error(`media ${mediaId}: URL tak ditemukan`);
        const res = await fetch(url, { headers: { Authorization: `Bearer ${this.token}` } });
        if (!res.ok) {
            throw new Error(`Gagal unduh media ${mediaId}: HTTP ${res.status}`);
        }
        const ab = await res.arrayBuffer();
        return { buffer: Buffer.from(ab), contentType: mime };
    }
}
