import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard, Menu, MenuGuard, isManagerLevelRole } from '../auth/role-groups';

@UseGuards(JwtAuthGuard)
@Controller('categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    // Menulis kategori = menu Stok; kolom yang menggeser KPI operator (hitung pcs, kategori produksi)
    // hanya setingkat manajer — sama alasannya dengan CRUD kategori produksi (T-46).
    @Post()
    @UseGuards(MenuGuard)
    @Menu('/inventory')
    create(@Body() body: { name: string; parentId?: number | null; countsAsPcs?: boolean; productionCategoryId?: number | null }, @Req() req: any) {
        return this.categoriesService.create(body, isManagerLevelRole(req.user?.roleName));
    }

    @Get()
    findAll() {
        return this.categoriesService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.categoriesService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(MenuGuard)
    @Menu('/inventory')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: { name: string; parentId?: number | null; countsAsPcs?: boolean; productionCategoryId?: number | null }, @Req() req: any) {
        return this.categoriesService.update(id, body, isManagerLevelRole(req.user?.roleName));
    }

    // Menghapus data induk: setingkat manajer (T-46).
    @Delete(':id')
    @UseGuards(ManagerGuard)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.categoriesService.remove(id);
    }
}
