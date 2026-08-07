import {
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
import { InboxService } from './inbox.service';
import { TemplatesService, type CreateTemplateInput, type UpdateTemplateInput } from './templates.service';
import { BroadcastService, type CreateBroadcastInput, type SegmentDef } from './broadcast.service';
import { AutoReplyService, type CreateRuleInput } from './auto-reply.service';
import { RemindersService, type ReminderEvent, type SetReminderConfigInput } from './reminders.service';
import { AnalyticsService } from './analytics.service';

// Manajemen kredensial: Owner/Admin. Inbox: + CS/Marketing (agen lapangan).
const ADMIN_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'] as const;
const INBOX_ROLES = [...ADMIN_ROLES, 'CS', 'MARKETING'] as const;
const TEMPLATE_ROLES = [...ADMIN_ROLES, 'MARKETING'] as const;

@Controller('whatsapp')
export class WhatsappCloudController {
    constructor(
        private readonly service: WhatsappCloudService,
        private readonly inbox: InboxService,
        private readonly templates: TemplatesService,
        private readonly broadcasts: BroadcastService,
        private readonly autoReplies: AutoReplyService,
        private readonly reminders: RemindersService,
        private readonly analytics: AnalyticsService,
    ) {}

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

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...TEMPLATE_ROLES)
    @Post('broadcasts/preview')
    previewBroadcast(@Body() body: { segment?: SegmentDef }) {
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

    /** Balas teks (hanya sah di dalam jendela 24 jam → 409 bila lewat). */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('conversations/:id/reply')
    reply(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { text: string }) {
        return this.inbox.replyText(id, req.user.userId, body.text);
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
        @Body() body: { caption?: string },
    ) {
        return this.inbox.replyMedia(id, req.user.userId, file, body?.caption);
    }
}
