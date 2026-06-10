import { Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import type { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch, assertBranchAccess } from '../common/branch-where.helper';

@Injectable()
export class InvoiceService implements OnModuleInit {
    private readonly logger = new Logger(InvoiceService.name);
    constructor(private prisma: PrismaService) { }

    // Pakai `as any` karena kolom branchId baru ditambah (Prisma Client mungkin belum regen).
    private get model(): any { return (this.prisma as any).invoice; }

    /** Backfill sekali jalan: invoice lama (branchId null) → cabang Pusat. */
    async onModuleInit() {
        try {
            const orphan = await this.model.count({ where: { branchId: null } });
            if (orphan === 0) return;
            const pusatId = await this.resolvePusatBranchId();
            if (!pusatId) {
                this.logger.warn(`Ada ${orphan} invoice tanpa cabang tapi cabang Pusat tidak ditemukan — backfill dilewati.`);
                return;
            }
            const res = await this.model.updateMany({ where: { branchId: null }, data: { branchId: pusatId } });
            this.logger.log(`Backfill invoice: ${res.count} invoice lama di-assign ke cabang Pusat (id=${pusatId}).`);
        } catch (e: any) {
            // Kemungkinan kolom belum ada (db push belum dijalankan) — aman, skip.
            this.logger.warn(`Backfill invoice dilewati: ${e?.message || e}`);
        }
    }

    /** Cari cabang "Pusat": code PST/PUSAT atau nama mengandung "pusat", fallback cabang aktif pertama. */
    private async resolvePusatBranchId(): Promise<number | null> {
        const branches: any[] = await (this.prisma as any).companyBranch.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
            orderBy: { id: 'asc' },
        });
        if (!branches.length) return null;
        const byCode = branches.find(b => ['PST', 'PUSAT'].includes((b.code || '').toUpperCase()));
        if (byCode) return byCode.id;
        const byName = branches.find(b => (b.name || '').toLowerCase().includes('pusat'));
        if (byName) return byName.id;
        return branches[0].id; // fallback: cabang tertua
    }

    async create(data: any, branchCtx?: BranchContext) {
        const { items, branchId: _ignore, ...invoiceData } = data;
        const branchId = branchCtx ? requireBranch(branchCtx) : (data.branchId ?? null);
        return this.model.create({
            data: {
                ...invoiceData,
                branchId,
                items: { create: items ?? [] },
            },
            include: { items: true },
        });
    }

    async findAll(type?: InvoiceType, branchCtx?: BranchContext) {
        const where: any = { ...(branchCtx ? branchWhere(branchCtx) : {}) };
        if (type) where.type = type;
        return this.model.findMany({
            where,
            orderBy: { date: 'desc' },
            include: { items: true },
        });
    }

    /** Ambil invoice + pastikan akses cabang (staff hanya cabangnya). */
    private async getScoped(id: number, branchCtx?: BranchContext) {
        const inv = await this.model.findUnique({ where: { id }, include: { items: true } });
        if (!inv) throw new NotFoundException('Invoice not found');
        if (branchCtx) assertBranchAccess(branchCtx, inv.branchId ?? null);
        return inv;
    }

    async findOne(id: number, branchCtx?: BranchContext) {
        return this.getScoped(id, branchCtx);
    }

    async update(id: number, data: any, branchCtx?: BranchContext) {
        await this.getScoped(id, branchCtx);
        const { items, branchId: _ignore, ...invoiceData } = data;

        return this.prisma.$transaction(async (tx) => {
            if (items !== undefined) {
                await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
            }
            await (tx as any).invoice.update({
                where: { id },
                data: {
                    ...invoiceData,
                    ...(items !== undefined ? { items: { create: items } } : {}),
                },
            });
            return (tx as any).invoice.findUnique({ where: { id }, include: { items: true } });
        });
    }

    async updateStatus(id: number, status: InvoiceStatus, branchCtx?: BranchContext) {
        await this.getScoped(id, branchCtx);
        return this.model.update({ where: { id }, data: { status } });
    }

    async updateType(id: number, type: InvoiceType, branchCtx?: BranchContext) {
        await this.getScoped(id, branchCtx);
        return this.model.update({ where: { id }, data: { type } });
    }

    async convertToInvoice(id: number, branchCtx?: BranchContext) {
        const quotation = await this.getScoped(id, branchCtx);

        const seq = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const newNumber = `INV-${dateStr}-${seq}`;

        return this.model.create({
            data: {
                invoiceNumber: newNumber,
                type: InvoiceType.INVOICE,
                branchId: quotation.branchId ?? null, // invoice baru ikut cabang quotation asal
                clientName: quotation.clientName,
                clientCompany: quotation.clientCompany,
                clientEmail: quotation.clientEmail,
                clientAddress: quotation.clientAddress,
                clientPhone: quotation.clientPhone,
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                subtotal: quotation.subtotal,
                taxRate: quotation.taxRate,
                taxAmount: quotation.taxAmount,
                discount: quotation.discount,
                total: quotation.total,
                notes: quotation.notes,
                status: InvoiceStatus.DRAFT,
                items: {
                    create: quotation.items.map((item: any) => ({
                        description: item.description,
                        unit: item.unit,
                        quantity: item.quantity,
                        price: item.price,
                    })),
                },
            },
            include: { items: true },
        });
    }

    async remove(id: number, branchCtx?: BranchContext) {
        await this.getScoped(id, branchCtx);
        return this.model.delete({ where: { id } });
    }
}
