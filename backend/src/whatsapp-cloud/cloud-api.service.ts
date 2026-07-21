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
        return process.env.WA_GRAPH_VERSION || 'v21.0';
    }

    private get token(): string {
        return process.env.WA_ACCESS_TOKEN || '';
    }

    private url(path: string): string {
        return `https://graph.facebook.com/${this.version}/${path}`;
    }

    /** Panggilan Graph API generik dengan penanganan error terbaca. */
    private async graph(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
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
            const detail = err?.message || res.statusText || 'unknown';
            const code = err?.code != null ? ` (code ${err.code})` : '';
            this.logger.warn(`Graph API ${res.status} ${method} ${path}: ${detail}${code}`);
            throw new Error(`WhatsApp Cloud API ${res.status}: ${detail}${code}`);
        }
        return json;
    }

    /**
     * Kirim pesan teks (hanya sah di dalam jendela layanan 24 jam).
     * @param phoneNumberId phone_number_id channel pengirim (dari Meta).
     * @param to nomor tujuan format 62xxx (tanpa '+').
     */
    async sendText(phoneNumberId: string, to: string, text: string): Promise<WaSendResult> {
        const json = await this.graph('POST', `${phoneNumberId}/messages`, {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to,
            type: 'text',
            text: { preview_url: false, body: text },
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
}
