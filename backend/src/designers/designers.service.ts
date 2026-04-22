import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DesignersService {
    constructor(private prisma: PrismaService) {}

    /** Daftar semua desainer (admin) */
    async findAll() {
        return (this.prisma as any).designer.findMany({ orderBy: { name: 'asc' } });
    }

    /** Daftar desainer aktif — tanpa PIN (untuk dropdown publik) */
    async listPublic(): Promise<{ id: number; name: string }[]> {
        const rows = await (this.prisma as any).designer.findMany({
            where: { isActive: true },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });
        return rows;
    }

    /** Verifikasi PIN desainer — return { valid, id, name } */
    async verifyPin(id: number, pin: string): Promise<{ valid: boolean; id?: number; name?: string }> {
        const designer = await (this.prisma as any).designer.findUnique({ where: { id } });
        if (!designer || !designer.isActive) {
            return { valid: false };
        }
        if (designer.pin !== pin) {
            return { valid: false };
        }
        return { valid: true, id: designer.id, name: designer.name };
    }

    /** Buat desainer baru (admin) */
    async create(data: { name: string; pin: string }) {
        if (!data.name?.trim()) throw new BadRequestException('Nama desainer wajib diisi');
        if (!data.pin?.trim()) throw new BadRequestException('PIN wajib diisi');
        return (this.prisma as any).designer.create({
            data: { name: data.name.trim(), pin: data.pin.trim() },
        });
    }

    /** Update desainer (admin) */
    async update(id: number, data: { name?: string; pin?: string; isActive?: boolean }) {
        const existing = await (this.prisma as any).designer.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Desainer tidak ditemukan');
        const upd: any = {};
        if (data.name !== undefined) upd.name = data.name.trim();
        if (data.pin !== undefined) upd.pin = data.pin.trim();
        if (data.isActive !== undefined) upd.isActive = data.isActive;
        return (this.prisma as any).designer.update({ where: { id }, data: upd });
    }

    /** Hapus desainer (admin) */
    async remove(id: number) {
        const existing = await (this.prisma as any).designer.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Desainer tidak ditemukan');
        await (this.prisma as any).designer.delete({ where: { id } });
        return { success: true };
    }
}
