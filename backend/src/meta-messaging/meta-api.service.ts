import { Injectable, Logger } from '@nestjs/common';

/**
 * Graph API untuk Messenger & Instagram Messaging (Send API pakai Page access token).
 * Endpoint sama untuk kedua platform: POST /{pageId}/messages.
 */
@Injectable()
export class MetaApiService {
    private readonly logger = new Logger(MetaApiService.name);

    private get version(): string {
        return process.env.WA_GRAPH_VERSION || 'v23.0';
    }
    private url(path: string): string {
        return `https://graph.facebook.com/${this.version}/${path}`;
    }

    private async graph(method: 'GET' | 'POST', path: string, token: string, body?: unknown): Promise<any> {
        const sep = path.includes('?') ? '&' : '?';
        const res = await fetch(this.url(`${path}${sep}access_token=${encodeURIComponent(token)}`), {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: body != null ? JSON.stringify(body) : undefined,
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
            const err = (json as any)?.error;
            const detail = err?.error_user_msg || err?.message || res.statusText || 'unknown';
            this.logger.warn(`Graph ${res.status} ${method} ${path}: ${detail}`);
            throw new Error(detail);
        }
        return json;
    }

    /** Kirim pesan teks ke PSID/IGSID via Page token. Returns message_id. */
    async sendText(pageId: string, token: string, recipientId: string, text: string): Promise<{ messageId: string | null }> {
        const json = await this.graph('POST', `${pageId}/messages`, token, {
            recipient: { id: recipientId },
            messaging_type: 'RESPONSE',
            message: { text },
        });
        return { messageId: json?.message_id ?? null };
    }

    /** Daftar Page + Page Access Token dari sebuah token login (User/System User). */
    async listPages(token: string): Promise<Array<{ id: string; name: string; accessToken: string; ig: { id: string; username: string | null } | null }>> {
        const json = await this.graph('GET', `me/accounts?fields=name,access_token,instagram_business_account{id,username}&limit=100`, token);
        const data: any[] = json?.data ?? [];
        return data.map((p) => ({
            id: String(p.id),
            name: p.name ?? '',
            accessToken: p.access_token ?? '',
            ig: p.instagram_business_account?.id ? { id: String(p.instagram_business_account.id), username: p.instagram_business_account.username ?? null } : null,
        }));
    }

    /** Akun Instagram business yang terhubung ke sebuah Page (untuk deteksi IG ID). */
    async getPageInstagram(pageId: string, token: string): Promise<{ id: string; username: string | null; name: string | null } | null> {
        const json = await this.graph(
            'GET',
            `${pageId}?fields=name,instagram_business_account{id,username,name},connected_instagram_account{id,username,name}`,
            token,
        );
        const iba = json?.instagram_business_account || json?.connected_instagram_account;
        if (!iba?.id) return null;
        return { id: String(iba.id), username: iba.username ?? null, name: iba.name ?? json?.name ?? null };
    }

    /** Ambil nama profil pengirim (best-effort; bisa gagal tanpa izin profil). */
    async getProfileName(userId: string, token: string): Promise<string | null> {
        try {
            const json = await this.graph('GET', `${userId}?fields=name,username`, token);
            return json?.name || json?.username || null;
        } catch {
            return null;
        }
    }
}
