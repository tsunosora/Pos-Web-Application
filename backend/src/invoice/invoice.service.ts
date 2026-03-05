import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus, Prisma } from '@prisma/client';

@Injectable()
export class InvoiceService {
    constructor(private prisma: PrismaService) { }

    async create(data: Prisma.InvoiceCreateInput) {
        return this.prisma.invoice.create({
            data,
            include: {
                items: true,
            },
        });
    }

    async findAll() {
        return this.prisma.invoice.findMany({
            orderBy: { date: 'desc' },
            include: {
                items: true,
            }
        });
    }

    async updateStatus(id: number, status: InvoiceStatus) {
        return this.prisma.invoice.update({
            where: { id },
            data: { status },
        });
    }
}
