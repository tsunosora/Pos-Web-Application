import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { branchWhere, requireBranch } from '../../common/branch-where.helper';
import type { BranchContext } from '../../common/branch-context.decorator';

export type FollowUpType = 'LEAD_FU' | 'AFTER_SALES' | 'REPEAT_ORDER' | 'PAYMENT_REMINDER';
export type FollowUpStatus = 'PENDING' | 'DONE' | 'SKIPPED';

export class CreateFollowUpDto {
    type!: FollowUpType;
    dueDate!: string;          // ISO date
    leadId?: number;
    customerId?: number;
    assignedToId?: number;
    notes?: string;
    templateId?: number;
}

export interface ListParams {
    status?: FollowUpStatus;
    type?: FollowUpType;
    assignedToId?: number;
    dueBefore?: string;       // ISO date — include items due on/before this date
    page?: number;
    limit?: number;
}

@Injectable()
export class FollowUpsService {
    constructor(private readonly prisma: PrismaService) {}

    /** Get model accessor with `as any` workaround untuk Prisma client yang belum di-regenerate. */
    private get fu(): any {
        return (this.prisma as any).followUp;
    }

    async list(ctx: BranchContext, params: ListParams) {
        const where: any = { ...branchWhere(ctx) };
        if (params.status) where.status = params.status;
        if (params.type) where.type = params.type;
        if (params.assignedToId) where.assignedToId = params.assignedToId;
        if (params.dueBefore) where.dueDate = { lte: new Date(params.dueBefore) };

        const page = Math.max(1, params.page || 1);
        const limit = Math.min(200, Math.max(1, params.limit || 100));

        const [items, total] = await Promise.all([
            this.fu.findMany({
                where,
                orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
                include: {
                    lead: { select: { id: true, name: true, phone: true, status: true } },
                    customer: { select: { id: true, name: true, phone: true } },
                    assignedTo: { select: { id: true, name: true, email: true } },
                    template: { select: { id: true, name: true, category: true } },
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.fu.count({ where }),
        ]);

        return { items, total, page, limit };
    }

    /** Badge count untuk sidebar: pending due today or overdue, assigned to user. */
    async badgeCount(ctx: BranchContext, userId?: number) {
        const endOfToday = new Date();
        endOfToday.setHours(23, 59, 59, 999);
        const where: any = {
            ...branchWhere(ctx),
            status: 'PENDING',
            dueDate: { lte: endOfToday },
        };
        if (userId) where.assignedToId = userId;
        const count = await this.fu.count({ where });
        return { count };
    }

    async detail(ctx: BranchContext, id: number) {
        const fu = await this.fu.findUnique({
            where: { id },
            include: {
                lead: true,
                customer: true,
                assignedTo: { select: { id: true, name: true, email: true } },
                template: true,
            },
        });
        if (!fu) throw new NotFoundException('Follow-up tidak ditemukan');
        if (!ctx.isOwner && fu.branchId != null && fu.branchId !== ctx.userBranchId) {
            throw new NotFoundException('Follow-up tidak ditemukan');
        }
        return fu;
    }

    async create(ctx: BranchContext, data: CreateFollowUpDto, userId?: number) {
        const branchId = requireBranch(ctx);
        if (!data.leadId && !data.customerId) {
            throw new BadRequestException('FollowUp harus terkait Lead atau Customer.');
        }
        const fu = await this.fu.create({
            data: {
                type: data.type,
                status: 'PENDING',
                dueDate: new Date(data.dueDate),
                leadId: data.leadId ?? null,
                customerId: data.customerId ?? null,
                assignedToId: data.assignedToId ?? null,
                notes: data.notes ?? null,
                templateId: data.templateId ?? null,
                branchId,
                createdById: userId ?? null,
            },
        });

        // Log activity di lead/customer
        if (data.leadId || data.customerId) {
            await (this.prisma as any).leadActivity.create({
                data: {
                    leadId: data.leadId ?? null,
                    customerId: data.customerId ?? null,
                    kind: 'FOLLOW_UP_SCHEDULED',
                    text: `FU dijadwalkan ${data.type} pada ${new Date(data.dueDate).toLocaleDateString('id-ID')}`,
                    meta: { followUpId: fu.id, type: data.type, dueDate: data.dueDate },
                    createdById: userId ?? null,
                },
            });
        }

        return this.detail(ctx, fu.id);
    }

    async markDone(ctx: BranchContext, id: number, doneNotes?: string, userId?: number) {
        const fu = await this.detail(ctx, id);
        if (fu.status !== 'PENDING') {
            throw new BadRequestException(`FU sudah ${fu.status}, tidak bisa di-update.`);
        }
        const updated = await this.fu.update({
            where: { id },
            data: { status: 'DONE', doneAt: new Date(), doneNotes: doneNotes ?? null },
        });

        await (this.prisma as any).leadActivity.create({
            data: {
                leadId: fu.leadId,
                customerId: fu.customerId,
                kind: 'FOLLOW_UP_DONE',
                text: doneNotes || `FU ${fu.type} selesai`,
                meta: { followUpId: fu.id, type: fu.type },
                createdById: userId ?? null,
            },
        });

        return updated;
    }

    async skip(ctx: BranchContext, id: number, userId?: number) {
        const fu = await this.detail(ctx, id);
        if (fu.status !== 'PENDING') {
            throw new BadRequestException(`FU sudah ${fu.status}.`);
        }
        return this.fu.update({
            where: { id },
            data: { status: 'SKIPPED' },
        });
    }

    async remove(ctx: BranchContext, id: number) {
        await this.detail(ctx, id);
        await this.fu.delete({ where: { id } });
        return { ok: true };
    }

    /**
     * Trigger AFTER_SALES FU 3 hari setelah pickup. Idempotent — skip kalau:
     * - Sudah ada AFTER_SALES untuk customer ini dalam 7 hari, ATAU
     * - sourceRef sama sudah pernah trigger
     */
    async scheduleAfterSales(params: {
        customerId: number | null;
        branchId: number | null;
        sourceRef: string;
        assignedToId?: number | null;
    }) {
        if (!params.customerId) return { skipped: 'no-customer' };

        // Dedup by sourceRef (unique per pickup event)
        const dupBySource = await this.fu.findFirst({
            where: { sourceRef: params.sourceRef, type: 'AFTER_SALES' },
        });
        if (dupBySource) return { skipped: 'dup-source', followUpId: dupBySource.id };

        // Dedup by customer dalam 7 hari
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent = await this.fu.findFirst({
            where: {
                customerId: params.customerId,
                type: 'AFTER_SALES',
                createdAt: { gte: sevenDaysAgo },
            },
        });
        if (recent) return { skipped: 'recent-after-sales', followUpId: recent.id };

        // Resolve assignedTo: dari customer.assignedCsId kalau ada, else dari param
        let assignedToId = params.assignedToId ?? null;
        if (!assignedToId) {
            const customer = await this.prisma.customer.findUnique({
                where: { id: params.customerId },
            });
            assignedToId = (customer as any)?.assignedCsId ?? null;
        }

        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3);
        dueDate.setHours(9, 0, 0, 0); // 09:00 pagi

        const fu = await this.fu.create({
            data: {
                type: 'AFTER_SALES',
                status: 'PENDING',
                dueDate,
                customerId: params.customerId,
                branchId: params.branchId,
                assignedToId,
                notes: 'Auto-scheduled setelah pickup. Hubungi customer untuk minta testimoni / foto pakai.',
                sourceRef: params.sourceRef,
            },
        });

        await (this.prisma as any).leadActivity.create({
            data: {
                customerId: params.customerId,
                kind: 'AFTER_SALES_SCHEDULED',
                text: 'After-sales FU dijadwalkan 3 hari setelah pickup',
                meta: { followUpId: fu.id, sourceRef: params.sourceRef, dueDate },
            },
        });

        return { created: true, followUpId: fu.id };
    }
}
