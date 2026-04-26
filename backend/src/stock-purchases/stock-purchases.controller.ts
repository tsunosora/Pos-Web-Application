import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { StockPurchasesService } from './stock-purchases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('stock-purchases')
export class StockPurchasesController {
    constructor(private readonly stockPurchasesService: StockPurchasesService) { }

    @Post()
    create(@Body() body: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.stockPurchasesService.create(body, branchCtx);
    }

    @Get()
    findAll(@CurrentBranch() branchCtx: BranchContext) {
        return this.stockPurchasesService.findAll(branchCtx);
    }
}
