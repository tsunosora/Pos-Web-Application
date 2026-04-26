import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

export interface CreateBranchWODto {
    branchId: number;
    referenceNumber?: string;
    notes?: string;
    receivedBy?: string;
    items: {
        productVariantId: number;
        quantity: number;
        widthCm?: number | null;
        heightCm?: number | null;
        unitType?: string | null;
        pcs?: number | null;
        note?: string | null;
    }[];
}

const woInclude = {
    branch: { select: { id: true, name: true, phone: true } },
    items: {
        include: {
            productVariant: {
                include: { product: { select: { id: true, name: true, pricingMode: true } } },
            },
        },
    },
};

@Injectable()
export class BranchWorkOrdersService {
    constructor(private prisma: PrismaService) {}

    private async generateWoNumber(): Promise<string> {
        const now = new Date();
        const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const prefix = `WO-${dateStr}-`;
        const last = await (this.prisma as any).branchWorkOrder.findFirst({
            where: { woNumber: { startsWith: prefix } },
            orderBy: { woNumber: 'desc' },
            select: { woNumber: true },
        });
        const seq = last ? parseInt(last.woNumber.slice(prefix.length), 10) + 1 : 1;
        return `${prefix}${String(seq).padStart(4, '0')}`;
    }

    async list(params?: { branchId?: number; status?: string; month?: string }) {
        const where: any = {};
        if (params?.branchId) where.branchId = params.branchId;
        if (params?.status) where.status = params.status;
        if (params?.month) {
            // format: YYYY-MM
            const [y, m] = params.month.split('-').map(Number);
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0, 23, 59, 59, 999);
            where.createdAt = { gte: start, lte: end };
        }
        return (this.prisma as any).branchWorkOrder.findMany({
            where,
            include: woInclude,
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: number) {
        const wo = await (this.prisma as any).branchWorkOrder.findUnique({
            where: { id },
            include: woInclude,
        });
        if (!wo) throw new NotFoundException('Work order tidak ditemukan');
        return wo;
    }

    async create(data: CreateBranchWODto) {
        if (!data.branchId) throw new BadRequestException('Cabang wajib dipilih');
        if (!data.items || data.items.length === 0) throw new BadRequestException('Minimal 1 item');

        // Validasi cabang
        const branch = await (this.prisma as any).companyBranch.findUnique({ where: { id: data.branchId } });
        if (!branch || !branch.isActive) throw new BadRequestException('Cabang tidak ditemukan atau tidak aktif');

        const woNumber = await this.generateWoNumber();
        return (this.prisma as any).branchWorkOrder.create({
            data: {
                woNumber,
                branchId: data.branchId,
                referenceNumber: data.referenceNumber?.trim() || null,
                notes: data.notes?.trim() || null,
                receivedBy: data.receivedBy?.trim() || null,
                status: 'ANTRIAN',
                items: {
                    create: data.items.map(it => ({
                        productVariantId: it.productVariantId,
                        quantity: it.quantity,
                        widthCm: it.widthCm ?? null,
                        heightCm: it.heightCm ?? null,
                        unitType: it.unitType ?? null,
                        pcs: it.pcs ?? null,
                        note: it.note?.trim() || null,
                    })),
                },
            },
            include: woInclude,
        });
    }

    async setProof(id: number, filename: string) {
        const wo = await (this.prisma as any).branchWorkOrder.findUnique({ where: { id } });
        if (!wo) throw new NotFoundException('Work order tidak ditemukan');

        // Hapus file lama jika ada
        if (wo.proofFilename) {
            const oldPath = path.join(process.cwd(), 'public', wo.proofFilename.replace(/^\//, ''));
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (_) {}
            }
        }

        return (this.prisma as any).branchWorkOrder.update({
            where: { id },
            data: { proofFilename: filename },
            include: woInclude,
        });
    }

    async updateStatus(id: number, status: string, cancelReason?: string) {
        const wo = await (this.prisma as any).branchWorkOrder.findUnique({ where: { id } });
        if (!wo) throw new NotFoundException('Work order tidak ditemukan');

        const allowed: Record<string, string[]> = {
            ANTRIAN: ['PROSES', 'DIBATALKAN'],
            PROSES: ['SELESAI', 'ANTRIAN', 'DIBATALKAN'],
            SELESAI: [],
            DIBATALKAN: [],
        };
        if (!allowed[wo.status]?.includes(status)) {
            throw new BadRequestException(`Tidak bisa ubah status dari ${wo.status} ke ${status}`);
        }
        if (status === 'DIBATALKAN' && !cancelReason?.trim()) {
            throw new BadRequestException('Alasan pembatalan wajib diisi');
        }

        const upd: any = { status };
        if (status === 'SELESAI') upd.completedAt = new Date();
        if (status === 'DIBATALKAN') upd.cancelReason = cancelReason;

        return (this.prisma as any).branchWorkOrder.update({
            where: { id },
            data: upd,
            include: woInclude,
        });
    }

    async toggleItemDone(id: number, itemId: number) {
        const item = await (this.prisma as any).branchWorkOrderItem.findFirst({
            where: { id: itemId, workOrderId: id },
        });
        if (!item) throw new NotFoundException('Item tidak ditemukan');

        const updated = await (this.prisma as any).branchWorkOrderItem.update({
            where: { id: itemId },
            data: { isDone: !item.isDone },
        });

        // Auto-update status WO: jika semua item done → SELESAI
        const wo = await (this.prisma as any).branchWorkOrder.findUnique({
            where: { id },
            include: { items: true },
        });
        if (wo && wo.status === 'PROSES') {
            const allDone = wo.items.every((it: any) => (it.id === itemId ? !item.isDone : it.isDone));
            if (allDone) {
                await (this.prisma as any).branchWorkOrder.update({
                    where: { id },
                    data: { status: 'SELESAI', completedAt: new Date() },
                });
            }
        }
        return updated;
    }

    async getSummary(params: { branchId?: number; year: number; month?: number }) {
        const where: any = {};
        if (params.branchId) where.branchId = params.branchId;
        const start = params.month
            ? new Date(params.year, params.month - 1, 1)
            : new Date(params.year, 0, 1);
        const end = params.month
            ? new Date(params.year, params.month, 0, 23, 59, 59)
            : new Date(params.year, 11, 31, 23, 59, 59);
        where.createdAt = { gte: start, lte: end };
        where.status = { not: 'DIBATALKAN' };

        const orders = await (this.prisma as any).branchWorkOrder.findMany({
            where,
            include: {
                branch: { select: { id: true, name: true } },
                items: {
                    include: {
                        productVariant: { include: { product: { select: { name: true } } } },
                    },
                },
            },
        });

        // Group by branch
        const byBranch: Record<number, { branchId: number; branchName: string; totalOrders: number; totalItems: number; selesai: number; proses: number; antrian: number }> = {};
        for (const wo of orders) {
            const b = wo.branch;
            if (!byBranch[b.id]) {
                byBranch[b.id] = { branchId: b.id, branchName: b.name, totalOrders: 0, totalItems: 0, selesai: 0, proses: 0, antrian: 0 };
            }
            byBranch[b.id].totalOrders++;
            byBranch[b.id].totalItems += wo.items.length;
            if (wo.status === 'SELESAI') byBranch[b.id].selesai++;
            else if (wo.status === 'PROSES') byBranch[b.id].proses++;
            else byBranch[b.id].antrian++;
        }

        return {
            period: params.month ? `${params.year}-${String(params.month).padStart(2, '0')}` : String(params.year),
            totalOrders: orders.length,
            byBranch: Object.values(byBranch),
        };
    }
}
