import {
    Controller, Get, Post, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { StockOpnameService } from './stock-opname.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentBranch } from '../common/branch-context.decorator';
import type { BranchContext } from '../common/branch-context.decorator';

// ─── Admin endpoints (butuh login JWT) ────────────────────────────────────────
@UseGuards(JwtAuthGuard)
@Controller('stock-opname/sessions')
export class StockOpnameAdminController {
    constructor(private readonly svc: StockOpnameService) {}

    @Post()
    start(
        @Body() dto: { notes?: string; categoryId?: number; expiresHours?: number },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.svc.startSession(dto, branchCtx);
    }

    @Get()
    list(@CurrentBranch() branchCtx: BranchContext) {
        return this.svc.getSessions(branchCtx);
    }

    @Get(':id')
    detail(@Param('id') id: string, @CurrentBranch() branchCtx: BranchContext) {
        return this.svc.getSessionDetail(id, branchCtx);
    }

    @Patch(':id/cancel')
    cancel(@Param('id') id: string, @CurrentBranch() branchCtx: BranchContext) {
        return this.svc.cancelSession(id, branchCtx);
    }

    @Post(':id/finish')
    finish(
        @Param('id') id: string,
        @Body() dto: { confirmedItems: { productVariantId: number; confirmedStock: number }[] },
        @CurrentBranch() branchCtx: BranchContext,
    ) {
        return this.svc.finishSession(id, dto.confirmedItems, branchCtx);
    }
}

// ─── Public endpoints (hanya token URL, tanpa JWT) ────────────────────────────
@Controller('stock-opname/public')
export class StockOpnamePublicController {
    constructor(private readonly svc: StockOpnameService) {}

    @Get(':token/verify')
    verify(@Param('token') token: string) {
        return this.svc.verifyToken(token);
    }

    @Get(':token/products')
    products(@Param('token') token: string) {
        return this.svc.getProductsForToken(token);
    }

    @Post(':token/submit')
    submit(
        @Param('token') token: string,
        @Body() dto: {
            operatorName: string;
            items: {
                productVariantId: number;
                actualStock: number;
                isEstimated?: boolean;
                estimationNotes?: string;
            }[];
        },
    ) {
        return this.svc.submitItems(token, dto);
    }
}
