import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SocialInboxService, type CreateSocialChannelInput } from './social-inbox.service';

const ADMIN_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'] as const;
const INBOX_ROLES = [...ADMIN_ROLES, 'CS', 'MARKETING'] as const;

@Controller('social')
export class MetaMessagingController {
    constructor(private readonly inbox: SocialInboxService) {}

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

    /** Deteksi IG business account yang terhubung ke Page. */
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...ADMIN_ROLES)
    @Post('detect-ig')
    detectIg(@Body() body: { pageId: string; accessToken: string }) {
        return this.inbox.detectInstagram(body.pageId, body.accessToken);
    }

    // ─── Inbox (Owner/Admin/CS/Marketing) ────────────────────────────────────
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
    getMessages(@Param('id', ParseIntPipe) id: number, @Query() query: Record<string, string>) {
        return this.inbox.getMessages(id, { take: query.take ? +query.take : undefined, cursor: query.cursor ? +query.cursor : undefined });
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(...INBOX_ROLES)
    @Post('conversations/:id/reply')
    reply(@Req() req: any, @Param('id', ParseIntPipe) id: number, @Body() body: { text: string }) {
        return this.inbox.reply(id, req.user.userId, body.text);
    }
}
