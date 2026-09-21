import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, UseGuards } from '@nestjs/common';
import { UnitsService } from './units.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';

@UseGuards(JwtAuthGuard)
@Controller('units')
export class UnitsController {
    constructor(private readonly unitsService: UnitsService) { }

    @Post()
    create(@Body() createUnitDto: { name: string }) {
        return this.unitsService.create(createUnitDto);
    }

    @Get()
    findAll() {
        return this.unitsService.findAll();
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.unitsService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() updateUnitDto: { name: string }) {
        return this.unitsService.update(id, updateUnitDto);
    }

    // Menghapus data induk: setingkat manajer (T-46).
    @Delete(':id')
    @UseGuards(ManagerGuard)
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.unitsService.remove(id);
    }
}
