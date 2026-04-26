import { Controller, Get, Post, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BranchStockService } from './branch-stock.service';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';
import { requireBranch } from '../common/branch-where.helper';

@UseGuards(JwtAuthGuard)
@Controller('branch-stock')
export class BranchStockController {
    constructor(private readonly service: BranchStockService) {}

    @Get('list')
    list(@CurrentBranch() ctx: BranchContext) {
        return this.service.listForBranch(ctx);
    }

    @Get('matrix')
    matrix() {
        return this.service.matrixView();
    }

    @Get('variant/:variantId')
    async getStock(
        @Param('variantId', ParseIntPipe) variantId: number,
        @CurrentBranch() ctx: BranchContext,
        @Query('branchId') branchIdQuery?: string,
    ) {
        const branchId = branchIdQuery ? Number(branchIdQuery) : requireBranch(ctx);
        const stock = await this.service.getStock(branchId, variantId);
        return { branchId, productVariantId: variantId, stock };
    }

    @Post('adjust')
    adjust(
        @Body() body: { branchId: number; productVariantId: number; newStock: number; reason?: string },
        @CurrentBranch() ctx: BranchContext,
    ) {
        // Owner mode "Semua Cabang" tetap boleh adjust dengan branchId di body.
        // Staff: harus sesuai cabangnya sendiri.
        if (!ctx.isOwner && body.branchId !== ctx.userBranchId) {
            throw new Error('Tidak boleh adjust stok cabang lain.');
        }
        return this.service.adjustStock(body.branchId, body.productVariantId, body.newStock, body.reason);
    }
}
