import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { CustomProductMetricsService } from './custom-product-metrics.service';
import { UpsertCustomProductMetricDto } from './dto/upsert-custom-product-metric.dto';

const ADMIN_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'] as const;

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...ADMIN_ROLES)
@Controller('crm/custom-product-metrics')
export class CustomProductMetricsController {
    constructor(private readonly svc: CustomProductMetricsService) {}

    @Get()
    list() {
        return this.svc.list();
    }

    @Post()
    create(@Body() dto: UpsertCustomProductMetricDto) {
        return this.svc.create(dto);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpsertCustomProductMetricDto) {
        return this.svc.update(id, dto);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
