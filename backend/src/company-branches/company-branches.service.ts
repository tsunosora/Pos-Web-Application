import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompanyBranchesService {
    constructor(private prisma: PrismaService) {}

    async findAll() {
        return (this.prisma as any).companyBranch.findMany({
            orderBy: { name: 'asc' },
        });
    }

    async findAllActive(): Promise<{ id: number; name: string; code: string | null; phone: string | null }[]> {
        return (this.prisma as any).companyBranch.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true, phone: true },
            orderBy: { name: 'asc' },
        });
    }

    async create(data: {
        name: string;
        address?: string;
        phone?: string;
        code?: string;
        notaHeader?: string;
        notaFooter?: string;
        logoUrl?: string;
    }) {
        if (!data.name?.trim()) throw new BadRequestException('Nama cabang wajib diisi');
        return (this.prisma as any).companyBranch.create({
            data: {
                name: data.name.trim(),
                address: data.address?.trim() || null,
                phone: data.phone?.trim() || null,
                code: data.code?.trim().toUpperCase() || null,
                notaHeader: data.notaHeader?.trim() || null,
                notaFooter: data.notaFooter?.trim() || null,
                logoUrl: data.logoUrl?.trim() || null,
            },
        });
    }

    async update(
        id: number,
        data: {
            name?: string;
            address?: string;
            phone?: string;
            isActive?: boolean;
            code?: string | null;
            notaHeader?: string | null;
            notaFooter?: string | null;
            logoUrl?: string | null;
        },
    ) {
        const existing = await (this.prisma as any).companyBranch.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Cabang tidak ditemukan');
        const upd: any = {};
        if (data.name !== undefined) upd.name = data.name.trim();
        if ('address' in data) upd.address = data.address?.trim() || null;
        if ('phone' in data) upd.phone = data.phone?.trim() || null;
        if ('code' in data) upd.code = data.code?.trim().toUpperCase() || null;
        if ('notaHeader' in data) upd.notaHeader = data.notaHeader?.trim() || null;
        if ('notaFooter' in data) upd.notaFooter = data.notaFooter?.trim() || null;
        if ('logoUrl' in data) upd.logoUrl = data.logoUrl?.trim() || null;
        if (data.isActive !== undefined) upd.isActive = data.isActive;
        return (this.prisma as any).companyBranch.update({ where: { id }, data: upd });
    }

    async remove(id: number) {
        const existing = await (this.prisma as any).companyBranch.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Cabang tidak ditemukan');
        // Cek apakah masih ada work order aktif
        const activeWO = await (this.prisma as any).branchWorkOrder.count({
            where: { branchId: id, status: { in: ['ANTRIAN', 'PROSES'] } },
        });
        if (activeWO > 0) throw new BadRequestException('Cabang masih memiliki work order aktif. Selesaikan terlebih dahulu.');
        await (this.prisma as any).companyBranch.delete({ where: { id } });
        return { success: true };
    }
}
