import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';

/**
 * Graph API untuk Messenger & Instagram.
 * - MESSENGER: graph.facebook.com, Page access token, POST /{pageId}/messages.
 * - INSTAGRAM (Instagram API with Instagram Login): graph.instagram.com, IG user token,
 *   POST /{igId}/messages.
 */
@Injectable()
export class MetaApiService {
    private readonly logger = new Logger(MetaApiService.name);

    private get version(): string {
        return process.env.WA_GRAPH_VERSION || 'v23.0';
    }
    private base(platform: SocialPlatform): string {
        return platform === 'INSTAGRAM' ? 'https://graph.instagram.com' : 'https://graph.facebook.com';
    }

    private async graph(base: string, method: 'GET' | 'POST', path: string, token: string, body?: unknown): Promise<any> {
        const sep = path.includes('?') ? '&' : '?';
        const res = await fetch(`${base}/${this.version}/${path}${sep}access_token=${encodeURIComponent(token)}`, {
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

    /** Kirim pesan teks. `id` = pageId (Messenger) / igId (Instagram). */
    async sendText(platform: SocialPlatform, id: string, token: string, recipientId: string, text: string): Promise<{ messageId: string | null }> {
        const json = await this.graph(this.base(platform), 'POST', `${id}/messages`, token, {
            recipient: { id: recipientId },
            message: { text },
            ...(platform === 'MESSENGER' ? { messaging_type: 'RESPONSE' } : {}),
        });
        return { messageId: json?.message_id ?? null };
    }

    /** Verifikasi token + akses akun. Instagram: /me; Messenger: /{pageId}. */
    async whoami(platform: SocialPlatform, id: string, token: string): Promise<{ id: string; name: string | null }> {
        const path = platform === 'INSTAGRAM' ? `me?fields=id,username,name` : `${id}?fields=id,name`;
        const json = await this.graph(this.base(platform), 'GET', path, token);
        return { id: String(json?.id ?? id), name: json?.username || json?.name || null };
    }

    /** Ambil nama profil pengirim (best-effort; bisa gagal tanpa izin profil). */
    async getProfileName(platform: SocialPlatform, userId: string, token: string): Promise<string | null> {
        try {
            const json = await this.graph(this.base(platform), 'GET', `${userId}?fields=name,username`, token);
            return json?.name || json?.username || null;
        } catch {
            return null;
        }
    }

    // ─── Jalur Facebook Page (Messenger / IG-via-Page) — helper opsional ──────
    /** Daftar Page + Page Access Token dari token FB (User/System User). */
    async listPages(token: string): Promise<Array<{ id: string; name: string; accessToken: string; ig: { id: string; username: string | null } | null }>> {
        const json = await this.graph('https://graph.facebook.com', 'GET', `me/accounts?fields=name,access_token,instagram_business_account{id,username}&limit=100`, token);
        const data: any[] = json?.data ?? [];
        return data.map((p) => ({
            id: String(p.id),
            name: p.name ?? '',
            accessToken: p.access_token ?? '',
            ig: p.instagram_business_account?.id ? { id: String(p.instagram_business_account.id), username: p.instagram_business_account.username ?? null } : null,
        }));
    }

    /** Akun IG business yang terhubung ke sebuah Page (jalur FB Page). */
    async getPageInstagram(pageId: string, token: string): Promise<{ id: string; username: string | null; name: string | null } | null> {
        const json = await this.graph('https://graph.facebook.com', 'GET', `${pageId}?fields=name,instagram_business_account{id,username,name},connected_instagram_account{id,username,name}`, token);
        const iba = json?.instagram_business_account || json?.connected_instagram_account;
        if (!iba?.id) return null;
        return { id: String(iba.id), username: iba.username ?? null, name: iba.name ?? json?.name ?? null };
    }
}
