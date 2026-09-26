import {
    Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Menu, MenuGuard } from '../../auth/role-groups';
import { CurrentBranch } from '../../common/branch-context.decorator';
import type { BranchContext } from '../../common/branch-context.decorator';
import { ButuhFitur } from '../../lisensi/butuh-fitur.decorator';
import { TemplatesService } from './templates.service';

// Template Pesan CRM (teks siap tempel untuk follow-up) → `crm.leads`, sama dengan pemetaan
// menu `/crm/templates` yang sudah ada di frontend. Ini BUKAN template Meta yang berbayar —
// yang itu `/whatsapp/templates` dan berkode `wa.cloud`.
@ButuhFitur('crm.leads')
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

    // Menulis template: pemegang menu Template Pesan saja (dulu cukup login).
    @Post()
    @UseGuards(MenuGuard)
    @Menu('/crm/templates')
    create(@Body() data: { name: string; category: string; bodyTemplate: string; isActive?: boolean }) {
        return this.templates.create(data);
    }

    @Patch(':id')
    @UseGuards(MenuGuard)
    @Menu('/crm/templates')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() data: { name?: string; category?: string; bodyTemplate?: string; isActive?: boolean },
    ) {
        return this.templates.update(id, data);
    }

    @Delete(':id')
    @UseGuards(MenuGuard)
    @Menu('/crm/templates')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.templates.remove(id);
    }

    @Get(':id/render')
    render(
        @Param('id', ParseIntPipe) id: number,
        @Query('leadId') leadId?: string,
        @Query('customerId') customerId?: string,
        @Query('salesOrderId') salesOrderId?: string,
        @CurrentBranch() branchCtx?: BranchContext,
    ) {
        return this.templates.render(id, {
            leadId: leadId ? +leadId : undefined,
            customerId: customerId ? +customerId : undefined,
            salesOrderId: salesOrderId ? +salesOrderId : undefined,
        }, branchCtx);
    }

    @Post('seed-defaults')
    @UseGuards(MenuGuard)
    @Menu('/crm/templates')
    seed() {
        return this.templates.seedDefaults();
    }
}
