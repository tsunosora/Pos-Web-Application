import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { CashflowRequestsService } from './cashflow-requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('cashflow-requests')
export class CashflowRequestsController {
    constructor(private readonly service: CashflowRequestsService) { }

    @Post()
    create(
        @Request() req: any,
        @Body() body: {
            cashflowId: number;
            type: 'EDIT' | 'DELETE';
            payload?: Record<string, any>;
            requesterNote?: string;
        },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.service.createRequest(
            req.user.userId,
            body.cashflowId,
            body.type,
            body.payload ?? null,
            body.requesterNote,
            branchCtx,
        );
    }

    @Get('pending')
    getPending(@CurrentBranch() branchCtx: BranchContext) {
        return this.service.findPending(branchCtx);
    }

    @Get('mine')
    getMine(@Request() req: any) {
        return this.service.findByRequester(req.user.userId);
    }

    @Patch(':id/approve')
    approve(
        @Param('id') id: string,
        @Request() req: any,
        @Body() body: { reviewerNote?: string },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.service.approve(+id, req.user.userId, req.user.role, body.reviewerNote, branchCtx);
    }

    @Patch(':id/reject')
    reject(
        @Param('id') id: string,
        @Request() req: any,
        @Body() body: { reviewerNote: string },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.service.reject(+id, req.user.userId, req.user.role, body.reviewerNote, branchCtx);
    }
}
