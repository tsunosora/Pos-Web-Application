import { Controller, Get, Post, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { BranchInboxService } from './branch-inbox.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('branch-inbox')
export class BranchInboxController {
    constructor(private readonly service: BranchInboxService) { }

    @Get()
    list(@CurrentBranch() ctx: BranchContext, @Query('status') status?: string) {
        return this.service.list(ctx, status);
    }

    @Get('unread-count')
    unreadCount(@CurrentBranch() ctx: BranchContext) {
        return this.service.unreadCount(ctx);
    }

    @Get('ready-outbox')
    readyOutbox(@CurrentBranch() ctx: BranchContext) {
        return this.service.readyOutbox(ctx);
    }

    @Get('outbox')
    outbox(@CurrentBranch() ctx: BranchContext, @Query('status') status?: string) {
        return this.service.outbox(ctx, status);
    }

    @Post(':id/confirm-pickup')
    confirmPickup(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.service.confirmPickup(ctx, id);
    }

    @Get('debug/routing')
    debugRouting(@CurrentBranch() ctx: BranchContext) {
        return this.service.debugRouting(ctx);
    }

    @Get(':id')
    detail(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.service.getDetail(ctx, id);
    }

    @Post(':id/acknowledge')
    acknowledge(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.service.acknowledge(ctx, id);
    }

    @Post(':id/ready')
    markReady(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.service.markReady(ctx, id);
    }

    @Post(':id/handover')
    markHandover(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.service.markHandover(ctx, id);
    }
}
