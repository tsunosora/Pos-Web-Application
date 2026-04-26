import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { StockTransfersService } from './stock-transfers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('stock-transfers')
export class StockTransfersController {
    constructor(private readonly svc: StockTransfersService) {}

    @Post()
    create(
        @Body() body: {
            fromBranchId: number;
            toBranchId: number;
            items: { productVariantId: number; quantity: number }[];
            notes?: string;
        },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.svc.createTransfer(body, branchCtx);
    }

    @Get()
    list(@CurrentBranch() branchCtx: BranchContext) {
        return this.svc.listTransfers(branchCtx);
    }
}
