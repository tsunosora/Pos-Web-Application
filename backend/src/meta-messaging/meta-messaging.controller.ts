import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SocialInboxService, type CreateSocialChannelInput } from './social-inbox.service';
import { SocialCommentsService, type InboxScope } from './social-comments.service';
import { CurrentBranch, type BranchContext } from '../common/branch-context.decorator';
import { ButuhFitur } from '../lisensi/butuh-fitur.decorator';

const ADMIN_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'] as const;
const INBOX_ROLES = [...ADMIN_ROLES, 'CS', 'MARKETING'] as const;

// Inbox DM + komentar Instagram/Facebook = kode fitur `social.inbox` (isi paket Bisnis).
// Seluruh controller dijaga karena isinya satu fitur utuh, dan semua endpointnya memakai sesi
// pengguna (JWT). Yang TIDAK boleh ikut dijaga: `/social/webhook` dan `/social/data-deletion`
// — keduanya dipanggil Meta tanpa sesi siapa pun. Untung keduanya kelas controller sendiri,
// jadi dekorator ini tidak sampai ke sana; jangan pernah disatukan ke kelas ini.
@ButuhFitur('social.inbox')
@Controller('social')
export class MetaMessagingController {
    constructor(
        private readonly inbox: SocialInboxService,
        private readonly comments: SocialCommentsService,
    ) {}

    /** Admin melihat semua channel; staf lain hanya channel cabangnya + channel semua cabang. */
    private scope(req: any): InboxScope {
        const roleName = String(req.user?.roleName || '').toUpperCase();
        if ((ADMIN_ROLES as readonly string[]).includes(roleName)) return {};
        return { branchId: req.user?.branchId ?? undefined };
    }

    // ─── Channel (Owner/Admin) ───────────────────────────────────────────────
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Get('channels')
    listChannels() {
        return this.inbox.listChannels();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Post('channels')
    createChannel(@Body() body: CreateSocialChannelInput) {
        return this.inbox.createChannel(body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Patch('channels/:id')
    updateChannel(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<CreateSocialChannelInput> & { isActive?: boolean }) {
        return this.inbox.updateChannel(id, body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Delete('channels/:id')
    removeChannel(@Param('id', ParseIntPipe) id: number) {
        return this.inbox.removeChannel(id);
    }

    /** Diagnostik: webhook terakhir yang diterima server dari Meta. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Get('webhook-debug')
    webhookDebug() {
        return this.inbox.webhookDebug();
    }

    /** Tes token + akses akun (Instagram/Messenger) sebelum simpan. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Post('test-connection')
    testConnection(@Body() body: { platform: SocialPlatform; pageId?: string; igId?: string; accessToken: string }) {
        return this.inbox.testConnection(body);
    }

    /** Ambil daftar Page + Page token dari token login. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Post('pages-from-token')
    pagesFromToken(@Body() body: { token: string }) {
        return this.inbox.listPagesFromToken(body?.token);
    }

    /** Deteksi IG business account yang terhubung ke Page. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Post('detect-ig')
    detectIg(@Body() body: { pageId: string; accessToken: string }) {
        return this.inbox.detectInstagram(body.pageId, body.accessToken);
    }

    /** Aktifkan langganan webhook akun ini (komentar + DM). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Post('channels/:id/subscribe')
    subscribe(@Param('id', ParseIntPipe) id: number) {
        return this.comments.subscribe(id);
    }

    // ─── Inbox (Owner/Admin/CS/Marketing) ────────────────────────────────────
    /** Angka di tab: percakapan DM & utas komentar yang belum dibaca. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('counts')
    counts(@Req() req: any) {
        return this.comments.counts(this.scope(req));
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('conversations')
    listConversations(@Req() req: any, @Query() query: Record<string, string>) {
        const roleName = String(req.user?.roleName || '').toUpperCase();
        const privileged = (ADMIN_ROLES as readonly string[]).includes(roleName);
        const branchId = privileged ? (query.branchId ? +query.branchId : undefined) : (req.user?.branchId ?? undefined);
        return this.inbox.listConversations({
            platform: (query.platform as SocialPlatform) || undefined,
            branchId,
            q: query.q || undefined,
            take: query.take ? +query.take : undefined,
            cursor: query.cursor ? +query.cursor : undefined,
        });
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('conversations/:id/messages')
    async getMessages(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
        await this.inbox.assertConversationScope(id, this.scope(req));
        return this.inbox.getMessages(id, { take: query.take ? +query.take : undefined, cursor: query.cursor ? +query.cursor : undefined });
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('conversations/:id/reply')
    async reply(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { text: string }) {
        await this.inbox.assertConversationScope(id, this.scope(req));
        return this.inbox.reply(id, req.user.userId, body.text);
    }

    /** Jadikan kontak DM prospek CRM. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('contacts/:id/lead')
    contactLead(@Req() req: any, @CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.comments.createLeadFromContact(id, this.scope(req), ctx, req.user.userId);
    }

    // ─── Komentar IG / FB ────────────────────────────────────────────────────
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('comments')
    listComments(@Req() req: any, @Query() query: Record<string, string>) {
        return this.comments.listThreads(this.scope(req), {
            platform: (query.platform as SocialPlatform) || undefined,
            filter: query.filter || undefined,
            q: query.q?.trim() || undefined,
            take: query.take ? +query.take : undefined,
            cursor: query.cursor ? +query.cursor : undefined,
        });
    }

    /** Tarik komentar dari postingan terbaru (untuk komentar sebelum webhook aktif). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('comments/sync')
    syncComments(@Req() req: any) {
        return this.comments.syncAll(this.scope(req));
    }

    /** Kapan sinkron terakhir (otomatis tiap 5 menit / tombol) & hasil per channel. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('comments/sync-status')
    async syncStatus(@Req() req: any) {
        const scope = this.scope(req);
        return this.comments.syncStatus(scope, await this.comments.channelIdsInScope(scope));
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('comments/:id')
    getThread(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
        return this.comments.getThread(id, this.scope(req));
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Patch('comments/:id')
    updateThread(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { isRead?: boolean; needsReply?: boolean }) {
        return this.comments.updateThread(id, this.scope(req), { isRead: body?.isRead, needsReply: body?.needsReply });
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('comments/:id/reply')
    replyComment(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { text: string; mode?: 'public' | 'private'; targetId?: number }) {
        return this.comments.reply(id, this.scope(req), req.user.userId, {
            text: body?.text,
            mode: body?.mode === 'private' ? 'private' : 'public',
            targetId: body?.targetId ? +body.targetId : undefined,
        });
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('comments/:id/hide')
    hideComment(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { hidden?: boolean }) {
        return this.comments.setHidden(id, this.scope(req), body?.hidden !== false);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('comments/:id/lead')
    commentLead(@Req() req: any, @CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.comments.createLeadFromThread(id, this.scope(req), ctx, req.user.userId);
    }
}
