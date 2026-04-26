import { Controller, Get, Post, Body, Param, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { BranchLedgerService } from './branch-ledger.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('branch-ledger')
export class BranchLedgerController {
    constructor(private readonly service: BranchLedgerService) { }

    @Get()
    list(
        @CurrentBranch() ctx: BranchContext,
        @Query('role') role?: string,
        @Query('status') status?: string,
    ) {
        return this.service.list(ctx, role, status);
    }

    @Get('summary')
    summary(@CurrentBranch() ctx: BranchContext) {
        return this.service.summary(ctx);
    }

    @Get(':id')
    detail(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.service.detail(ctx, id);
    }

    @Get(':id/bank-accounts')
    bankAccounts(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.service.getLedgerBankAccounts(ctx, id);
    }

    @Post(':id/settle-cash')
    settleCash(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            amount: number;
            bankAccountAId?: number | null;
            bankAccountBId?: number | null;
            notes?: string | null;
        },
    ) {
        return this.service.settleWithCash(ctx, id, body);
    }

    @Get(':id/from-branch-stock')
    fromBranchStock(@CurrentBranch() ctx: BranchContext, @Param('id', ParseIntPipe) id: number) {
        return this.service.listFromBranchStock(ctx, id);
    }

    @Post(':id/settle-stock')
    settleStock(
        @CurrentBranch() ctx: BranchContext,
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            productVariantId: number;
            quantity: number;
            notes?: string | null;
        },
    ) {
        return this.service.settleWithStock(ctx, id, body);
    }
}
