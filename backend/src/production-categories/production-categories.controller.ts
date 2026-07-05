import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ProductionCategoriesService } from './production-categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type ProdCatBody = { name?: string; source?: string; measureBy?: string; isActive?: boolean; sortOrder?: number };

@UseGuards(JwtAuthGuard)
@Controller('production-categories')
export class ProductionCategoriesController {
    constructor(private readonly service: ProductionCategoriesService) {}

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Post()
    create(@Body() body: ProdCatBody) {
        return this.service.create(body as any);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: ProdCatBody) {
        return this.service.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
