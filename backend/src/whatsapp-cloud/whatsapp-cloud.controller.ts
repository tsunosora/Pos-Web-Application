import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req,
    Res,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { WaConversationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import {
    WhatsappCloudService,
    type CreateChannelInput,
    type UpdateChannelInput,
} from './whatsapp-cloud.service';
import { InboxService, type StartConversationInput } from './inbox.service';
import { MediaStorageService } from './media-storage.service';
import { TemplatesService, type CreateTemplateInput, type UpdateTemplateInput } from './templates.service';
import { BroadcastService, type CreateBroadcastInput, type SegmentDef } from './broadcast.service';
import { AutoReplyService, type CreateRuleInput } from './auto-reply.service';
import { RemindersService, type ReminderEvent, type SetReminderConfigInput } from './reminders.service';
import { AnalyticsService } from './analytics.service';
import { WaQrService, type CreateQrInput } from './qr.service';
import { WaQuickReplyService, type CreateQuickReplyInput, type UpdateQuickReplyInput } from './quick-reply.service';

// Manajemen kredensial: Owner/Admin. Inbox: + CS/Marketing (agen lapangan).
const ADMIN_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'] as const;
const INBOX_ROLES = [...ADMIN_ROLES, 'CS', 'MARKETING'] as const;
const TEMPLATE_ROLES = [...ADMIN_ROLES, 'MARKETING'] as const;

@Controller('whatsapp')
export class WhatsappCloudController {
    constructor(
        private readonly service: WhatsappCloudService,
        private readonly inbox: InboxService,
        private readonly mediaStore: MediaStorageService,
        private readonly templates: TemplatesService,
        private readonly broadcasts: BroadcastService,
        private readonly autoReplies: AutoReplyService,
        private readonly reminders: RemindersService,
        private readonly analytics: AnalyticsService,
        private readonly qr: WaQrService,
        private readonly quickReplies: WaQuickReplyService,
    ) {}

    // ─── Pesan cepat / canned message (semua peran inbox) ────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('quick-replies')
    listQuickReplies() {
        return this.quickReplies.list();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('quick-replies')
    createQuickReply(@Req() req: any, @Body() body: CreateQuickReplyInput) {
        return this.quickReplies.create(body, req.user.userId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Patch('quick-replies/:id')
    updateQuickReply(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateQuickReplyInput) {
        return this.quickReplies.update(id, body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Delete('quick-replies/:id')
    removeQuickReply(@Param('id', ParseIntPipe) id: number) {
        return this.quickReplies.remove(id);
    }

    // ─── QR klik-untuk-chat (Owner/Admin/Marketing) ──────────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Get('qr-links')
    listQrLinks() {
        return this.qr.list();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('qr-links')
    createQrLink(@Body() body: CreateQrInput) {
        return this.qr.create(body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Patch('qr-links/:id')
    updateQrLink(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<CreateQrInput> & { isActive?: boolean }) {
        return this.qr.update(id, body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Delete('qr-links/:id')
    removeQrLink(@Param('id', ParseIntPipe) id: number) {
        return this.qr.remove(id);
    }

    // ─── Analitik (Owner/Admin/Marketing) ────────────────────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Get('analytics')
    getAnalytics(@Query() query: Record<string, string>) {
        return this.analytics.overview({
            from: query.from || undefined,
            to: query.to || undefined,
            channelId: query.channelId ? +query.channelId : undefined,
        });
    }

    /** Benchmark kecepatan balas CS (First Response Time per agen). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Get('analytics/cs-benchmark')
    getCsBenchmark(@Query() query: Record<string, string>) {
        return this.analytics.csBenchmark({
            from: query.from || undefined,
            to: query.to || undefined,
            channelId: query.channelId ? +query.channelId : undefined,
            slaMinutes: query.slaMinutes ? +query.slaMinutes : undefined,
        });
    }

    /** Verifikasi kredensial Cloud API tiap channel aktif (tanpa kirim pesan). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Get('health')
    health() {
        return this.service.healthCheck();
    }

    // ─── Manajemen Channel (nomor per cabang) — Owner/Admin ──────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Get('channels')
    listChannels() {
        return this.service.listChannels();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Post('channels')
    createChannel(@Body() body: CreateChannelInput) {
        return this.service.createChannel(body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Patch('channels/:id')
    updateChannel(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateChannelInput) {
        return this.service.updateChannel(id, body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Delete('channels/:id')
    deleteChannel(@Param('id', ParseIntPipe) id: number) {
        return this.service.deleteChannel(id);
    }

    /** Profil bisnis WhatsApp channel (about, deskripsi, alamat, email, website, kategori). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Get('channels/:id/profile')
    getChannelProfile(@Param('id', ParseIntPipe) id: number) {
        return this.service.getChannelProfile(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Patch('channels/:id/profile')
    updateChannelProfile(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { about?: string; address?: string; description?: string; email?: string; vertical?: string; websites?: string[] },
    ) {
        return this.service.updateChannelProfile(id, body);
    }

    /** Ganti foto profil channel (JPG/PNG, maks 5MB). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Post('channels/:id/profile-picture')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
    updateChannelProfilePicture(
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.service.updateChannelProfilePicture(id, file);
    }

    // ─── Template Meta (Owner/Admin/Marketing) ──────────────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Get('templates')
    listTemplates() {
        return this.templates.list();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('templates')
    createTemplate(@Req() req: any, @Body() body: CreateTemplateInput) {
        return this.templates.create(body, req.user?.userId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('templates/sync')
    syncTemplates(@Body() body: { channelId: number }) {
        return this.templates.syncFromMeta(body.channelId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Patch('templates/:id')
    updateTemplate(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateTemplateInput) {
        return this.templates.update(id, body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Delete('templates/:id')
    deleteTemplate(@Param('id', ParseIntPipe) id: number) {
        return this.templates.remove(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('templates/:id/submit')
    submitTemplate(@Param('id', ParseIntPipe) id: number, @Body() body: { channelId: number }) {
        return this.templates.submit(id, body.channelId);
    }

    // ─── Reminder POS (Owner/Admin/Marketing) ───────────────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Get('reminders/config')
    reminderConfigs() {
        return this.reminders.getConfigs();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Patch('reminders/config/:eventType')
    setReminderConfig(@Param('eventType') eventType: ReminderEvent, @Body() body: SetReminderConfigInput) {
        return this.reminders.setConfig(eventType, body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('reminders/order-ready/:transactionId')
    async triggerOrderReady(@Param('transactionId', ParseIntPipe) transactionId: number) {
        await this.reminders.sendOrderReady(transactionId);
        return { ok: true };
    }

    // ─── Auto-reply (Owner/Admin/Marketing) ─────────────────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Get('auto-replies')
    listAutoReplies() {
        return this.autoReplies.listRules();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('auto-replies')
    createAutoReply(@Body() body: CreateRuleInput) {
        return this.autoReplies.createRule(body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Patch('auto-replies/:id')
    updateAutoReply(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<CreateRuleInput>) {
        return this.autoReplies.updateRule(id, body);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Delete('auto-replies/:id')
    deleteAutoReply(@Param('id', ParseIntPipe) id: number) {
        return this.autoReplies.removeRule(id);
    }

    // ─── Broadcast (Owner/Admin/Marketing) ──────────────────────────────────

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Get('broadcasts')
    listBroadcasts() {
        return this.broadcasts.list();
    }

    /** Daftar kontak untuk pilih manual di broadcast (opt-out dikecualikan, maks 500). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Get('broadcast-contacts')
    broadcastContacts(@Query() query: Record<string, string>) {
        return this.broadcasts.listContacts(query.q);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('broadcasts/preview')
    previewBroadcast(@Body() body: { segment?: SegmentDef; numbers?: string[] }) {
        if (body.numbers?.length) return this.broadcasts.previewNumbers(body.numbers);
        return this.broadcasts.preview(body.segment);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('broadcasts')
    createBroadcast(@Req() req: any, @Body() body: CreateBroadcastInput) {
        return this.broadcasts.create(body, req.user?.userId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Get('broadcasts/:id')
    broadcastReport(@Param('id', ParseIntPipe) id: number) {
        return this.broadcasts.report(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('broadcasts/:id/run')
    runBroadcast(@Param('id', ParseIntPipe) id: number) {
        return this.broadcasts.run(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('broadcasts/:id/pause')
    pauseBroadcast(@Param('id', ParseIntPipe) id: number) {
        return this.broadcasts.pause(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('broadcasts/:id/resume')
    resumeBroadcast(@Param('id', ParseIntPipe) id: number) {
        return this.broadcasts.resume(id);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('broadcasts/:id/cancel')
    cancelBroadcast(@Param('id', ParseIntPipe) id: number) {
        return this.broadcasts.cancel(id);
    }

    // ─── Inbox ───────────────────────────────────────────────────────────────

    /** Daftar percakapan. Non-admin otomatis dibatasi ke cabangnya sendiri. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('conversations')
    listConversations(@Req() req: any, @Query() query: Record<string, string>) {
        const roleName = String(req.user?.roleName || '').toUpperCase();
        const privileged = (ADMIN_ROLES as readonly string[]).includes(roleName);
        const branchId = privileged
            ? query.branchId
                ? +query.branchId
                : undefined
            : (req.user?.branchId ?? undefined);
        return this.inbox.listConversations({
            status: query.status as WaConversationStatus | undefined,
            assignedToId: query.assignedToId ? +query.assignedToId : undefined,
            channelId: query.channelId ? +query.channelId : undefined,
            branchId,
            q: query.q || undefined,
            cursor: query.cursor ? +query.cursor : undefined,
            take: query.take ? +query.take : undefined,
        });
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('conversations/:id')
    getConversation(@Param('id', ParseIntPipe) id: number) {
        return this.inbox.getConversation(id);
    }

    /** Resolve percakapan WA dari leadId (deep-link "Buka chat WA"). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('leads/:leadId/conversation')
    resolveConversationByLead(@Param('leadId', ParseIntPipe) leadId: number) {
        return this.inbox.resolveConversation(leadId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('conversations/:id/messages')
    getMessages(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
        return this.inbox.getMessages(id, {
            cursor: query.cursor ? +query.cursor : undefined,
            take: query.take ? +query.take : undefined,
        });
    }

    /** Proxy biner media inbound (gambar/dokumen/audio/video) — backend pegang token Meta. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Get('messages/:id/media')
    async getMessageMedia(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
        const { buffer, contentType, filename } = await this.inbox.getMessageMedia(id);
        const safeName = filename.replace(/["\r\n]/g, '');
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${safeName}"`);
        res.setHeader('Cache-Control', 'private, max-age=3600');
        res.send(buffer);
    }

    // ─── Penyimpanan media (Owner/Admin) ─────────────────────────────────────

    /** Statistik disk media WA: total dipakai, jumlah file, sisa disk server, per bulan. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Get('media/storage/stats')
    mediaStats() {
        return this.mediaStore.stats();
    }

    /** Bersihkan berkas media sebelum tanggal tertentu (riwayat teks tetap). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Post('media/storage/cleanup')
    mediaCleanup(@Body() body: { before?: string }) {
        const before = body?.before ? new Date(body.before) : null;
        if (!before || Number.isNaN(before.getTime())) {
            throw new BadRequestException('Parameter "before" (tanggal) wajib & valid');
        }
        return this.mediaStore.cleanupBefore(before);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Patch('conversations/:id')
    updateConversation(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { assignedToId?: number | null; status?: WaConversationStatus; snoozedUntil?: string | null },
    ) {
        return this.inbox.updateConversation(id, {
            assignedToId: body.assignedToId,
            status: body.status,
            snoozedUntil:
                body.snoozedUntil === undefined ? undefined : body.snoozedUntil ? new Date(body.snoozedUntil) : null,
        });
    }

    /** Chat Baru: simpan nomor baru + kirim template pembuka → buka percakapan. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('conversations/start')
    startConversation(@Req() req: any, @Body() body: StartConversationInput) {
        return this.inbox.startConversation(req.user.userId, body);
    }

    /** Balas teks (hanya sah di dalam jendela 24 jam → 409 bila lewat). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('conversations/:id/reply')
    reply(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { text: string; replyTo?: string }) {
        return this.inbox.replyText(id, req.user.userId, body.text, body.replyTo);
    }

    /** Balas via template (sah kapan pun, termasuk luar jendela 24 jam). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('conversations/:id/reply-template')
    replyTemplate(
        @Req() req: any,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { name: string; language?: string; components?: any[]; previewText?: string },
    ) {
        return this.inbox.replyTemplate(id, req.user.userId, body);
    }

    /** Balas dengan lampiran media (gambar/dokumen/file) — hanya di jendela 24 jam. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('conversations/:id/reply-media')
    @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 90 * 1024 * 1024 } }))
    replyMedia(
        @Req() req: any,
        @Param('id', ParseIntPipe) id: number,
        @UploadedFile() file: Express.Multer.File,
        @Body() body: { caption?: string; replyTo?: string },
    ) {
        return this.inbox.replyMedia(id, req.user.userId, file, body?.caption, body?.replyTo);
    }

    /** Reaksi emoji ke sebuah pesan (emoji kosong = hapus reaksi). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('messages/:id/react')
    react(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { emoji?: string }) {
        return this.inbox.reactToMessage(id, req.user.userId, body?.emoji ?? '');
    }
}
