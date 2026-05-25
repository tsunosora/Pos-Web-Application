import {
    Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, Req, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CurrentBranch } from '../../common/branch-context.decorator';
import type { BranchContext } from '../../common/branch-context.decorator';
import { CreateFollowUpDto, FollowUpsService, FollowUpStatus, FollowUpType } from './follow-ups.service';

@UseGuards(JwtAuthGuard)
@Controller('crm/follow-ups')
export class FollowUpsController {
    constructor(private readonly fu: FollowUpsService) {}

    @Get()
    list(
        @CurrentBranch() ctx: BranchContext,
        @Query('status') status?: string,
        @Query('type') type?: string,
        @Query('assignedToId') assignedToId?: string,
        @Query('dueBefore') dueBefore?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
    ) {
        return this.fu.list(ctx, {
            status: status as FollowUpStatus,
            type: type as FollowUpType,
            assignedToId: assignedToId ? +assignedToId : undefined,
            dueBefore,
            page: page ? +page : undefined,
            limit: limit ? +limit : undefined,
        });
    }

    @Get('badge-count')
    badgeCount(@CurrentBranch() ctx: BranchContext, @Req() req: any, @Query('mine') mine?: string) {
        const userId = mine === 'true' ? req?.user?.id : undefined;
        return this.fu.badgeCount(ctx, userId);
    }

    @Get(':id')
    detail(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.fu.detail(ctx, id);
    }

    @Post()
    create(
        @CurrentBranch() ctx: BranchContext,
        @Body() data: CreateFollowUpDto,
        @Req() req: any,
    ) {
        return this.fu.create(ctx, data, req?.user?.id);
    }

    @Patch(':id/done')
    markDone(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { notes?: string },
        @Req() req: any,
    ) {
        return this.fu.markDone(ctx, id, body?.notes, req?.user?.id);
    }

    @Patch(':id/skip')
    skip(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number, @Req() req: any) {
        return this.fu.skip(ctx, id, req?.user?.id);
    }

    @Delete(':id')
    remove(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.fu.remove(ctx, id);
    }
}
