import { BadRequestException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';

/** Hanya nama. Dulu body utuh diteruskan ke Prisma (relasi `products` bisa ditulis → semua produk satuan itu diarsipkan). */
function namaSatuan(data: any): string {
    const name = String(data?.name ?? '').trim().slice(0, 50);
    if (!name) throw new BadRequestException('Nama satuan wajib diisi.');
    return name;
}
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UnitsService {
    constructor(private prisma: PrismaService) { }

    async create(data: { name: string }) {
        const name = namaSatuan(data);
        const existing = await this.prisma.unit.findUnique({ where: { name } });
        if (existing) throw new ConflictException('Unit with this name already exists');
        return this.prisma.unit.create({ data: { name } });
    }

    async findAll() {
        return this.prisma.unit.findMany();
    }

    async findOne(id: number) {
        const unit = await this.prisma.unit.findUnique({ where: { id } });
        if (!unit) throw new NotFoundException(`Unit #${id} not found`);
        return unit;
    }

    async update(id: number, data: { name: string }) {
        await this.findOne(id);
        return this.prisma.unit.update({ where: { id }, data: { name: namaSatuan(data) } });
    }

    async remove(id: number) {
        await this.findOne(id);
        return this.prisma.unit.delete({ where: { id } });
    }
}
