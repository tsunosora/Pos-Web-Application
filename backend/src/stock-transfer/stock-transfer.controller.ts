import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StockTransferService } from './stock-transfer.service';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

interface CreateTransferDto {
    fromBranchId: number;
    toBranchId: number;
    notes?: string | null;
    items: { productVariantId: number; quantity: number; note?: string | null }[];
}

@UseGuards(JwtAuthGuard)
@Controller('stock-transfers')
export class StockTransferController {
    constructor(private readonly service: StockTransferService) {}

    @Get()
    list(@CurrentBranch() ctx: BranchContext) {
        return this.service.list(ctx);
    }

    @Get(':id')
    getOne(@Param('id', ParseIntPipe) id: number, @CurrentBranch() ctx: BranchContext) {
        return this.service.getById(id, ctx);
    }

    @Post()
    create(@Body() body: CreateTransferDto, @CurrentBranch() ctx: BranchContext, @Req() req: any) {
        return this.service.create(body, ctx, req.user?.userId ?? null);
    }
}
