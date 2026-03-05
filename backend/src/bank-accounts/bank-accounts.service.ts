import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BankAccountsService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.bankAccount.findMany({
            orderBy: { createdAt: 'asc' },
        });
    }

    async create(data: { bankName: string; accountNumber: string; accountOwner: string; isActive?: boolean }) {
        return this.prisma.bankAccount.create({ data });
    }

    async update(id: number, data: { bankName?: string; accountNumber?: string; accountOwner?: string; isActive?: boolean }) {
        return this.prisma.bankAccount.update({
            where: { id },
            data,
        });
    }

    async remove(id: number) {
        return this.prisma.bankAccount.delete({
            where: { id },
        });
    }
}
