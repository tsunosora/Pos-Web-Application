import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { matchBranchId } from '../common/branch-name.util';

@Injectable()
export class DesignersService {
    constructor(private prisma: PrismaService) {}

    /** Resolve nama cabang (teks) → CompanyBranch.id untuk isi FK Designer.branchId. */
    private async resolveBranchId(branchName?: string | null): Promise<number | null> {
        if (!branchName?.trim()) return null;
        const branches: any[] = await (this.prisma as any).companyBranch.findMany({
            where: { isActive: true }, select: { id: true, name: true, code: true },
        });
        return matchBranchId(branchName, branches);
    }

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

    /** Verifikasi PIN desainer — return { valid, id, name, branchName } */
    async verifyPin(id: number, pin: string): Promise<{ valid: boolean; id?: number; name?: string; branchName?: string | null }> {
        const designer = await (this.prisma as any).designer.findUnique({ where: { id } });
        if (!designer || !designer.isActive) {
            return { valid: false };
        }
        if (designer.pin !== pin) {
            return { valid: false };
        }
        return { valid: true, id: designer.id, name: designer.name, branchName: designer.branchName ?? null };
    }

    /** Buat desainer baru (admin) */
    async create(data: { name: string; pin: string; branchName?: string; branchId?: number | null }) {
        if (!data.name?.trim()) throw new BadRequestException('Nama desainer wajib diisi');
        if (!data.pin?.trim()) throw new BadRequestException('PIN wajib diisi');
        const branchName = data.branchName?.trim() || null;
        // branchId eksplisit (dari dropdown) diutamakan; kalau tidak, resolve dari nama.
        const branchId = data.branchId ?? await this.resolveBranchId(branchName);
        return (this.prisma as any).designer.create({
            data: {
                name: data.name.trim(),
                pin: data.pin.trim(),
                branchName,
                branchId,
            },
        });
    }

    /** Update desainer (admin) */
    async update(id: number, data: { name?: string; pin?: string; isActive?: boolean; branchName?: string | null; branchId?: number | null }) {
        const existing = await (this.prisma as any).designer.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException('Desainer tidak ditemukan');
        const upd: any = {};
        if (data.name !== undefined) upd.name = data.name.trim();
        if (data.pin !== undefined) upd.pin = data.pin.trim();
        if (data.isActive !== undefined) upd.isActive = data.isActive;
        if ('branchName' in data) upd.branchName = data.branchName?.trim() || null;
        // branchId: eksplisit diutamakan; kalau hanya branchName berubah, ikut re-resolve.
        if (data.branchId !== undefined) upd.branchId = data.branchId;
        else if ('branchName' in data) upd.branchId = await this.resolveBranchId(upd.branchName);
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
