import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { BranchContext } from '../common/branch-context.decorator';
import { assertBranchAccess } from '../common/branch-where.helper';

/**
 * Kolom yang boleh diubah lewat permintaan — sama dengan yang ditampilkan ke penyetuju.
 * Dulu seluruh payload diterapkan: kasir bisa menyelipkan excludeFromShift/type/branchId/
 * shiftReportId yang tidak terlihat di layar persetujuan.
 */
function pilihIsiPermintaan(payload: Record<string, any> | null | undefined): Record<string, any> {
    const p = payload ?? {};
    const out: Record<string, any> = {};
    if (p.category !== undefined) out.category = String(p.category).slice(0, 100);
    if (p.note !== undefined) out.note = p.note == null ? null : String(p.note).slice(0, 1000);
    if (p.platformSource !== undefined) out.platformSource = p.platformSource == null ? null : String(p.platformSource).slice(0, 50);
    if (p.amount !== undefined) {
        const n = Number(p.amount);
        if (!Number.isFinite(n) || n <= 0) throw new BadRequestException('Nominal harus lebih dari 0');
        out.amount = n;
    }
    if (p.paymentMethod !== undefined) {
        if (!['CASH', 'QRIS', 'BANK_TRANSFER'].includes(String(p.paymentMethod))) throw new BadRequestException('Metode bayar tidak dikenal');
        out.paymentMethod = p.paymentMethod;
    }
    if (p.bankAccountId !== undefined) out.bankAccountId = p.bankAccountId == null || p.bankAccountId === '' ? null : Number(p.bankAccountId);
    return out;
}

@Injectable()
export class CashflowRequestsService {
    constructor(
        private prisma: PrismaService,
        private notifications: NotificationsService,
    ) { }

    private async isManager(roleId: number | null): Promise<boolean> {
        if (!roleId) return false;
        const role = await (this.prisma as any).role.findUnique({ where: { id: roleId } });
        if (!role) return false;
        const name = role.name.toLowerCase();
        return name === 'admin' || name === 'owner' || name === 'pemilik'
            || name.includes('manajer') || name.includes('manager');
    }

    async createRequest(
        requesterId: number,
        cashflowId: number,
        type: 'EDIT' | 'DELETE',
        payload?: Record<string, any> | null,
        requesterNote?: string,
        branchCtx?: BranchContext,
    ) {
        if (type !== 'EDIT' && type !== 'DELETE') throw new BadRequestException('Jenis permintaan harus EDIT atau DELETE');
        const cashflow = await (this.prisma as any).cashflow.findUnique({
            where: { id: Number(cashflowId) },
            include: { user: { select: { name: true, email: true } } },
        });
        if (!cashflow) throw new NotFoundException('Cashflow entry tidak ditemukan');
        if (branchCtx) assertBranchAccess(branchCtx, cashflow.branchId ?? null);
        if (type === 'EDIT') {
            payload = pilihIsiPermintaan(payload);
            if (!Object.keys(payload).length) throw new BadRequestException('Tidak ada perubahan yang diminta');
        } else {
            payload = null;
        }
        if (cashflow.userId === null) {
            throw new BadRequestException('Entry otomatis tidak dapat diedit/dihapus');
        }

        const existing = await (this.prisma as any).cashflowChangeRequest.findFirst({
            where: { cashflowId, status: 'PENDING' },
        });
        if (existing) {
            throw new BadRequestException('Sudah ada permintaan persetujuan yang menunggu untuk entry ini');
        }

        const requester = await (this.prisma as any).user.findUnique({
            where: { id: requesterId },
            select: { name: true, email: true },
        });

        const request = await (this.prisma as any).cashflowChangeRequest.create({
            data: {
                cashflowId,
                requesterId,
                type,
                payload: payload ?? undefined,
                requesterNote,
                status: 'PENDING',
            },
        });

        this.notifications.emit({
            type: 'system',
            title: 'Permintaan Persetujuan Cashflow',
            message: `${requester?.name ?? requester?.email ?? 'Kasir'} meminta ${type === 'DELETE' ? 'penghapusan' : 'perubahan'} entry "${cashflow.category}"`,
        });

        return request;
    }

