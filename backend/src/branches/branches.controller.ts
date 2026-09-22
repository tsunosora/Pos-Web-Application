import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';

@UseGuards(JwtAuthGuard)
@Controller('branches')
export class BranchesController {
    constructor(private readonly branchesService: BranchesService) { }

    @Get()
    findAll() {
        return this.branchesService.findAll();
    }

    // Titik cabang di Peta Cuan (omzet/margin): menulis = setingkat manajer, sama dgn data pesaing.
    @Post()
    @UseGuards(ManagerGuard)
    create(@Body() data: { name: string; address?: string; latitude: number; longitude: number; omset?: number; margin?: number }) {
        return this.branchesService.create(data);
    }

    @Patch(':id')
    @UseGuards(ManagerGuard)
    update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
        return this.branchesService.update(id, data);
    }

    @Delete(':id')
    @UseGuards(ManagerGuard)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.branchesService.remove(id);
    }
}
