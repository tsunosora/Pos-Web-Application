import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type ProdCatInput = {
    name: string;
    source?: string;        // 'CETAK' | 'PRODUKSI'
    measureBy?: string;     // 'AREA' | 'PCS'
    isActive?: boolean;
    sortOrder?: number;
};

const SOURCES = ['CETAK', 'PRODUKSI'];
const MEASURES = ['AREA', 'PCS'];

// Seed default saat tabel masih kosong — Banner (bahan cetak, m²),
// Stiker (produksi, m²), Laser Cut (produksi, pcs). User bebas menambah lagi.
const DEFAULTS = [
    { name: 'Produksi Banner', source: 'CETAK', measureBy: 'AREA', sortOrder: 1 },
    { name: 'Produksi Stiker', source: 'PRODUKSI', measureBy: 'AREA', sortOrder: 2 },
    { name: 'Produksi Laser Cut', source: 'PRODUKSI', measureBy: 'PCS', sortOrder: 3 },
];

@Injectable()
export class ProductionCategoriesService implements OnModuleInit {
    constructor(private prisma: PrismaService) {}

    // Isi 3 kategori standar jika tabel benar-benar kosong (lokal & homelab).
    async onModuleInit() {
        try {
            const count = await (this.prisma as any).productionCategory.count();
            if (count === 0) {
                await (this.prisma as any).productionCategory.createMany({ data: DEFAULTS });
            }
        } catch {
            // Abaikan jika DB belum siap saat boot — tidak boleh menggagalkan start.
        }
    }

    private normalize(data: ProdCatInput) {
        const source = SOURCES.includes(data.source as any) ? data.source : 'PRODUKSI';
        const measureBy = MEASURES.includes(data.measureBy as any) ? data.measureBy : 'AREA';
        return { source, measureBy };
    }

    findAll() {
        return (this.prisma as any).productionCategory.findMany({
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        });
    }

    async create(data: ProdCatInput) {
        const name = (data.name || '').trim();
        if (!name) throw new BadRequestException('Nama kategori produksi wajib diisi');
        const existing = await (this.prisma as any).productionCategory.findUnique({ where: { name } });
        if (existing) throw new BadRequestException('Nama kategori produksi sudah ada');
        const { source, measureBy } = this.normalize(data);
        return (this.prisma as any).productionCategory.create({
            data: {
                name,
                source: source as any,
                measureBy: measureBy as any,
                isActive: data.isActive ?? true,
                sortOrder: data.sortOrder ?? 0,
            },
        });
    }

    async update(id: number, data: Partial<ProdCatInput>) {
        const found = await (this.prisma as any).productionCategory.findUnique({ where: { id } });
        if (!found) throw new NotFoundException(`Kategori produksi #${id} tidak ditemukan`);

        if (data.name !== undefined) {
            const name = data.name.trim();
            if (!name) throw new BadRequestException('Nama kategori produksi wajib diisi');
            const dup = await (this.prisma as any).productionCategory.findFirst({ where: { name, id: { not: id } } });
            if (dup) throw new BadRequestException('Nama kategori produksi sudah ada');
        }

        return (this.prisma as any).productionCategory.update({
            where: { id },
            data: {
                ...(data.name !== undefined ? { name: data.name.trim() } : {}),
                ...(data.source !== undefined ? { source: (SOURCES.includes(data.source) ? data.source : 'PRODUKSI') as any } : {}),
                ...(data.measureBy !== undefined ? { measureBy: (MEASURES.includes(data.measureBy) ? data.measureBy : 'AREA') as any } : {}),
                ...(data.isActive !== undefined ? { isActive: !!data.isActive } : {}),
                ...(data.sortOrder !== undefined ? { sortOrder: Number(data.sortOrder) || 0 } : {}),
            },
        });
    }

    async remove(id: number) {
        const found = await (this.prisma as any).productionCategory.findUnique({ where: { id } });
        if (!found) throw new NotFoundException(`Kategori produksi #${id} tidak ditemukan`);
        // Category.productionCategoryId onDelete: SetNull → kategori yang memakai
        // otomatis dilepas (tidak error FK). Aman langsung hapus.
        return (this.prisma as any).productionCategory.delete({ where: { id } });
    }
}
