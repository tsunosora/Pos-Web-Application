import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpsertCustomProductMetricDto } from './dto/upsert-custom-product-metric.dto';

@Injectable()
export class CustomProductMetricsService {
    constructor(private readonly prisma: PrismaService) {}

    private ensureHasRule(dto: UpsertCustomProductMetricDto) {
        const hasRule =
            (dto.productVariantIds?.length ?? 0) > 0 ||
            (dto.categoryIds?.length ?? 0) > 0 ||
            (dto.nameKeywords?.filter((k) => k.trim()).length ?? 0) > 0;
        if (!hasRule) {
            throw new BadRequestException(
                'Minimal satu aturan match diisi (varian, kategori, atau kata kunci nama).',
            );
        }
    }

    list() {
        return this.prisma.customProductMetric.findMany({
            orderBy: [{ displayOrder: 'asc' }, { id: 'asc' }],
        });
    }

    create(dto: UpsertCustomProductMetricDto) {
        this.ensureHasRule(dto);
        return this.prisma.customProductMetric.create({ data: this.toData(dto) });
    }

    async update(id: number, dto: UpsertCustomProductMetricDto) {
        this.ensureHasRule(dto);
        const found = await this.prisma.customProductMetric.findUnique({ where: { id } });
        if (!found) throw new NotFoundException('Metrik tidak ditemukan');
        return this.prisma.customProductMetric.update({ where: { id }, data: this.toData(dto) });
    }

    async remove(id: number) {
        await this.prisma.customProductMetric.delete({ where: { id } }).catch(() => {
            throw new NotFoundException('Metrik tidak ditemukan');
        });
        return { ok: true };
    }

    private toData(dto: UpsertCustomProductMetricDto) {
        return {
            name: dto.name.trim(),
            label: dto.label.trim(),
            isActive: dto.isActive ?? true,
            displayOrder: dto.displayOrder ?? 0,
            productVariantIds: dto.productVariantIds ?? [],
            categoryIds: dto.categoryIds ?? [],
            nameKeywords: (dto.nameKeywords ?? []).map((k) => k.trim()).filter(Boolean),
            countMode: dto.countMode,
            roles: dto.roles,
        };
    }
}
