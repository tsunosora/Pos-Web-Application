import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BatchesService {
    constructor(private prisma: PrismaService) { }

    async create(data: any) {
        return this.prisma.batch.create({ data });
    }

    async findAll() {
        return this.prisma.batch.findMany({ include: { productVariant: { include: { product: true } } } });
    }

    async findOne(id: number) {
        const batch = await this.prisma.batch.findUnique({
            where: { id },
            include: { productVariant: { include: { product: true } } }
        });
        if (!batch) throw new NotFoundException('Batch not found');
        return batch;
    }

    async update(id: number, data: any) {
        await this.findOne(id);
        return this.prisma.batch.update({ where: { id }, data });
    }

    async remove(id: number) {
        await this.findOne(id);
        return this.prisma.batch.delete({ where: { id } });
    }
}
