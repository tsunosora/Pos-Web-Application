import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CompanyBranchesService } from './company-branches.service';

@UseGuards(JwtAuthGuard)
@Controller('company-branches')
export class CompanyBranchesController {
    constructor(private readonly service: CompanyBranchesService) {}

    @Get()
    findAll() { return this.service.findAll(); }

    @Get('active')
    findAllActive() { return this.service.findAllActive(); }

    @Post()
    create(
        @Body() body: {
            name: string; address?: string; phone?: string;
            code?: string; notaHeader?: string; notaFooter?: string; logoUrl?: string;
        },
    ) {
        return this.service.create(body);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            name?: string; address?: string; phone?: string; isActive?: boolean;
            code?: string | null; notaHeader?: string | null; notaFooter?: string | null; logoUrl?: string | null;
        },
    ) { return this.service.update(id, body); }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.service.remove(id); }
}
