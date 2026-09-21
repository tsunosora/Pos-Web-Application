import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CompetitorsService } from './competitors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';

@UseGuards(JwtAuthGuard)
@Controller('competitors')
export class CompetitorsController {
    constructor(private readonly competitorsService: CompetitorsService) { }

    @Get()
    findAll() {
        return this.competitorsService.findAll();
    }

    // Mengubah data pesaing = setingkat manajer (dulu semua akun login, termasuk hapus semua).
    @Post()
    @UseGuards(ManagerGuard)
    create(@Body() data: { name: string; type?: string; address?: string; latitude: number; longitude: number; notes?: string }) {
        return this.competitorsService.create(data);
    }

    @Patch(':id')
    @UseGuards(ManagerGuard)
    update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
        return this.competitorsService.update(id, data);
    }

    @Delete(':id')
    @UseGuards(ManagerGuard)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.competitorsService.remove(id);
    }
}
