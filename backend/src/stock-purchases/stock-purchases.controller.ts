import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { StockPurchasesService } from './stock-purchases.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Menu, MenuGuard } from '../auth/role-groups';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('stock-purchases')
export class StockPurchasesController {
    constructor(private readonly stockPurchasesService: StockPurchasesService) { }

    // Mengubah stok = peran yang punya menu Stok (dulu cukup login, mis. akun desainer).
    @Post()
    @Menu('/inventory')
    @UseGuards(MenuGuard)
    create(@Body() body: any, @CurrentBranch() branchCtx: BranchContext) {
        return this.stockPurchasesService.create(body, branchCtx);
    }

    @Get()
    @Menu('/inventory')
    @UseGuards(MenuGuard)
    findAll(@CurrentBranch() branchCtx: BranchContext) {
        return this.stockPurchasesService.findAll(branchCtx);
    }
}
