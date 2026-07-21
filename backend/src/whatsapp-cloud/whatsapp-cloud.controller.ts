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
    UseGuards,
} from '@nestjs/common';
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
    ) {}

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
}
