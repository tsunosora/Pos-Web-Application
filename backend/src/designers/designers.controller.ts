import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { DesignersService } from './designers.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/** Endpoint publik — tidak perlu JWT (hanya nama + verifikasi PIN) */
@Controller('designers')
export class DesignersPublicController {
    constructor(private readonly service: DesignersService) {}

    @Get('public')
    listPublic() {
        return this.service.listPublic();
    }

    @Post('public/verify')
    verifyPin(@Body() body: { id: number; pin: string }) {
        return this.service.verifyPin(Number(body.id), body.pin);
    }
}

/** Endpoint admin — butuh JWT */
@UseGuards(JwtAuthGuard)
@Controller('designers')
export class DesignersAdminController {
    constructor(private readonly service: DesignersService) {}

    @Get()
    findAll() {
        return this.service.findAll();
    }

    @Post()
    create(@Body() body: { name: string; pin: string }) {
        return this.service.create(body);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: { name?: string; pin?: string; isActive?: boolean }) {
        return this.service.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.service.remove(id);
    }
}
