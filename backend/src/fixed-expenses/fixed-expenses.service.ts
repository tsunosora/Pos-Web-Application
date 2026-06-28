import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORIES = ['GAJI', 'SEWA', 'ANGSURAN', 'SUPPLIER', 'LAINNYA'];

/**
 * Beban tetap bulanan milik owner (gaji, sewa, angsuran mesin, supplier, dll).
 * Owner-only — dipakai di Dashboard Owner untuk estimasi laba bersih.
 * branchId null = pusat / berlaku semua cabang.
 */
@Injectable()
export class FixedExpensesService {
    constructor(private prisma: PrismaService) {}

    /** Semua beban (owner melihat lintas cabang; filter per cabang dilakukan di FE). */
    findAll() {
        return (this.prisma as any).fixedExpense.findMany({
            orderBy: [{ isActive: 'desc' }, { category: 'asc' }, { amount: 'desc' }],
        });
    }

    private normalize(data: any) {
        const amount = Number(data.amount);
        if (!data?.name?.trim()) throw new BadRequestException('Nama beban wajib diisi');
        if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('Nominal tidak valid');
        const category = CATEGORIES.includes(String(data.category)) ? String(data.category) : 'LAINNYA';
        let dueDay: number | null = null;
        if (data.dueDay != null && data.dueDay !== '') {
            const d = Number(data.dueDay);
            if (Number.isFinite(d) && d >= 1 && d <= 31) dueDay = Math.round(d);
        }
        return {
            name: String(data.name).trim(),
            category,
            amount,
            branchId: data.branchId != null && data.branchId !== '' ? Number(data.branchId) : null,
            dueDay,
            note: data.note?.trim() || null,
            isActive: data.isActive === undefined ? true : !!data.isActive,
        };
    }

    create(data: any) {
        return (this.prisma as any).fixedExpense.create({ data: this.normalize(data) });
    }

    async update(id: number, data: any) {
        const exists = await (this.prisma as any).fixedExpense.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Beban tidak ditemukan');
        // Update parsial: hanya field yang dikirim.
        const patch: any = {};
        if (data.name !== undefined) { if (!data.name?.trim()) throw new BadRequestException('Nama beban wajib diisi'); patch.name = String(data.name).trim(); }
        if (data.amount !== undefined) { const a = Number(data.amount); if (!Number.isFinite(a) || a <= 0) throw new BadRequestException('Nominal tidak valid'); patch.amount = a; }
        if (data.category !== undefined) patch.category = CATEGORIES.includes(String(data.category)) ? String(data.category) : 'LAINNYA';
        if (data.branchId !== undefined) patch.branchId = data.branchId != null && data.branchId !== '' ? Number(data.branchId) : null;
        if (data.dueDay !== undefined) {
            const d = Number(data.dueDay);
            patch.dueDay = (data.dueDay != null && data.dueDay !== '' && Number.isFinite(d) && d >= 1 && d <= 31) ? Math.round(d) : null;
        }
        if (data.note !== undefined) patch.note = data.note?.trim() || null;
        if (data.isActive !== undefined) patch.isActive = !!data.isActive;
        return (this.prisma as any).fixedExpense.update({ where: { id }, data: patch });
    }

    async remove(id: number) {
        const exists = await (this.prisma as any).fixedExpense.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException('Beban tidak ditemukan');
        return (this.prisma as any).fixedExpense.delete({ where: { id } });
    }
}
