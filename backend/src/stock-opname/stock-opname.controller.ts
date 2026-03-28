import {
    Controller, Get, Post, Patch, Param, Body, UseGuards,
} from '@nestjs/common';
import { StockOpnameService } from './stock-opname.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// ─── Admin endpoints (butuh login JWT) ────────────────────────────────────────
@UseGuards(JwtAuthGuard)
@Controller('stock-opname/sessions')
export class StockOpnameAdminController {
    constructor(private readonly svc: StockOpnameService) {}

    @Post()
    start(@Body() dto: { notes?: string; categoryId?: number; expiresHours?: number }) {
        return this.svc.startSession(dto);
    }

    @Get()
    list() {
        return this.svc.getSessions();
    }

    @Get(':id')
    detail(@Param('id') id: string) {
        return this.svc.getSessionDetail(id);
    }

    @Patch(':id/cancel')
    cancel(@Param('id') id: string) {
        return this.svc.cancelSession(id);
    }

    @Post(':id/finish')
    finish(
        @Param('id') id: string,
        @Body() dto: { confirmedItems: { productVariantId: number; confirmedStock: number }[] },
    ) {
        return this.svc.finishSession(id, dto.confirmedItems);
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
