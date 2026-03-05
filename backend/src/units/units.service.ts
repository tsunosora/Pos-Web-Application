import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UnitsService {
    constructor(private prisma: PrismaService) { }

    async create(data: { name: string }) {
        const existing = await this.prisma.unit.findUnique({ where: { name: data.name } });
        if (existing) throw new ConflictException('Unit with this name already exists');
        return this.prisma.unit.create({ data });
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
        return this.prisma.unit.update({ where: { id }, data });
    }

    async remove(id: number) {
        await this.findOne(id);
        return this.prisma.unit.delete({ where: { id } });
    }
}
