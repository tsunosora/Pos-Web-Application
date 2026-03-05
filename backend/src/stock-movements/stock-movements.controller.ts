import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { StockMovementsService } from './stock-movements.service';
import { MovementType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('stock-movements')
export class StockMovementsController {
    constructor(private readonly stockMovementsService: StockMovementsService) { }

    @Post()
    create(@Body() createMovementDto: { productVariantId: number; type: MovementType; quantity: number; reason?: string }) {
        return this.stockMovementsService.create(createMovementDto);
    }

    @Get()
    findAll() {
        return this.stockMovementsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.stockMovementsService.findOne(id);
    }
}
