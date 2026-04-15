import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

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
    ) {
        const cashflow = await (this.prisma as any).cashflow.findUnique({
            where: { id: cashflowId },
            include: { user: { select: { name: true, email: true } } },
        });
        if (!cashflow) throw new NotFoundException('Cashflow entry tidak ditemukan');
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

    async findPending() {
        return (this.prisma as any).cashflowChangeRequest.findMany({
            where: { status: 'PENDING' },
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

    async approve(requestId: number, reviewerId: number, reviewerRoleId: number | null, reviewerNote?: string) {
        if (!(await this.isManager(reviewerRoleId))) {
            throw new ForbiddenException('Hanya manajer atau admin yang dapat menyetujui');
        }

        const req = await (this.prisma as any).cashflowChangeRequest.findUnique({
            where: { id: requestId },
        });
        if (!req) throw new NotFoundException('Permintaan tidak ditemukan');
        if (req.status !== 'PENDING') throw new BadRequestException('Permintaan ini sudah diproses');

        await (this.prisma as any).$transaction(async (tx: any) => {
            if (req.type === 'DELETE') {
                await tx.cashflow.delete({ where: { id: req.cashflowId } });
            } else {
                const payload = req.payload as Record<string, any>;
                await tx.cashflow.update({ where: { id: req.cashflowId }, data: payload });
            }
            await tx.cashflowChangeRequest.update({
                where: { id: requestId },
                data: {
                    status: 'APPROVED',
                    reviewedBy: reviewerId,
                    reviewerNote: reviewerNote ?? null,
                    reviewedAt: new Date(),
                },
            });
        });

        this.notifications.emit({
            type: 'system',
            title: 'Perubahan Cashflow Disetujui ✅',
            message: `Permintaan ${req.type === 'DELETE' ? 'penghapusan' : 'perubahan'} telah disetujui.${reviewerNote ? ` Catatan: ${reviewerNote}` : ''}`,
        });

        return { success: true };
    }

    async reject(requestId: number, reviewerId: number, reviewerRoleId: number | null, reviewerNote: string) {
        if (!(await this.isManager(reviewerRoleId))) {
            throw new ForbiddenException('Hanya manajer atau admin yang dapat menolak');
        }

        const req = await (this.prisma as any).cashflowChangeRequest.findUnique({
            where: { id: requestId },
        });
        if (!req) throw new NotFoundException('Permintaan tidak ditemukan');
        if (req.status !== 'PENDING') throw new BadRequestException('Permintaan ini sudah diproses');

        await (this.prisma as any).cashflowChangeRequest.update({
            where: { id: requestId },
            data: {
                status: 'REJECTED',
                reviewedBy: reviewerId,
                reviewerNote,
                reviewedAt: new Date(),
            },
        });

        this.notifications.emit({
            type: 'system',
            title: 'Perubahan Cashflow Ditolak ❌',
            message: `Permintaan ${req.type === 'DELETE' ? 'penghapusan' : 'perubahan'} ditolak.${reviewerNote ? ` Alasan: ${reviewerNote}` : ''}`,
        });

        return { success: true };
    }
}
