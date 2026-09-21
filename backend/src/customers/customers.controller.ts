import {
    Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query,
    UseInterceptors, HttpCode, BadRequestException,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/role-groups';
import { DesignersService } from '../designers/designers.service';
import { PinThrottleInterceptor } from '../auth/pin-throttle.interceptor';

/**
 * Portal desainer (tanpa JWT): cari customer terdaftar. Wajib PIN desainer (dibatasi
 * tebakan), minimal 3 huruf, maks 20 baris, HP disamarkan, tanpa alamat. Dulu GET
 * terbuka mengembalikan SEMUA customer lengkap dengan HP & alamat.
 */
@UseInterceptors(PinThrottleInterceptor)
@Controller('customers')
export class CustomersPublicController {
    constructor(
        private readonly customersService: CustomersService,
        private readonly designersService: DesignersService,
    ) {}

    @Post('public/search')
    @HttpCode(200) // hanya baca
    async searchPublic(@Body() body: { designerId: number; pin: string; q?: string }) {
        const r = await this.designersService.verifyPin(Number(body?.designerId), body?.pin);
        if (!r.valid) throw new BadRequestException('PIN desainer tidak valid');
        return this.customersService.searchPublic(String(body?.q ?? ''));
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
    @UseGuards(ManagerGuard)
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
    @UseGuards(ManagerGuard)
    remove(@Param('id') id: string) {
        return this.customersService.remove(+id);
    }
}
