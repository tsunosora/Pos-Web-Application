import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { StockMovementsService } from './stock-movements.service';
import { MovementType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Menu, MenuGuard } from '../auth/role-groups';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

@UseGuards(JwtAuthGuard)
@Controller('stock-movements')
export class StockMovementsController {
    constructor(private readonly stockMovementsService: StockMovementsService) { }

    // Mengubah stok = peran yang punya menu Stok (dulu cukup login, mis. akun desainer).
    @Post()
    @Menu('/inventory')
    @UseGuards(MenuGuard)
    create(
        @Body() createMovementDto: { productVariantId: number; type: MovementType; quantity: number; reason?: string },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.stockMovementsService.create(createMovementDto, branchCtx);
    }

    @Get()
    findAll(
        @CurrentBranch() branchCtx: BranchContext,
        @Query('startDate') startDate?: string,
        @Query('endDate')   endDate?: string,
        @Query('type')      type?: MovementType,
        @Query('search')    search?: string,
    ) {
        return this.stockMovementsService.findAll({ startDate, endDate, type, search }, branchCtx);
    }

    @Get('waste')
    findWaste(
        @Query('variantId') variantId: string,
        @Query('since') since: string,
    ) {
        return this.stockMovementsService.findWasteByVariantSince(
            parseInt(variantId),
            since ? new Date(since) : new Date(0),
        );
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.stockMovementsService.findOne(id);
    }
}
