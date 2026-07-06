import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';

export type PrintJobStatus = 'ANTRIAN' | 'PROSES' | 'SELESAI' | 'DIAMBIL';

@Injectable()
export class PrintQueueService {
    constructor(
        private prisma: PrismaService,
        private discord: DiscordService,
    ) {}

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

    async listJobs(status?: PrintJobStatus, search?: string, branchId?: number, page = 1, pageSize = 20) {
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
        // Ambil scalar dulu TANPA include relasi: kalau ada job yatim (transaksi /
        // item-nya sudah terhapus), `include` relasi wajib bikin Prisma throw.
        // Relasi di-hydrate manual HANYA untuk halaman aktif (hemat payload).
        const rows: any[] = await (this.prisma as any).printJob.findMany({
            where,
            orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        });

        // Info tx minimal untuk filter yatim + titipan-pending (tanpa hydrate berat)
        const allTxIds = Array.from(new Set(rows.map(r => r.transactionId).filter(Boolean)));
        const txInfo: any[] = allTxIds.length
            ? await this.prisma.transaction.findMany({
                where: { id: { in: allTxIds } },
                select: { id: true, branchId: true, productionBranchId: true, handoverStatus: true },
            })
            : [];
        const txInfoMap = new Map(txInfo.map(t => [t.id, t]));

        // Visible = transaksi masih ada (bukan yatim) & bukan titipan yang belum di-ACK cabang tujuan
        const visible = rows.filter(r => {
            const t = txInfoMap.get(r.transactionId);
            if (!t) return false;
            const isTitipan = t.productionBranchId != null && Number(t.productionBranchId) !== Number(t.branchId);
            const notAck = !t.handoverStatus || t.handoverStatus === 'BARU';
            return !(isTitipan && notAck);
        });

        const total = visible.length;
        const take = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
        const safePage = Math.max(Number(page) || 1, 1);
        const pageRows = visible.slice((safePage - 1) * take, (safePage - 1) * take + take);

        // Hydrate relasi penuh HANYA untuk baris halaman ini
        const inc = this.jobInclude();
        const pTxIds = Array.from(new Set(pageRows.map(r => r.transactionId).filter(Boolean)));
        const pItemIds = Array.from(new Set(pageRows.map(r => r.transactionItemId).filter(Boolean)));
        const [txs, items] = await Promise.all([
            pTxIds.length
                ? this.prisma.transaction.findMany({ where: { id: { in: pTxIds } }, select: inc.transaction.select })
                : Promise.resolve([]),
            pItemIds.length
                ? (this.prisma as any).transactionItem.findMany({ where: { id: { in: pItemIds } }, select: inc.transactionItem.select })
                : Promise.resolve([]),
        ]);
        const txMap = new Map((txs as any[]).map(t => [t.id, t]));
        const itemMap = new Map((items as any[]).map(it => [it.id, it]));

        const jobs = pageRows
            .map(r => ({
                ...r,
                transaction: txMap.get(r.transactionId) ?? null,
                transactionItem: itemMap.get(r.transactionItemId) ?? null,
            }))
            .filter(j => j.transaction);

        return { rows: jobs, total, page: safePage, pageSize: take };
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

    async finishJob(id: number, operatorName?: string, coOperatorNames?: string[], operatorBranchId?: number | null) {
        const job = await this.getJob(id);
        if (job.status !== 'PROSES') throw new BadRequestException('Job tidak dalam status PROSES');
        // Kerja sama: simpan daftar rekan → leaderboard bagi rata 1/N (primary + rekan).
        const primary = (operatorName || job.operatorName || '').trim();
        const partners = Array.from(new Set(
            (coOperatorNames ?? [])
                .map(n => (n || '').trim())
                .filter(n => n && n !== primary),
        ));
        const updated = await (this.prisma as any).printJob.update({
            where: { id },
            data: {
                status: 'SELESAI', finishedAt: new Date(),
                operatorName: primary || job.operatorName,
                coOperators: partners.length ? partners : [],
                // cabang PIN operator cetak → atribusi leaderboard; fallback cabang job.
                operatorBranchId: operatorBranchId ?? (job as any).branchId ?? null,
            },
            include: this.jobInclude(),
        });
        // Notifikasi Discord: pesanan selesai dicetak → siap diambil (channel #produksi)
        const tx = updated.transaction;
        const branchLabel = tx?.branch
            ? (tx.branch.code ? `[${tx.branch.code}] ${tx.branch.name}` : tx.branch.name)
            : undefined;
        this.discord.notifyJobReady({
            jobNumber: updated.jobNumber,
            customerName: tx?.customerName ?? undefined,
            customerPhone: tx?.customerPhone ?? null,
            invoiceNumber: tx?.invoiceNumber ?? null,
            branchLabel,
            branchId: tx?.branchId ?? updated.branchId ?? null,
        });
        return updated;
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

    /**
     * Bulk pickup: konfirmasi banyak print job sekaligus sudah diambil customer.
     * Mirror logic dari ProductionService.bulkPickup.
     */
    async bulkPickup(ids: number[], branchId?: number | null): Promise<{ updated: number; skipped: { id: number; reason: string }[] }> {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestException('Daftar id wajib diisi');
        }
        const safeIds = ids.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
        if (!safeIds.length) throw new BadRequestException('Tidak ada id valid');

        return this.prisma.$transaction(async (tx) => {
            const jobs: any[] = await (tx as any).printJob.findMany({
                where: { id: { in: safeIds } },
                select: { id: true, status: true, branchId: true },
            });
            const skipped: { id: number; reason: string }[] = [];
            const validIds: number[] = [];
            const foundIds = new Set(jobs.map(j => j.id));
            for (const id of safeIds) {
                if (!foundIds.has(id)) skipped.push({ id, reason: 'Tidak ditemukan' });
            }
            for (const j of jobs) {
                if (j.status !== 'SELESAI') {
                    skipped.push({ id: j.id, reason: `Status ${j.status} (bukan SELESAI)` });
                    continue;
                }
                if (branchId != null && j.branchId !== branchId) {
                    skipped.push({ id: j.id, reason: 'Bukan dari cabang Anda' });
                    continue;
                }
                validIds.push(j.id);
            }

            let updated = 0;
            if (validIds.length > 0) {
                const res = await (tx as any).printJob.updateMany({
                    where: { id: { in: validIds }, status: 'SELESAI' },
                    data: { status: 'DIAMBIL', pickedUpAt: new Date() },
                });
                updated = res.count;
            }
            return { updated, skipped };
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
