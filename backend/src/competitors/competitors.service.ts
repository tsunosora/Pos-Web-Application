import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompetitorsService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return (this.prisma as any).competitor.findMany({ orderBy: { createdAt: 'desc' } });
    }

    private bersih(d: any, baru: boolean) {
        const out: any = {};
        if (d?.name !== undefined || baru) { const nm = String(d?.name ?? '').trim(); if (!nm) throw new BadRequestException('Nama wajib diisi.'); out.name = nm.slice(0, 150); }
        for (const k of ['type', 'address', 'notes']) if (d?.[k] !== undefined) out[k] = d[k] == null ? null : String(d[k]).slice(0, 2000);
        for (const [k, min, max] of [['latitude', -90, 90], ['longitude', -180, 180]] as const) {
            if (d?.[k] !== undefined || baru) {
                const n = Number(d?.[k]);
                if (!Number.isFinite(n) || n < min || n > max) throw new BadRequestException(`${k} tidak valid.`);
                out[k] = n;
            }
        }
        return out;
    }

    async create(data: { name: string; type?: string; address?: string; latitude: number; longitude: number; notes?: string }) {
        return (this.prisma as any).competitor.create({ data: this.bersih(data, true) });
    }

    async update(id: number, data: { name?: string; type?: string; address?: string; latitude?: number; longitude?: number; notes?: string }) {
        const item = await (this.prisma as any).competitor.findUnique({ where: { id } });
        if (!item) throw new NotFoundException('Competitor not found');
        return (this.prisma as any).competitor.update({ where: { id }, data: this.bersih(data, false) });
    }

    async remove(id: number) {
        const item = await (this.prisma as any).competitor.findUnique({ where: { id } });
        if (!item) throw new NotFoundException('Competitor not found');
        return (this.prisma as any).competitor.delete({ where: { id } });
    }
}
