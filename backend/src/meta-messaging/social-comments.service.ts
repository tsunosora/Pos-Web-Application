import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PenjagaTerjadwal, lewatiKarenaLisensi } from '../lisensi/penjaga-terjadwal.service';
import { Prisma, SocialDirection, SocialPlatform } from '@prisma/client';
import type { SocialChannel } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MetaApiService, type GraphComment } from './meta-api.service';
import { SocialInboxService } from './social-inbox.service';
import { LeadsService } from '../crm/leads/leads.service';
import type { BranchContext } from '../common/branch-context.decorator';

/** Komentar yang sudah dinormalkan dari webhook / hasil sinkron Graph API. */
interface IncomingComment {
    externalId: string;
    parentExternalId: string | null; // null = komentar teratas
    postExternalId: string;
    authorId: string | null;
    authorName: string | null;
    text: string | null;
    at: Date;
    hidden?: boolean;
    postPermalink?: string | null;
}

export interface SyncChannelResult {
    channelId: number;
    label: string;
    platform: SocialPlatform;
    posts: number;
    added: number; // komentar baru
    dmConversations: number;
    dmAdded: number; // pesan DM baru
    error: string | null;
}

/** Siapa yang meminta: staf non-admin hanya boleh channel cabangnya (atau channel "semua cabang"). */
export interface InboxScope {
    branchId?: number;
}

const THREAD_INCLUDE = {
    post: { select: { id: true, externalId: true, caption: true, permalink: true, mediaUrl: true, postedAt: true } },
    channel: { select: { id: true, label: true, platform: true, branchId: true } },
    lead: { select: { id: true, name: true, status: true } },
} satisfies Prisma.SocialCommentInclude;

