import {
    Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TemplatesService } from './templates.service';

@UseGuards(JwtAuthGuard)
@Controller('crm/templates')
export class TemplatesController {
    constructor(private readonly templates: TemplatesService) {}

    @Get()
    list(
        @Query('category') category?: string,
        @Query('activeOnly') activeOnly?: string,
    ) {
        return this.templates.list(category, activeOnly === 'true');
    }

    @Get(':id')
    detail(@Param('id', ParseIntPipe) id: number) {
        return this.templates.detail(id);
    }

    @Post()
    create(@Body() data: { name: string; category: string; bodyTemplate: string; isActive?: boolean }) {
        return this.templates.create(data);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { name?: string; category?: string; bodyTemplate?: string; isActive?: boolean },
    ) {
        return this.templates.update(id, data);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.templates.remove(id);
    }

    @Get(':id/render')
    render(
        @Param('id', ParseIntPipe) id: number,
        @Query('leadId') leadId?: string,
        @Query('customerId') customerId?: string,
        @Query('salesOrderId') salesOrderId?: string,
    ) {
        return this.templates.render(id, {
            leadId: leadId ? +leadId : undefined,
            customerId: customerId ? +customerId : undefined,
            salesOrderId: salesOrderId ? +salesOrderId : undefined,
        });
    }

    @Post('seed-defaults')
    seed() {
        return this.templates.seedDefaults();
    }
}
