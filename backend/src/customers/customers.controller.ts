import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/** Endpoint publik — nama + HP saja (untuk portal desainer tanpa JWT) */
@Controller('customers')
export class CustomersPublicController {
    constructor(private readonly customersService: CustomersService) {}

    @Get('public')
    listPublic() {
        return this.customersService.findAll().then((list: any[]) =>
            list.map(c => ({ id: c.id, name: c.name, phone: c.phone ?? null, address: c.address ?? null }))
        );
    }
}

@UseGuards(JwtAuthGuard)
@Controller('customers')
export class CustomersController {
    constructor(private readonly customersService: CustomersService) { }

    @Post()
    create(@Body() data: { name: string; phone?: string; address?: string }) {
        return this.customersService.create(data);
    }

    @Get()
    findAll() {
        return this.customersService.findAll();
    }

    @Get('with-stats')
    findAllWithStats() {
        return this.customersService.findAllWithStats();
    }

    @Get('export-data')
    findAllForExport() {
        return this.customersService.findAllForExport();
    }

    @Get(':id/analytics')
    getAnalytics(@Param('id') id: string) {
        return this.customersService.getAnalytics(+id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() data: { name?: string; phone?: string; address?: string }) {
        return this.customersService.update(+id, data);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.customersService.remove(+id);
    }
}
