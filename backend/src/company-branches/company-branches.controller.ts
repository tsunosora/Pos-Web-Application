import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
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

    @Post()
    @UseGuards(JwtAuthGuard)
    create(
        @Body() body: {
            name: string; address?: string; phone?: string;
            code?: string; notaHeader?: string; notaFooter?: string; logoUrl?: string;
        },
    ) {
        return this.service.create(body);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard)
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            name?: string; address?: string; phone?: string; isActive?: boolean;
            code?: string | null; notaHeader?: string | null; notaFooter?: string | null; logoUrl?: string | null;
        },
    ) { return this.service.update(id, body); }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
