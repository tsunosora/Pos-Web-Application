import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';

export interface GraphPost {
    id: string;
    caption: string | null;
    permalink: string | null;
    mediaUrl: string | null;
    postedAt: Date | null;
    commentsCount: number | null; // null = tak diketahui
}
export interface GraphConversation {
    id: string;
    updatedAt: Date;
    participants: Array<{ id: string; name: string | null }>;
}
export interface GraphMessage {
    id: string;
    at: Date;
    fromId: string | null;
    text: string | null;
    type: string; // TEXT | IMAGE | VIDEO | FILE | UNSUPPORTED
    mediaUrl: string | null;
}
export interface GraphComment {
    id: string;
    text: string | null;
    at: Date;
    authorId: string | null;
    authorName: string | null;
    hidden: boolean;
    replies: GraphComment[];
}

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

    // ─── Komentar postingan ───────────────────────────────────────────────────
    // Izin: IG = instagram_business_manage_comments; FB Page = pages_read_engagement,
    // pages_read_user_content, pages_manage_engagement. Private reply butuh izin DM.

    /** Balas komentar secara publik. IG: /{comment}/replies; FB: /{comment}/comments. */
    async replyComment(platform: SocialPlatform, commentId: string, token: string, text: string): Promise<{ id: string | null }> {
        const path = platform === 'INSTAGRAM' ? `${commentId}/replies` : `${commentId}/comments`;
        const json = await this.graph(this.base(platform), 'POST', path, token, { message: text });
        return { id: json?.id ? String(json.id) : null };
    }

    /** Sembunyikan / tampilkan lagi komentar. */
    async setCommentHidden(platform: SocialPlatform, commentId: string, token: string, hidden: boolean): Promise<void> {
        await this.graph(this.base(platform), 'POST', commentId, token, platform === 'INSTAGRAM' ? { hide: hidden } : { is_hidden: hidden });
    }

    /**
     * Balas komentar lewat DM ("private reply"). `id` = igId / pageId.
     * Aturan Meta: sekali per komentar, paling lama 7 hari setelah komentar dibuat.
     */
    async privateReply(platform: SocialPlatform, id: string, token: string, commentId: string, text: string): Promise<{ recipientId: string | null; messageId: string | null }> {
        const json = await this.graph(this.base(platform), 'POST', `${id}/messages`, token, {
            recipient: { comment_id: commentId },
            message: { text },
        });
        return { recipientId: json?.recipient_id ? String(json.recipient_id) : null, messageId: json?.message_id ?? null };
    }

    /** Info satu postingan (caption, tautan, gambar). */
    async getPost(platform: SocialPlatform, postId: string, token: string): Promise<GraphPost> {
        const fields = platform === 'INSTAGRAM'
            ? 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count'
            : 'id,message,permalink_url,full_picture,created_time';
        return this.toPost(platform, await this.graph(this.base(platform), 'GET', `${postId}?fields=${fields}`, token));
    }

    /** Postingan terbaru akun. `id` = igId / pageId. */
    async listRecentPosts(platform: SocialPlatform, id: string, token: string, limit = 15): Promise<GraphPost[]> {
        const path = platform === 'INSTAGRAM'
            ? `${id}/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,comments_count&limit=${limit}`
            : `${id}/posts?fields=id,message,permalink_url,full_picture,created_time,comments.summary(true).limit(0)&limit=${limit}`;
        const json = await this.graph(this.base(platform), 'GET', path, token);
        return (json?.data ?? []).map((p: any) => this.toPost(platform, p));
    }

    /** Satu komentar (dipakai bila balasan masuk untuk komentar yang belum tercatat). */
    async getComment(platform: SocialPlatform, commentId: string, token: string): Promise<GraphComment> {
        const fields = platform === 'INSTAGRAM' ? 'id,text,timestamp,username,from,hidden' : 'id,message,created_time,from,is_hidden';
        return this.toComment(platform, await this.graph(this.base(platform), 'GET', `${commentId}?fields=${fields}`, token));
    }

    /** Komentar teratas sebuah postingan beserta balasannya. */
    async listPostComments(platform: SocialPlatform, postId: string, token: string): Promise<GraphComment[]> {
        const path = platform === 'INSTAGRAM'
            ? `${postId}/comments?fields=id,text,timestamp,username,from,hidden,replies{id,text,timestamp,username,from,hidden}&limit=50`
            : `${postId}/comments?filter=toplevel&order=reverse_chronological&limit=50&fields=id,message,created_time,from,is_hidden,comments.limit(50){id,message,created_time,from,is_hidden}`;
        const json = await this.graph(this.base(platform), 'GET', path, token);
        return (json?.data ?? []).map((c: any) => this.toComment(platform, c));
    }

    /**
     * Langganan webhook untuk akun ini (tanpa ini Meta tidak mengirim event walau
     * webhook aplikasi sudah terverifikasi). IG Login: /me/subscribed_apps;
     * FB Page: /{pageId}/subscribed_apps dengan Page token.
     */
    async subscribeApp(platform: SocialPlatform, id: string, token: string): Promise<string[]> {
        const fields = platform === 'INSTAGRAM' ? 'comments,messages' : 'feed,messages';
        const target = platform === 'INSTAGRAM' ? 'me' : id;
        await this.graph(this.base(platform), 'POST', `${target}/subscribed_apps?subscribed_fields=${fields}`, token);
        return fields.split(',');
    }

    // ─── Percakapan DM (untuk sinkron; webhook tetap jalur utama) ─────────────
    /** Percakapan terbaru akun. `id` = igId / pageId. Urut dari yang terakhir aktif. */
    async listConversations(platform: SocialPlatform, id: string, token: string, limit = 25): Promise<GraphConversation[]> {
        const path = platform === 'INSTAGRAM'
            ? `${id}/conversations?platform=instagram&fields=id,updated_time,participants&limit=${limit}`
            : `${id}/conversations?platform=messenger&fields=id,updated_time,participants&limit=${limit}`;
        const json = await this.graph(this.base(platform), 'GET', path, token);
        return (json?.data ?? []).map((c: any) => ({
            id: String(c.id),
            updatedAt: c.updated_time ? new Date(c.updated_time) : new Date(0),
            participants: (c.participants?.data ?? []).map((p: any) => ({ id: String(p.id), name: p.username || p.name || null })),
        }));
    }

    /** Pesan terbaru sebuah percakapan (terbaru dulu). */
    async listConversationMessages(platform: SocialPlatform, conversationId: string, token: string, limit = 20): Promise<GraphMessage[]> {
        const fields = platform === 'INSTAGRAM'
            ? 'id,created_time,from,message,attachments,is_unsupported'
            : 'id,created_time,from,message,attachments{mime_type,image_data,video_data,file_url}';
        const json = await this.graph(this.base(platform), 'GET', `${conversationId}/messages?fields=${fields}&limit=${limit}`, token);
        return (json?.data ?? []).map((m: any) => {
            const att = m.attachments?.data?.[0] ?? null;
            const url = att?.image_data?.url || att?.video_data?.url || att?.file_url || att?.url || null;
            const type = att ? (att.image_data ? 'IMAGE' : att.video_data ? 'VIDEO' : 'FILE') : m.is_unsupported ? 'UNSUPPORTED' : 'TEXT';
            return {
                id: String(m.id),
                at: m.created_time ? new Date(m.created_time) : new Date(),
                fromId: m.from?.id ? String(m.from.id) : null,
                text: m.message || null,
                type,
                mediaUrl: url,
            };
        });
    }

    private toPost(platform: SocialPlatform, p: any): GraphPost {
        const ig = platform === 'INSTAGRAM';
        const count = ig ? p?.comments_count : p?.comments?.summary?.total_count;
        return {
            id: String(p?.id ?? ''),
            caption: (ig ? p?.caption : p?.message) ?? null,
            permalink: (ig ? p?.permalink : p?.permalink_url) ?? null,
            mediaUrl: (ig ? (p?.media_type === 'VIDEO' ? p?.thumbnail_url : p?.media_url) : p?.full_picture) ?? null,
            postedAt: (ig ? p?.timestamp : p?.created_time) ? new Date(ig ? p.timestamp : p.created_time) : null,
            commentsCount: typeof count === 'number' ? count : null,
        };
    }

    private toComment(platform: SocialPlatform, c: any): GraphComment {
        const ig = platform === 'INSTAGRAM';
        const at = ig ? c?.timestamp : c?.created_time;
        const replies = ig ? c?.replies?.data : c?.comments?.data;
        return {
            id: String(c?.id ?? ''),
            text: (ig ? c?.text : c?.message) ?? null,
            at: at ? new Date(at) : new Date(),
            authorId: c?.from?.id ? String(c.from.id) : null,
            authorName: (ig ? (c?.username || c?.from?.username) : c?.from?.name) ?? null,
            hidden: !!(ig ? c?.hidden : c?.is_hidden),
            replies: Array.isArray(replies) ? replies.map((r: any) => this.toComment(platform, r)) : [],
        };
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
