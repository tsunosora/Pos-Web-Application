import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
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
    findAllWithStats(
        @Query('page') page?: string,
        @Query('pageSize') pageSize?: string,
        @Query('search') search?: string,
    ) {
        return this.customersService.findAllWithStats({
            page: page ? Number(page) : 1,
            pageSize: pageSize ? Number(pageSize) : 20,
            search: search || '',
        });
    }

    @Get('summary')
    summary() {
        return this.customersService.summaryStats();
    }

    /** Rapikan & gabungkan customer duplikat (normalisasi nomor + merge by nomor). */
    @Post('dedupe')
    dedupe() {
        return this.customersService.dedupe();
    }

    @Get('lookup')
    lookup(@Query('phone') phone?: string, @Query('name') name?: string) {
        if (name && name.trim()) return this.customersService.searchByName(name);
        return this.customersService.lookupByPhone(phone || '');
    }

    @Get('export-data')
    findAllForExport() {
        return this.customersService.findAllForExport();
    }

    @Get(':id/analytics')
    getAnalytics(@Param('id') id: string) {
        return this.customersService.getAnalytics(+id);
    }

    @Get(':id/crm-timeline')
    getCrmTimeline(@Param('id') id: string) {
        return this.customersService.getCrmTimeline(+id);
    }

    @Patch(':id')
    update(
        @Param('id') id: string,
        @Body() data: { name?: string; phone?: string; address?: string; assignedCsId?: number | null; tags?: any },
    ) {
        return this.customersService.update(+id, data);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.customersService.remove(+id);
    }
}