const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class SocialCommentsService {
    private readonly logger = new Logger(SocialCommentsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly meta: MetaApiService,
        private readonly leads: LeadsService,
        private readonly inbox: SocialInboxService,
        // Opsional dengan sengaja — lihat catatan di `penjaga-terjadwal.service.ts`.
        @Optional() private readonly penjagaTerjadwal?: PenjagaTerjadwal,
    ) {}

    // ─── Webhook ─────────────────────────────────────────────────────────────
    /**
     * Event komentar: Instagram `changes[field=comments]`, Facebook Page
     * `changes[field=feed, item=comment]`. Tak pernah melempar.
     */
    async ingestWebhook(body: any): Promise<void> {
        const platform: SocialPlatform | null =
            body?.object === 'page' ? 'MESSENGER' : body?.object === 'instagram' ? 'INSTAGRAM' : null;
        if (!platform) return;
        for (const entry of body?.entry ?? []) {
            const changes: any[] = Array.isArray(entry?.changes) ? entry.changes : [];
            if (!changes.length) continue;
            const entryId = String(entry?.id ?? '');
            const channel = await this.resolveChannel(platform, entryId).catch(() => null);
            if (!channel) {
                this.logger.warn(`Komentar ${platform}: channel untuk akun ${entryId} belum terdaftar`);
                continue;
            }
            for (const change of changes) {
                try {
                    await this.handleChange(channel, change);
                } catch (e) {
                    this.logger.error(`Gagal proses komentar ${platform}: ${(e as Error).message}`);
                }
            }
        }
    }

    private resolveChannel(platform: SocialPlatform, entryId: string) {
        return platform === 'INSTAGRAM'
            ? this.prisma.socialChannel.findFirst({ where: { platform, OR: [{ igId: entryId }, { pageId: entryId }] } })
            : this.prisma.socialChannel.findFirst({ where: { platform, pageId: entryId } });
    }

    private async handleChange(channel: SocialChannel, change: any): Promise<void> {
        const v = change?.value ?? {};
        if (channel.platform === 'INSTAGRAM') {
            if (change?.field !== 'comments' && change?.field !== 'live_comments') return;
            if (!v?.id || !v?.media?.id) return;
            await this.upsertComment(channel, {
                externalId: String(v.id),
                parentExternalId: v.parent_id ? String(v.parent_id) : null,
                postExternalId: String(v.media.id),
                authorId: v.from?.id ? String(v.from.id) : null,
                authorName: v.from?.username ?? null,
                text: v.text ?? null,
                at: new Date(),
            }, true);
            return;
        }

        // Facebook Page
        if (change?.field !== 'feed' || v?.item !== 'comment' || !v?.comment_id) return;
        const externalId = String(v.comment_id);
        const where = { channelId_externalId: { channelId: channel.id, externalId } };
        if (v.verb === 'remove') {
            await this.prisma.socialComment.updateMany({ where: { channelId: channel.id, externalId }, data: { isDeleted: true } });
            return;
        }
        if (v.verb === 'hide' || v.verb === 'unhide') {
            await this.prisma.socialComment.updateMany({ where: { channelId: channel.id, externalId }, data: { isHidden: v.verb === 'hide' } });
            return;
        }
        if (v.verb === 'edited' && (await this.prisma.socialComment.findUnique({ where }))) {
            await this.prisma.socialComment.update({ where, data: { body: v.message ?? null } });
            return;
        }
        const postId = String(v.post_id ?? '');
        if (!postId) return;
        const parentId = v.parent_id ? String(v.parent_id) : null;
        await this.upsertComment(channel, {
            externalId,
            // Komentar teratas FB: parent_id = post_id.
            parentExternalId: parentId && parentId !== postId ? parentId : null,
            postExternalId: postId,
            authorId: v.from?.id ? String(v.from.id) : null,
            authorName: v.from?.name ?? null,
            text: v.message ?? (v.photo ? '[foto]' : v.video ? '[video]' : null),
            at: v.created_time ? new Date(Number(v.created_time) * 1000) : new Date(),
            postPermalink: v.post?.permalink_url ?? null,
        }, true);
    }

    // ─── Simpan komentar ─────────────────────────────────────────────────────
    private isOwnAccount(channel: SocialChannel, authorId: string | null) {
        return !!authorId && (authorId === channel.igId || authorId === channel.pageId);
    }

    /**
     * Simpan satu komentar (idempoten per id Meta) lalu perbarui utasnya.
     * `live` = datang dari webhook (utas ditandai belum dibaca); sinkron = tidak.
     */
    private async upsertComment(channel: SocialChannel, c: IncomingComment, live: boolean): Promise<{ created: boolean; rootId: number }> {
        const key = { channelId_externalId: { channelId: channel.id, externalId: c.externalId } };
        const existing = await this.prisma.socialComment.findUnique({ where: key });
        if (existing) {
            const data: Prisma.SocialCommentUpdateInput = {};
            if (c.text != null && c.text !== existing.body) data.body = c.text;
            if (c.hidden !== undefined && c.hidden !== existing.isHidden) data.isHidden = c.hidden;
            if (!existing.authorName && c.authorName) data.authorName = c.authorName;
            if (!existing.authorExternalId && c.authorId) data.authorExternalId = c.authorId;
            if (Object.keys(data).length) await this.prisma.socialComment.update({ where: { id: existing.id }, data });
            return { created: false, rootId: existing.rootId ?? existing.id };
        }

        const post = await this.ensurePost(channel, c.postExternalId, c.postPermalink ?? null);
        const outbound = this.isOwnAccount(channel, c.authorId);
        let rootId: number | null = null;
        if (c.parentExternalId) {
            const parent = await this.findOrFetchParent(channel, post.id, c.parentExternalId, c.at);
            rootId = parent.rootId ?? parent.id;
        }

        let row;
        try {
            row = await this.prisma.socialComment.create({
                data: {
                    channelId: channel.id,
                    postId: post.id,
                    rootId,
                    externalId: c.externalId,
                    authorExternalId: c.authorId,
                    authorName: c.authorName,
                    direction: outbound ? SocialDirection.OUTBOUND : SocialDirection.INBOUND,
                    body: c.text,
                    isHidden: !!c.hidden,
                    commentedAt: c.at,
                    ...(rootId == null ? { isRead: outbound || !live, needsReply: !outbound, lastActivityAt: c.at } : {}),
                },
            });
        } catch (e) {
            // Webhook yang sama bisa datang dua kali bersamaan.
            if (isUniqueViolation(e)) return { created: false, rootId: rootId ?? 0 };
            throw e;
        }
        if (rootId != null) await this.touchRoot(rootId, c.at, outbound, live);
        return { created: true, rootId: rootId ?? row.id };
    }

    /** Aktivitas baru di utas: geser urutan, tandai belum dibaca / perlu dibalas. */
    private async touchRoot(rootId: number, at: Date, outbound: boolean, live: boolean) {
        const root = await this.prisma.socialComment.findUnique({ where: { id: rootId }, select: { lastActivityAt: true } });
        if (!root) return;
        const data: Prisma.SocialCommentUpdateInput = {};
        if (!root.lastActivityAt || at >= root.lastActivityAt) {
            data.lastActivityAt = at;
            data.needsReply = !outbound;
            // Sudah dibalas tim (dari PosPro atau langsung dari aplikasi IG/FB) = sudah ditangani.
            if (outbound) data.isRead = true;
        }
        if (!outbound && live) data.isRead = false;
        if (Object.keys(data).length) await this.prisma.socialComment.update({ where: { id: rootId }, data });
    }

    /** Induk balasan belum tercatat (komentar lama) → ambil dari Graph, atau buat pengganti. */
    private async findOrFetchParent(channel: SocialChannel, postId: number, externalId: string, at: Date) {
        const key = { channelId_externalId: { channelId: channel.id, externalId } };
        const found = await this.prisma.socialComment.findUnique({ where: key });
        if (found) return found;
        const g = await this.meta.getComment(channel.platform, externalId, channel.accessToken).catch(() => null);
        const outbound = this.isOwnAccount(channel, g?.authorId ?? null);
        try {
            return await this.prisma.socialComment.create({
                data: {
                    channelId: channel.id,
                    postId,
                    externalId,
                    authorExternalId: g?.authorId ?? null,
                    authorName: g?.authorName ?? null,
                    direction: outbound ? SocialDirection.OUTBOUND : SocialDirection.INBOUND,
                    body: g?.text ?? null,
                    isHidden: !!g?.hidden,
                    commentedAt: g?.at ?? at,
                    isRead: true,
                    needsReply: false,
                    lastActivityAt: g?.at ?? at,
                },
            });
        } catch (e) {
            if (isUniqueViolation(e)) return this.prisma.socialComment.findUniqueOrThrow({ where: key });
            throw e;
        }
    }

    private async ensurePost(channel: SocialChannel, externalId: string, permalink: string | null) {
        const key = { channelId_externalId: { channelId: channel.id, externalId } };
        const found = await this.prisma.socialPost.findUnique({ where: key });
        if (found) return found;
        const info = await this.meta.getPost(channel.platform, externalId, channel.accessToken).catch(() => null);
        try {
            return await this.prisma.socialPost.create({
                data: {
                    channelId: channel.id,
                    externalId,
                    caption: info?.caption ?? null,
                    permalink: info?.permalink ?? permalink,
                    mediaUrl: info?.mediaUrl ?? null,
                    postedAt: info?.postedAt ?? null,
                },
            });
        } catch (e) {
            if (isUniqueViolation(e)) return this.prisma.socialPost.findUniqueOrThrow({ where: key });
            throw e;
        }
    }

    // ─── Sinkron (ambil komentar lewat Graph API) ────────────────────────────
    // Cadangan webhook: Meta baru mengirim webhook komentar bila aplikasi Live dan
    // punya Advanced Access (lolos tinjauan). Sinkron berjalan otomatis tiap 5
    // menit + bisa dipicu tombol "Sinkronkan".
    private running: Promise<unknown> | null = null;
    private lastSync: { at: Date; auto: boolean; results: SyncChannelResult[] } | null = null;
    private lastAutoErrors = new Map<number, string>();
    private autoBusy = false;

    @Cron('30 */5 * * * *', { name: 'social-comments-auto-sync' })
    async autoSync() {
        // Tanpa `social.inbox` di kunci, inbox IG/FB memang tidak dijual ke klien ini — menarik
        // komentarnya tiap 5 menit cuma memakai kuota Graph API-nya untuk data yang tak terbuka.
        // Tombol "Sinkronkan" manual TIDAK ikut dijaga di sini: dia lewat `/social/*` yang sudah
        // dijaga `@ButuhFitur('social.inbox')`, jadi menambahnya di sini cuma dua penjaga untuk
        // satu pintu. Sengaja tidak berhenti saat hanya-baca — alasannya sama dengan webhook Meta.
        if (lewatiKarenaLisensi(this.penjagaTerjadwal, 'sosial.komentar')) return;
        // Penanda dipasang sebelum await pertama supaya pemicu yang tumpang tindih
        // (mis. sinkron sebelumnya belum selesai) tidak menjalankan sinkron kedua.
        if (process.env.SOCIAL_AUTO_SYNC === 'false' || this.autoBusy || this.running) return;
        this.autoBusy = true;
        try {
            await this.runAutoSync();
        } finally {
            this.autoBusy = false;
        }
    }

    private async runAutoSync() {
        const { results } = await this.syncAll({}, true);
        // Catat error sekali saat berubah saja, supaya log tidak penuh tiap 5 menit.
        for (const r of results) {
            const prev = this.lastAutoErrors.get(r.channelId) ?? null;
            if (r.error && r.error !== prev) this.logger.warn(`Sinkron otomatis ${r.label}: ${r.error}`);
            if (!r.error && prev) this.logger.log(`Sinkron otomatis ${r.label} pulih`);
            if (r.error) this.lastAutoErrors.set(r.channelId, r.error);
            else this.lastAutoErrors.delete(r.channelId);
            if (r.added || r.dmAdded) this.logger.log(`Sinkron otomatis ${r.label}: ${r.added} komentar & ${r.dmAdded} pesan DM baru`);
        }
    }

    /** Tarik komentar dari postingan terbaru semua channel aktif. Error per channel dilaporkan, tidak dilempar. */
    async syncAll(scope: InboxScope, auto = false): Promise<{ results: SyncChannelResult[] }> {
        const channels = await this.prisma.socialChannel.findMany({
            where: { isActive: true, ...this.channelScope(scope) },
            orderBy: { id: 'asc' },
        });
        // Satu sinkron dalam satu waktu (tombol ditekan saat sinkron otomatis jalan → antre).
        const job = (this.running ?? Promise.resolve()).catch(() => undefined).then(async () => {
            const results: SyncChannelResult[] = [];
            for (const ch of channels) {
                // Komentar & DM disinkron terpisah: gagal satu tidak menggagalkan yang lain.
                const r: SyncChannelResult = { channelId: ch.id, label: ch.label, platform: ch.platform, posts: 0, added: 0, dmConversations: 0, dmAdded: 0, error: null };
                const errors: string[] = [];
                try {
                    Object.assign(r, await this.syncChannel(ch));
                } catch (e) {
                    errors.push(`Komentar: ${this.permissionHint(ch.platform, (e as Error).message)}`);
                }
                try {
                    const dm = await this.inbox.syncDms(ch);
                    r.dmConversations = dm.conversations;
                    r.dmAdded = dm.added;
                } catch (e) {
                    errors.push(`DM: ${this.permissionHint(ch.platform, (e as Error).message, 'dm')}`);
                }
                r.error = errors.length ? errors.join(' · ') : null;
                results.push(r);
            }
            if (!Object.keys(scope).length || !this.lastSync) this.lastSync = { at: new Date(), auto, results };
            return results;
        });
        this.running = job;
        try {
            return { results: await job };
        } finally {
            if (this.running === job) this.running = null;
        }
    }

    /** Waktu & hasil sinkron terakhir (untuk keterangan di layar). */
    syncStatus(scope: InboxScope, allowedChannelIds: number[] | null) {
        const results = (this.lastSync?.results ?? []).filter((r) => !allowedChannelIds || allowedChannelIds.includes(r.channelId));
        return {
            intervalMinutes: process.env.SOCIAL_AUTO_SYNC === 'false' ? null : 5,
            lastSyncAt: this.lastSync?.at ?? null,
            auto: this.lastSync?.auto ?? null,
            results,
            running: !!this.running,
            scoped: !!scope.branchId,
        };
    }

    async channelIdsInScope(scope: InboxScope): Promise<number[] | null> {
        if (!scope.branchId) return null;
        const rows = await this.prisma.socialChannel.findMany({ where: this.channelScope(scope), select: { id: true } });
        return rows.map((r) => r.id);
    }

    private async syncChannel(channel: SocialChannel): Promise<{ posts: number; added: number }> {
        const accountId = channel.platform === 'INSTAGRAM' ? (channel.igId || channel.pageId) : channel.pageId;
        const posts = await this.meta.listRecentPosts(channel.platform, accountId, channel.accessToken, 15);
        // Komentar baru yang masih segar (≤3 hari) ditandai belum dibaca; yang lebih
        // lama cukup masuk "Perlu dibalas" supaya penarikan pertama tidak membanjiri angka.
        const freshSince = Date.now() - 3 * 24 * 3600 * 1000;
        let added = 0;
        for (const p of posts) {
            if (!p.id) continue;
            const stored = await this.prisma.socialPost.findUnique({ where: { channelId_externalId: { channelId: channel.id, externalId: p.id } } });
            const data = { caption: p.caption, permalink: p.permalink, mediaUrl: p.mediaUrl, postedAt: p.postedAt };
            // Tulis hanya bila berubah (URL gambar IG berganti tiap respons → segarkan tiap 12 jam).
            if (!stored) {
                await this.prisma.socialPost.create({ data: { channelId: channel.id, externalId: p.id, ...data } }).catch((e) => { if (!isUniqueViolation(e)) throw e; });
            } else if (stored.caption !== p.caption || stored.permalink !== p.permalink || (!stored.mediaUrl && p.mediaUrl)
                || (p.mediaUrl && Date.now() - stored.updatedAt.getTime() > 12 * 3600 * 1000)) {
                await this.prisma.socialPost.update({ where: { id: stored.id }, data });
            }
            if (p.commentsCount === 0) continue;
            const comments = await this.meta.listPostComments(channel.platform, p.id, channel.accessToken);
            // Komentar yang sudah tercatat & tidak berubah dilewati tanpa kueri per komentar.
            const known = new Map(
                (await this.prisma.socialComment.findMany({
                    where: { channelId: channel.id, post: { externalId: p.id } },
                    select: { externalId: true, body: true, isHidden: true },
                })).map((c) => [c.externalId, c]),
            );
            const unchanged = (g: GraphComment) => {
                const k = known.get(g.id);
                return !!k && (g.text == null || g.text === k.body) && g.hidden === k.isHidden;
            };
            // Urut dari yang terlama supaya status "perlu dibalas" ditentukan aktivitas terakhir.
            for (const top of [...comments].sort((a, b) => a.at.getTime() - b.at.getTime())) {
                if (!unchanged(top) && (await this.upsertComment(channel, this.fromGraph(top, p.id, null), top.at.getTime() >= freshSince)).created) added++;
                for (const r of [...top.replies].sort((a, b) => a.at.getTime() - b.at.getTime())) {
                    if (!unchanged(r) && (await this.upsertComment(channel, this.fromGraph(r, p.id, top.id), r.at.getTime() >= freshSince)).created) added++;
                }
            }
        }
        return { posts: posts.length, added };
    }

    private fromGraph(g: GraphComment, postExternalId: string, parentExternalId: string | null): IncomingComment {
        return { externalId: g.id, parentExternalId, postExternalId, authorId: g.authorId, authorName: g.authorName, text: g.text, at: g.at, hidden: g.hidden };
    }

    /** Pesan error Meta + petunjuk izin yang biasanya kurang. */
    private permissionHint(platform: SocialPlatform, message: string, kind: 'comments' | 'dm' = 'comments') {
        if (!/permission|izin|scope|\(#10\)|\(#200\)|\(#190\)|OAuth|access token/i.test(message)) return message;
        const perlu = kind === 'dm'
            ? (platform === 'INSTAGRAM'
                ? 'instagram_business_manage_messages (dan "Izinkan akses ke pesan" ON di aplikasi Instagram)'
                : 'pages_messaging')
            : (platform === 'INSTAGRAM'
                ? 'instagram_business_basic + instagram_business_manage_comments'
                : 'pages_read_engagement + pages_read_user_content + pages_manage_engagement');
        return `${message} — token perlu izin ${perlu}. Buat ulang token dengan izin itu lalu tekan "Ganti token".`;
    }

    // ─── Inbox komentar ──────────────────────────────────────────────────────
    private channelScope(scope: InboxScope): Prisma.SocialChannelWhereInput {
        // Channel tanpa cabang = milik semua cabang.
        return scope.branchId ? { OR: [{ branchId: scope.branchId }, { branchId: null }] } : {};
    }

    async listThreads(scope: InboxScope, opts: { platform?: SocialPlatform; filter?: string; q?: string; take?: number; cursor?: number }) {
        const take = Math.min(Math.max(opts.take ?? 30, 1), 100);
        const where: Prisma.SocialCommentWhereInput = {
            rootId: null,
            isDeleted: false,
            channel: { ...this.channelScope(scope), ...(opts.platform ? { platform: opts.platform } : {}) },
        };
        if (opts.filter === 'unread') where.isRead = false;
        if (opts.filter === 'needs_reply') {
            where.needsReply = true;
            where.isHidden = false;
        }
        if (opts.filter === 'hidden') where.isHidden = true;
        if (opts.q) {
            where.OR = [
                { authorName: { contains: opts.q } },
                { body: { contains: opts.q } },
                { replies: { some: { OR: [{ authorName: { contains: opts.q } }, { body: { contains: opts.q } }] } } },
            ];
        }
        const rows = await this.prisma.socialComment.findMany({
            where,
            take: take + 1,
            ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
            orderBy: [{ lastActivityAt: 'desc' }, { id: 'desc' }],
            include: {
                ...THREAD_INCLUDE,
                replies: {
                    where: { isDeleted: false },
                    orderBy: { commentedAt: 'desc' },
                    take: 1,
                    select: { body: true, direction: true, authorName: true, commentedAt: true },
                },
                _count: { select: { replies: { where: { isDeleted: false } } } },
            },
        });
        const hasMore = rows.length > take;
        const items = hasMore ? rows.slice(0, take) : rows;
        return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
    }

    private async loadRoot(id: number, scope: InboxScope) {
        const c = await this.prisma.socialComment.findUnique({ where: { id }, include: { channel: true } });
        if (!c) throw new NotFoundException('Komentar tidak ditemukan');
        if (scope.branchId && c.channel.branchId != null && c.channel.branchId !== scope.branchId) {
            throw new ForbiddenException('Komentar ini milik channel cabang lain');
        }
        return c;
    }

    /** Detail utas (komentar akar + semua balasan). Membuka = menandai sudah dibaca. */
    async getThread(id: number, scope: InboxScope) {
        const c = await this.loadRoot(id, scope);
        const rootId = c.rootId ?? c.id;
        await this.prisma.socialComment.update({ where: { id: rootId }, data: { isRead: true } });
        const root = await this.prisma.socialComment.findUniqueOrThrow({
            where: { id: rootId },
            include: {
                ...THREAD_INCLUDE,
                sentBy: { select: { id: true, name: true } },
                replies: {
                    where: { isDeleted: false },
                    orderBy: [{ commentedAt: 'asc' }, { id: 'asc' }],
                    include: { sentBy: { select: { id: true, name: true } } },
                },
            },
        });
        const others = await this.prisma.socialComment.count({
            where: { postId: root.postId, rootId: null, isDeleted: false, id: { not: root.id } },
        });
        return { ...root, otherThreadsOnPost: others };
    }

    /** Tandai belum dibaca / selesai (tak perlu dibalas). */
    async updateThread(id: number, scope: InboxScope, data: { isRead?: boolean; needsReply?: boolean }) {
        const c = await this.loadRoot(id, scope);
        const patch: Prisma.SocialCommentUpdateInput = {};
        if (typeof data.isRead === 'boolean') patch.isRead = data.isRead;
        if (typeof data.needsReply === 'boolean') patch.needsReply = data.needsReply;
        await this.prisma.socialComment.update({ where: { id: c.rootId ?? c.id }, data: patch });
        return { ok: true };
    }

    /**
     * Balas utas. `public` = komentar balasan di postingan (ke komentar akar);
     * `private` = DM ke penulis komentar (sekali per komentar, maks 7 hari).
     */
    async reply(id: number, scope: InboxScope, userId: number, input: { text: string; mode?: 'public' | 'private'; targetId?: number }) {
        const text = input.text?.trim();
        if (!text) throw new BadRequestException('Balasan kosong');
        const c = await this.loadRoot(id, scope);
        const rootId = c.rootId ?? c.id;
        const root = c.rootId ? await this.prisma.socialComment.findUniqueOrThrow({ where: { id: rootId } }) : c;
        const channel = c.channel;
        return input.mode === 'private'
            ? this.replyPrivate(channel, root.id, userId, text, input.targetId)
            : this.replyPublic(channel, root, userId, text);
    }

    private async replyPublic(channel: SocialChannel, root: { id: number; externalId: string; postId: number }, userId: number, text: string) {
        let externalId: string | null;
        try {
            ({ id: externalId } = await this.meta.replyComment(channel.platform, root.externalId, channel.accessToken, text));
        } catch (e) {
            throw new ConflictException(`Gagal membalas: ${this.permissionHint(channel.platform, (e as Error).message)}`);
        }
        const now = new Date();
        const extId = externalId ?? `pospro-${root.id}-${now.getTime()}`;
        const data = {
            channelId: channel.id,
            postId: root.postId,
            rootId: root.id,
            externalId: extId,
            authorExternalId: channel.platform === 'INSTAGRAM' ? channel.igId : channel.pageId,
            authorName: channel.label,
            direction: SocialDirection.OUTBOUND,
            body: text,
            sentById: userId,
            commentedAt: now,
        };
        // Webhook balasan kita sendiri bisa tiba lebih dulu dari respons API →
        // baris sudah ada; jadikan milik kita (arah keluar + nama pembalas).
        const row = await this.prisma.socialComment.upsert({
            where: { channelId_externalId: { channelId: channel.id, externalId: extId } },
            create: data,
            update: { direction: SocialDirection.OUTBOUND, sentById: userId, rootId: root.id },
        });
        await this.prisma.socialComment.update({ where: { id: root.id }, data: { needsReply: false, isRead: true, lastActivityAt: now } });
        return row;
    }

    private async replyPrivate(channel: SocialChannel, rootId: number, userId: number, text: string, targetId?: number) {
        // Sasaran: komentar pilihan, atau komentar masuk terbaru di utas yang belum pernah di-DM.
        const target = targetId
            ? await this.prisma.socialComment.findFirst({ where: { id: targetId, OR: [{ id: rootId }, { rootId }] } })
            : await this.prisma.socialComment.findFirst({
                where: { OR: [{ id: rootId }, { rootId }], direction: SocialDirection.INBOUND, privateReplyAt: null, isDeleted: false },
                orderBy: { commentedAt: 'desc' },
            });
        if (!target) throw new BadRequestException('Tidak ada komentar pelanggan yang bisa dibalas lewat DM di utas ini');
        if (target.direction !== SocialDirection.INBOUND) throw new BadRequestException('Hanya komentar pelanggan yang bisa dibalas lewat DM');
        if (target.privateReplyAt) throw new BadRequestException('Komentar ini sudah pernah dibalas lewat DM (Meta hanya mengizinkan sekali)');

        const sendId = channel.platform === 'INSTAGRAM' ? (channel.igId || channel.pageId) : channel.pageId;
        let sent: { recipientId: string | null; messageId: string | null };
        try {
            sent = await this.meta.privateReply(channel.platform, sendId, channel.accessToken, target.externalId, text);
        } catch (e) {
            const msg = (e as Error).message;
            const hint = /7 day|7 hari|outside|expired|10903|already/i.test(msg)
                ? ' (DM balasan komentar hanya bisa sekali dan paling lama 7 hari setelah komentar dibuat)'
                : '';
            throw new ConflictException(`Gagal kirim DM: ${this.permissionHint(channel.platform, msg)}${hint}`);
        }
        const now = new Date();
        await this.prisma.socialComment.update({ where: { id: target.id }, data: { privateReplyAt: now } });
        await this.prisma.socialComment.update({ where: { id: rootId }, data: { needsReply: false, isRead: true } });

        // Catat di inbox DM supaya balasan pelanggan nanti menyambung di percakapan yang sama.
        let conversationId: number | null = null;
        if (sent.recipientId) {
            const contact = await this.prisma.socialContact.upsert({
                where: { channelId_externalId: { channelId: channel.id, externalId: sent.recipientId } },
                create: { channelId: channel.id, platform: channel.platform, externalId: sent.recipientId, name: target.authorName },
                update: {},
            });
            const open = await this.prisma.socialConversation.findFirst({
                where: { channelId: channel.id, contactId: contact.id, status: { not: 'CLOSED' } },
                orderBy: { createdAt: 'desc' },
            });
            const conv = open
                ? await this.prisma.socialConversation.update({ where: { id: open.id }, data: { lastMessageAt: now } })
                : await this.prisma.socialConversation.create({
                    data: { channelId: channel.id, contactId: contact.id, status: 'OPEN', lastMessageAt: now, assignedToId: userId },
                });
            conversationId = conv.id;
            await this.prisma.socialMessage.create({
                data: {
                    channelId: channel.id,
                    conversationId: conv.id,
                    contactId: contact.id,
                    externalId: sent.messageId,
                    direction: SocialDirection.OUTBOUND,
                    type: 'TEXT',
                    body: text,
                    sentById: userId,
                },
            });
        }
        return { ok: true, conversationId };
    }

    /** Sembunyikan / tampilkan komentar (mis. spam, kompetitor). */
    async setHidden(id: number, scope: InboxScope, hidden: boolean) {
        const c = await this.loadRoot(id, scope);
        if (c.direction === SocialDirection.OUTBOUND) throw new BadRequestException('Komentar milik akun sendiri tidak bisa disembunyikan');
        try {
            await this.meta.setCommentHidden(c.channel.platform, c.externalId, c.channel.accessToken, hidden);
        } catch (e) {
            throw new ConflictException(`Gagal ${hidden ? 'menyembunyikan' : 'menampilkan'}: ${this.permissionHint(c.channel.platform, (e as Error).message)}`);
        }
        await this.prisma.socialComment.update({ where: { id: c.id }, data: { isHidden: hidden } });
        // Menyembunyikan komentar akar = tidak perlu dibalas lagi.
        if (hidden && !c.rootId) await this.prisma.socialComment.update({ where: { id: c.id }, data: { needsReply: false, isRead: true } });
        return { ok: true };
    }

    // ─── Prospek (lead CRM) ──────────────────────────────────────────────────
    /** Jadikan penulis komentar prospek CRM (sumber Instagram/Facebook) dan tautkan ke utas. */
    async createLeadFromThread(id: number, scope: InboxScope, ctx: BranchContext, userId: number) {
        const c = await this.loadRoot(id, scope);
        const root = await this.prisma.socialComment.findUniqueOrThrow({ where: { id: c.rootId ?? c.id }, include: { post: true } });
        if (root.leadId) return { leadId: root.leadId, existed: true };
        const ig = c.channel.platform === 'INSTAGRAM';
        const quote = root.body ? `Komentar: "${root.body}"` : 'Komentar di postingan';
        const lead = await this.leads.create({ ...ctx, branchId: ctx.branchId ?? c.channel.branchId }, {
            name: this.leadName(c.channel.platform, root.authorName),
            source: ig ? 'INSTAGRAM' : 'FACEBOOK',
            sourceDetail: ig ? 'Komentar Instagram' : 'Komentar Facebook',
            needs: root.post.permalink ? `${quote}\n${root.post.permalink}` : quote,
            assignedToId: userId,
        }, userId);
        await this.prisma.socialComment.update({ where: { id: root.id }, data: { leadId: lead.id } });
        return { leadId: lead.id, existed: false };
    }

    /** Sama seperti di atas untuk kontak DM (Messenger / Instagram). */
    async createLeadFromContact(contactId: number, scope: InboxScope, ctx: BranchContext, userId: number) {
        const contact = await this.prisma.socialContact.findUnique({ where: { id: contactId }, include: { channel: true } });
        if (!contact) throw new NotFoundException('Kontak tidak ditemukan');
        if (scope.branchId && contact.channel.branchId != null && contact.channel.branchId !== scope.branchId) {
            throw new ForbiddenException('Kontak ini milik channel cabang lain');
        }
        if (contact.leadId) return { leadId: contact.leadId, existed: true };
        const ig = contact.platform === 'INSTAGRAM';
        const lead = await this.leads.create({ ...ctx, branchId: ctx.branchId ?? contact.channel.branchId }, {
            name: this.leadName(contact.platform, contact.name),
            source: ig ? 'INSTAGRAM' : 'FACEBOOK',
            sourceDetail: ig ? 'DM Instagram' : 'Messenger',
            assignedToId: userId,
        }, userId);
        await this.prisma.socialContact.update({ where: { id: contact.id }, data: { leadId: lead.id } });
        return { leadId: lead.id, existed: false };
    }

    private leadName(platform: SocialPlatform, name: string | null) {
        if (!name) return platform === 'INSTAGRAM' ? 'Pengguna Instagram' : 'Pengguna Facebook';
        return (platform === 'INSTAGRAM' && !name.startsWith('@') ? `@${name}` : name).slice(0, 120);
    }

    // ─── Penghitung tab ──────────────────────────────────────────────────────
    async counts(scope: InboxScope) {
        const ch = (platform: SocialPlatform) => ({ ...this.channelScope(scope), platform });
        const [dmIg, dmFb, cIg, cFb] = await Promise.all([
            this.prisma.socialConversation.count({ where: { unreadCount: { gt: 0 }, channel: ch('INSTAGRAM') } }),
            this.prisma.socialConversation.count({ where: { unreadCount: { gt: 0 }, channel: ch('MESSENGER') } }),
            this.prisma.socialComment.count({ where: { rootId: null, isRead: false, isDeleted: false, channel: ch('INSTAGRAM') } }),
            this.prisma.socialComment.count({ where: { rootId: null, isRead: false, isDeleted: false, channel: ch('MESSENGER') } }),
        ]);
        return { dm: { INSTAGRAM: dmIg, MESSENGER: dmFb }, comments: { INSTAGRAM: cIg, MESSENGER: cFb } };
    }

    // ─── Langganan webhook per akun ──────────────────────────────────────────
    async subscribe(channelId: number) {
        const ch = await this.prisma.socialChannel.findUnique({ where: { id: channelId } });
        if (!ch) throw new NotFoundException('Channel tidak ditemukan');
        const id = ch.platform === 'INSTAGRAM' ? (ch.igId || ch.pageId) : ch.pageId;
        try {
            const fields = await this.meta.subscribeApp(ch.platform, id, ch.accessToken);
            return { ok: true, fields };
        } catch (e) {
            throw new BadRequestException(`Gagal mengaktifkan webhook: ${(e as Error).message}`);
        }
    }
}