    async findPending(branchCtx?: BranchContext) {
        // Staf cabang hanya melihat permintaan atas kas cabangnya.
        const cabang = branchCtx && !branchCtx.isOwner ? { cashflow: { branchId: branchCtx.userBranchId ?? -1 } } : {};
        return (this.prisma as any).cashflowChangeRequest.findMany({
            where: { status: 'PENDING', ...cabang },
            orderBy: { createdAt: 'asc' },
            include: {
                requester: { select: { id: true, name: true, email: true } },
                cashflow: {
                    select: {
                        id: true, type: true, category: true, amount: true,
                        note: true, date: true, platformSource: true, paymentMethod: true,
                    },
                },
            },
        });
    }

    async findByRequester(requesterId: number) {
        return (this.prisma as any).cashflowChangeRequest.findMany({
            where: { requesterId },
            orderBy: { createdAt: 'desc' },
            take: 30,
            include: {
                cashflow: { select: { category: true, amount: true, type: true } },
            },
        });
    }

    async approve(requestId: number, reviewerId: number, reviewerRoleId: number | null, reviewerNote?: string, branchCtx?: BranchContext) {
        if (!(await this.isManager(reviewerRoleId))) {
            throw new ForbiddenException('Hanya manajer atau admin yang dapat menyetujui');
        }

        const req = await (this.prisma as any).cashflowChangeRequest.findUnique({
            where: { id: requestId },
        });
        if (!req) throw new NotFoundException('Permintaan tidak ditemukan');
        if (req.status !== 'PENDING') throw new BadRequestException('Permintaan ini sudah diproses');
        const target = await (this.prisma as any).cashflow.findUnique({ where: { id: req.cashflowId }, select: { branchId: true } });
        if (target && branchCtx) assertBranchAccess(branchCtx, target.branchId ?? null);

        await (this.prisma as any).$transaction(async (tx: any) => {
            // Klaim dulu (klik ganda / dua penyetuju tidak boleh menerapkan dua kali).
            const klaim = await tx.cashflowChangeRequest.updateMany({
                where: { id: requestId, status: 'PENDING' },
                data: {
                    status: 'APPROVED',
                    reviewedBy: reviewerId,
                    reviewerNote: reviewerNote ?? null,
                    reviewedAt: new Date(),
                },
            });
            if (klaim.count !== 1) throw new BadRequestException('Permintaan ini sudah diproses');
            if (req.type === 'DELETE') {
                await tx.cashflow.delete({ where: { id: req.cashflowId } });
            } else {
                // Saring ulang: permintaan lama yang dibuat sebelum penyaringan tetap aman.
                await tx.cashflow.update({ where: { id: req.cashflowId }, data: pilihIsiPermintaan(req.payload as Record<string, any>) });
            }
        });

        this.notifications.emit({
            type: 'system',
            title: 'Perubahan Cashflow Disetujui ✅',
            message: `Permintaan ${req.type === 'DELETE' ? 'penghapusan' : 'perubahan'} telah disetujui.${reviewerNote ? ` Catatan: ${reviewerNote}` : ''}`,
        });

        return { success: true };
    }

    async reject(requestId: number, reviewerId: number, reviewerRoleId: number | null, reviewerNote: string, branchCtx?: BranchContext) {
        if (!(await this.isManager(reviewerRoleId))) {
            throw new ForbiddenException('Hanya manajer atau admin yang dapat menolak');
        }

        const req = await (this.prisma as any).cashflowChangeRequest.findUnique({
            where: { id: requestId },
        });
        if (!req) throw new NotFoundException('Permintaan tidak ditemukan');
        if (req.status !== 'PENDING') throw new BadRequestException('Permintaan ini sudah diproses');

        const target = await (this.prisma as any).cashflow.findUnique({ where: { id: req.cashflowId }, select: { branchId: true } });
        if (target && branchCtx) assertBranchAccess(branchCtx, target.branchId ?? null);
        const klaim = await (this.prisma as any).cashflowChangeRequest.updateMany({
            where: { id: requestId, status: 'PENDING' },
            data: {
                status: 'REJECTED',
                reviewedBy: reviewerId,
                reviewerNote,
                reviewedAt: new Date(),
            },
        });
        if (klaim.count !== 1) throw new BadRequestException('Permintaan ini sudah diproses');

        this.notifications.emit({
            type: 'system',
            title: 'Perubahan Cashflow Ditolak ❌',
            message: `Permintaan ${req.type === 'DELETE' ? 'penghapusan' : 'perubahan'} ditolak.${reviewerNote ? ` Alasan: ${reviewerNote}` : ''}`,
        });

        return { success: true };
    }
}
