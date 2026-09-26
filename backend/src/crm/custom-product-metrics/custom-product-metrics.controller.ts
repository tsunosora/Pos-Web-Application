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
import { ButuhSalahSatuFitur } from '../../lisensi/butuh-fitur.decorator';
import { CustomProductMetricsService } from './custom-product-metrics.service';
import { UpsertCustomProductMetricDto } from './dto/upsert-custom-product-metric.dto';

const ADMIN_ROLES = ['OWNER', 'SUPERADMIN', 'SUPER_ADMIN', 'ADMIN'] as const;

/**
 * Setelan metrik produk yang tampil di dasbor KPI. Daftar fiturnya PERSIS sama dengan
 * `KpiController` dan memang harus begitu: ini halaman setelannya, jadi siapa pun yang boleh
 * membuka dasbornya harus boleh mengatur metriknya. Kalau daftar di sana berubah, ubah di sini
 * juga — dua daftar yang berbeda berarti orang bisa membuka dasbor yang metriknya tak bisa diatur.
 */
@ButuhSalahSatuFitur('crm.leads', 'team.leaderboard', 'cs.rating')
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
