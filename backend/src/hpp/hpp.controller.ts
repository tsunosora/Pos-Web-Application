import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { HppService } from './hpp.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('hpp')
export class HppController {
    constructor(private readonly hppService: HppService) { }

    @Post()
    create(@Body() data: any) {
        return this.hppService.create(data);
    }

    @Get()
    findAll() {
        return this.hppService.findAll();
    }

    @Get(':id')
    findOne(@Param('id') id: string) {
        return this.hppService.findOne(+id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() data: any) {
        return this.hppService.update(+id, data);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.hppService.remove(+id);
    }
}
