import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch, assertBranchAccess } from '../common/branch-where.helper';

/**
 * Hanya kolom batch yang dikenal. Dulu body diteruskan utuh ke Prisma → tulisan relasi bersarang
 * (branch → users → role) bisa menjadikan akun mana pun Owner atau mengganti sandi rekan.
 */
function kolomBatch(data: any, baru: boolean) {
    const d = data ?? {};
    const out: any = {};
    if (baru || d.productVariantId !== undefined) {
        const v = Number(d.productVariantId);
        if (!Number.isInteger(v) || v <= 0) throw new BadRequestException('Varian produk wajib dipilih.');
        out.productVariantId = v;
    }
    if (baru || d.batchNumber !== undefined) {
        const s = String(d.batchNumber ?? '').trim().slice(0, 100);
        if (!s) throw new BadRequestException('Nomor batch wajib diisi.');
        out.batchNumber = s;
    }
    if (d.expirationDate !== undefined) {
        const t = d.expirationDate ? new Date(d.expirationDate) : null;
        if (t && isNaN(t.getTime())) throw new BadRequestException('Tanggal kedaluwarsa tidak valid.');
        out.expirationDate = t;
    }
    if (d.stock !== undefined) {
        const n = Number(d.stock);
        if (!Number.isInteger(n) || n < 0) throw new BadRequestException('Stok batch harus bilangan bulat ≥ 0.');
        out.stock = n;
    }
    return out;
}

@Injectable()
export class BatchesService {
    constructor(private prisma: PrismaService) { }

    async create(data: any, branchCtx?: BranchContext) {
        // Stempel cabang pembuat. Owner mode "Semua Cabang" wajib pilih cabang dulu.
        const branchId = branchCtx ? requireBranch(branchCtx) : (data?.branchId ?? null);
        return this.prisma.batch.create({ data: { ...kolomBatch(data, true), branchId } });
    }

    async findAll(branchCtx?: BranchContext) {
        return this.prisma.batch.findMany({
            where: { ...(branchCtx ? branchWhere(branchCtx) : {}) },
            include: { productVariant: { include: { product: true } } },
        });
    }

    async findOne(id: number, branchCtx?: BranchContext) {
        const batch = await this.prisma.batch.findUnique({
            where: { id },
            include: { productVariant: { include: { product: true } } }
        });
        if (!batch) throw new NotFoundException('Batch not found');
        if (branchCtx) assertBranchAccess(branchCtx, (batch as any).branchId ?? null);
        return batch;
    }

    async update(id: number, data: any, branchCtx?: BranchContext) {
        await this.findOne(id, branchCtx);
        // branchId tidak ikut (tidak boleh dipindah lewat update biasa).
        return this.prisma.batch.update({ where: { id }, data: kolomBatch(data, false) });
    }

    async remove(id: number, branchCtx?: BranchContext) {
        await this.findOne(id, branchCtx);
        return this.prisma.batch.delete({ where: { id } });
    }
}
