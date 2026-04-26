import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PrintJobStatus = 'ANTRIAN' | 'PROSES' | 'SELESAI' | 'DIAMBIL';

@Injectable()
export class PrintQueueService {
    constructor(private prisma: PrismaService) {}

    private jobInclude() {
        return {
            transaction: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    checkoutNumber: true,
                    customerName: true,
                    customerPhone: true,
                    status: true,
                    createdAt: true,
                    branchId: true,
                    productionBranchId: true,
                    branch: { select: { id: true, name: true, code: true } },
                    productionBranch: { select: { id: true, name: true, code: true } },
                },
            },
            transactionItem: {
                select: {
                    id: true,
                    quantity: true,
                    note: true,
                    clickType: true,
                    widthCm: true,
                    heightCm: true,
                    pcs: true,
                    productVariant: {
                        select: {
                            id: true,
                            variantName: true,
                            sku: true,
                            product: { select: { id: true, name: true } },
                        },
                    },
                },
            },
        };
    }

    async generateJobNumber(): Promise<string> {
        const today = new Date();
        const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const prefix = `PRT-${yyyymmdd}-`;
        const last = await (this.prisma as any).printJob.findFirst({
            where: { jobNumber: { startsWith: prefix } },
            orderBy: { jobNumber: 'desc' },
            select: { jobNumber: true },
        });
        let nextSeq = 1;
        if (last?.jobNumber) {
            const n = parseInt(last.jobNumber.slice(prefix.length), 10);
            if (!Number.isNaN(n)) nextSeq = n + 1;
        }
        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    async listJobs(status?: PrintJobStatus, search?: string, branchId?: number) {
        const where: any = {};
        if (status) where.status = status;
        if (branchId) where.branchId = branchId;
        if (search && search.trim()) {
            const q = search.trim();
            where.OR = [
                { jobNumber: { contains: q } },
                { transaction: { invoiceNumber: { contains: q } } },
                { transaction: { checkoutNumber: { contains: q } } },
                { transaction: { customerName: { contains: q } } },
            ];
        }
        const jobs = await (this.prisma as any).printJob.findMany({
            where,
            include: this.jobInclude(),
            orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        });
        return this.filterPendingTitipan(jobs);
    }

    /**
     * Sembunyikan job titipan yang belum di-"Terima & Kerjakan" oleh cabang tujuan.
     * Kriteria: transaction.branchId != transaction.productionBranchId (titipan)
     *           AND handoverStatus IN (NULL, 'BARU')
     */
    private async filterPendingTitipan(jobs: any[]): Promise<any[]> {
        if (!jobs?.length) return jobs;
        const txIds = Array.from(new Set(jobs.map(j => j.transaction?.id).filter(Boolean)));
        if (!txIds.length) return jobs;
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id, branch_id, production_branch_id, handover_status
             FROM transactions WHERE id IN (${txIds.join(',')})`,
        );
        const hidden = new Set<number>();
        for (const r of rows) {
            const isTitipan = r.production_branch_id != null && Number(r.production_branch_id) !== Number(r.branch_id);
            const notAck = !r.handover_status || r.handover_status === 'BARU';
            if (isTitipan && notAck) hidden.add(Number(r.id));
        }
        return jobs.filter(j => !hidden.has(Number(j.transaction?.id)));
    }

    async stats(branchId?: number) {
        const bw = branchId ? { branchId } : {};
        const [antrian, proses, selesai, diambil] = await Promise.all([
            (this.prisma as any).printJob.count({ where: { status: 'ANTRIAN', ...bw } }),
            (this.prisma as any).printJob.count({ where: { status: 'PROSES', ...bw } }),
            (this.prisma as any).printJob.count({ where: { status: 'SELESAI', ...bw } }),
            (this.prisma as any).printJob.count({ where: { status: 'DIAMBIL', ...bw } }),
        ]);
        return { antrian, proses, selesai, diambil };
    }

    private async getJob(id: number) {
        const job = await (this.prisma as any).printJob.findUnique({ where: { id } });
        if (!job) throw new NotFoundException('Job cetak tidak ditemukan');
        return job;
    }

    async startJob(id: number, operatorName?: string) {
        const job = await this.getJob(id);
        if (job.status !== 'ANTRIAN') throw new BadRequestException('Job tidak dalam status ANTRIAN');
        return (this.prisma as any).printJob.update({
            where: { id },
            data: { status: 'PROSES', startedAt: new Date(), operatorName: operatorName || job.operatorName },
            include: this.jobInclude(),
        });
    }

    async finishJob(id: number, operatorName?: string) {
        const job = await this.getJob(id);
        if (job.status !== 'PROSES') throw new BadRequestException('Job tidak dalam status PROSES');
        return (this.prisma as any).printJob.update({
            where: { id },
            data: { status: 'SELESAI', finishedAt: new Date(), operatorName: operatorName || job.operatorName },
            include: this.jobInclude(),
        });
    }

    async pickupJob(id: number) {
        const job = await this.getJob(id);
        if (job.status !== 'SELESAI') throw new BadRequestException('Job belum selesai dicetak');
        return (this.prisma as any).printJob.update({
            where: { id },
            data: { status: 'DIAMBIL', pickedUpAt: new Date() },
            include: this.jobInclude(),
        });
    }

    async updateNotes(id: number, notes: string) {
        await this.getJob(id);
        return (this.prisma as any).printJob.update({
            where: { id },
            data: { notes },
            include: this.jobInclude(),
        });
    }

    async verifyPin(pin: string, branchId?: number) {
        let pin_: string | null | undefined = null;
        if (branchId) {
            const bs = await (this.prisma as any).branchSettings.findUnique({ where: { branchId } });
            pin_ = bs?.operatorPin ?? null;
        }
        if (!pin_) {
            const settings = await this.prisma.storeSettings.findFirst();
            pin_ = (settings as any)?.operatorPin;
        }
        if (!pin_) {
            return { valid: false, message: 'PIN operator belum dikonfigurasi. Hubungi admin.' };
        }
        return { valid: pin_ === pin };
    }
}
