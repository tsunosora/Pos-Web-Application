import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ProductionCategoriesService } from './production-categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';

type ProdCatBody = { name?: string; source?: string; measureBy?: string; isActive?: boolean; sortOrder?: number };

@UseGuards(JwtAuthGuard)
@Controller('production-categories')
export class ProductionCategoriesController {
    constructor(private readonly service: ProductionCategoriesService) {}

    @Get()
    findAll() {
        return this.service.findAll();
    }

    // Mengubah/menghapus kategori produksi menggeser pengelompokan KPI operator → setingkat manajer
    // (sama dengan kategori & satuan, T-46).
    @Post()
    @UseGuards(ManagerGuard)
    create(@Body() body: ProdCatBody) {
        return this.service.create(body as any);
    }

    @Patch(':id')
    @UseGuards(ManagerGuard)
    update(@Param('id', ParseIntPipe) id: number, @Body() body: ProdCatBody) {
        return this.service.update(id, body);
    }

    @Delete(':id')
    @UseGuards(ManagerGuard)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
