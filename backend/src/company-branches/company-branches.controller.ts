import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';
import { CompanyBranchesService } from './company-branches.service';

@Controller('company-branches')
export class CompanyBranchesController {
    constructor(private readonly service: CompanyBranchesService) {}

    // PUBLIC — untuk branch picker di halaman /produksi & /cetak yang public + PIN gated
    @Get('public-active')
    publicActive() { return this.service.findAllActive(); }

    @Get()
    @UseGuards(JwtAuthGuard)
    findAll() { return this.service.findAll(); }

    @Get('active')
    @UseGuards(JwtAuthGuard)
    findAllActive() { return this.service.findAllActive(); }

    // Menambah/mengubah/menghapus cabang (nama cabang ada di nomor dokumen): setingkat manajer (T-45).
    @Post()
    @UseGuards(JwtAuthGuard, ManagerGuard)
    create(
        @Body() body: {
            name: string; address?: string; phone?: string;
            code?: string; notaHeader?: string; notaFooter?: string; logoUrl?: string;
        },
    ) {
        return this.service.create(body);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, ManagerGuard)
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            name?: string; address?: string; phone?: string; isActive?: boolean;
            code?: string | null; notaHeader?: string | null; notaFooter?: string | null; logoUrl?: string | null;
            dailyTargetOverride?: number | null;
        },
    ) { return this.service.update(id, body); }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, ManagerGuard)
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
