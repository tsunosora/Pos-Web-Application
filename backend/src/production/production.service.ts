import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductionService {
    constructor(private prisma: PrismaService) {}

    // Multi-cabang: ubah stok di BranchStock + mirror ke ProductVariant.stock (cache agregat).
    // Selaras dengan TransactionsService._adjustStock supaya flow mulai-job ↔ hapus-transaksi konsisten.
    private async _adjustStock(
        tx: any,
        branchId: number | null | undefined,
        variantId: number,
        delta: number,
    ) {
        const rounded = Math.floor(delta * 100) / 100;
        const cur = await tx.productVariant.findUnique({
            where: { id: variantId },
            select: { stock: true },
        });
        const newGlobal = Math.floor((Number(cur?.stock ?? 0) + rounded) * 100) / 100;
        await tx.productVariant.update({
            where: { id: variantId },
            data: { stock: newGlobal },
        });
        if (branchId != null) {
            await (tx as any).branchStock.upsert({
                where: { branchId_productVariantId: { branchId, productVariantId: variantId } },
                update: { stock: { increment: rounded } },
                create: { branchId, productVariantId: variantId, stock: rounded },
            });
        }
        return newGlobal;
    }

    private jobInclude() {
        return {
            transaction: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    customerName: true,
                    customerPhone: true,
                    productionPriority: true,
                    productionDeadline: true,
                    productionNotes: true,
                    createdAt: true,
                    branchId: true,
                    productionBranchId: true,
                    branch: { select: { id: true, name: true, code: true } },
                    productionBranch: { select: { id: true, name: true, code: true } },
                },
            },
            transactionItem: {
                include: {
                    productVariant: { include: { product: { include: { ingredients: { include: { rawMaterialVariant: true } } } } } },
                },
            },
            rollVariant: { include: { product: true } },
            batch: true,
        };
    }

    async getJobs(status?: string, priority?: string, branchId?: number) {
        const where: any = {};
        if (status) where.status = status;
        if (priority) where.priority = priority;
        if (branchId) where.branchId = branchId;

        const jobs = await (this.prisma as any).productionJob.findMany({
            where,
            include: this.jobInclude(),
            orderBy: [
                { priority: 'asc' }, // EXPRESS < NORMAL alphabetically, so asc puts EXPRESS first
                { deadline: 'asc' },
                { createdAt: 'asc' },
            ],
        });

        const visibleJobs = await this.filterPendingTitipan(jobs);

        // Put nulls at end for deadline ordering
        return visibleJobs.sort((a: any, b: any) => {
            // Priority: EXPRESS before NORMAL
            if (a.priority !== b.priority) {
                return a.priority === 'EXPRESS' ? -1 : 1;
            }
            // Deadline: earliest first, nulls last
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
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

    async getRolls(branchId?: number) {
        const variants: any[] = await (this.prisma as any).productVariant.findMany({
            include: { product: true },
            orderBy: [{ product: { name: 'asc' } }],
        });

        // Multi-cabang: override variant.stock dengan BranchStock cabang aktif kalau branchId di-pass.
        // Operator perlu lihat stok roll cabang dia, bukan agregat global.
        if (branchId) {
            const variantIds = variants.map(v => v.id);
            const branchStocks: any[] = await (this.prisma as any).branchStock.findMany({
                where: { branchId, productVariantId: { in: variantIds } },
                select: { productVariantId: true, stock: true },
            });
            const stockMap = new Map<number, number>();
            for (const bs of branchStocks) {
                stockMap.set(Number(bs.productVariantId), Number(bs.stock));
            }
            for (const v of variants) {
                v.aggregateStock = v.stock; // simpan agregat global untuk reference
                v.stock = stockMap.get(v.id) ?? 0;
            }
        }
        return variants;
    }

    async startJob(id: number, data: {
        rollVariantId?: number;
        usedWaste: boolean;
        rollAreaM2?: number;   // luas bahan yang dipakai dalam m²
        operatorNote?: string;
    }) {
        return this.prisma.$transaction(async (tx) => {
            const job = await (tx as any).productionJob.findUnique({ where: { id } });
            if (!job) throw new NotFoundException('Job tidak ditemukan');
            if (job.status !== 'ANTRIAN') throw new BadRequestException('Job tidak dalam status ANTRIAN');

            if (!data.usedWaste && data.rollVariantId && data.rollAreaM2) {
                const jobBranchId: number | null = (job as any).branchId ?? null;
                const areaToDeduct = Math.ceil(data.rollAreaM2);

                // Cek stok per cabang (kalau job punya branchId). Fallback ke global kalau job lama tanpa branchId.
                if (jobBranchId != null) {
                    const bs = await (tx as any).branchStock.findUnique({
                        where: { branchId_productVariantId: { branchId: jobBranchId, productVariantId: data.rollVariantId } },
                        select: { stock: true },
                    });
                    const have = Number(bs?.stock ?? 0);
                    if (have < areaToDeduct) {
                        throw new BadRequestException(
                            `Stok bahan di cabang ini tidak cukup. Tersisa: ${have}m², dibutuhkan: ${areaToDeduct}m²`
                        );
                    }
                } else {
                    const roll = await (tx as any).productVariant.findUnique({ where: { id: data.rollVariantId } });
                    if (!roll) throw new NotFoundException('Bahan tidak ditemukan');
                    if (Number(roll.stock) < areaToDeduct) {
                        throw new BadRequestException(
                            `Stok bahan tidak cukup. Tersisa: ${Number(roll.stock)}m², dibutuhkan: ${areaToDeduct}m²`
                        );
                    }
                }

                const newGlobal = await this._adjustStock(tx, jobBranchId, data.rollVariantId, -areaToDeduct);

                await tx.stockMovement.create({
                    data: {
                        productVariantId: data.rollVariantId,
                        type: 'OUT',
                        quantity: areaToDeduct,
                        reason: `Produksi Job #${job.jobNumber} (${data.rollAreaM2.toFixed(2)}m²)`,
                        balanceAfter: newGlobal,
                        referenceId: job.jobNumber,
                        ...(jobBranchId != null ? { branchId: jobBranchId } : {}),
                    } as any,
                });
            }

            return (tx as any).productionJob.update({
                where: { id },
                data: {
                    status: 'PROSES',
                    rollVariantId: data.rollVariantId || null,
                    usedWaste: data.usedWaste,
                    rollLengthUsed: data.rollAreaM2 || null, // field reused to store area m²
                    operatorNote: data.operatorNote || null,
                    startedAt: new Date(),
                },
                include: this.jobInclude(),
            });
        });
    }

    async completeJob(id: number, operatorNote?: string) {
        const job = await (this.prisma as any).productionJob.findUnique({
            where: { id },
            include: {
                transactionItem: {
                    include: {
                        productVariant: {
                            include: { product: true }
                        }
                    }
                }
            }
        });
        if (!job) throw new NotFoundException('Job tidak ditemukan');
        if (job.status !== 'PROSES') throw new BadRequestException('Job belum dalam status PROSES');

        const hasAssemblyStage = job.transactionItem?.productVariant?.product?.hasAssemblyStage === true;
        const nextStatus = hasAssemblyStage ? 'MENUNGGU_PASANG' : 'SELESAI';

        return (this.prisma as any).productionJob.update({
            where: { id },
            data: {
                status: nextStatus,
                completedAt: new Date(),
                ...(operatorNote ? { operatorNote } : {}),
            },
            include: this.jobInclude(),
        });
    }

    async startAssembly(id: number, assemblyNote?: string) {
        return this.prisma.$transaction(async (tx) => {
            const job = await (tx as any).productionJob.findUnique({
                where: { id },
                include: {
                    transactionItem: {
                        include: {
                            productVariant: {
                                include: {
                                    product: {
                                        include: {
                                            ingredients: { include: { rawMaterialVariant: true } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });
            if (!job) throw new NotFoundException('Job tidak ditemukan');
            if (job.status !== 'MENUNGGU_PASANG') throw new BadRequestException('Job belum dalam status MENUNGGU_PASANG');

            // Deduct BOM ingredients (assembly materials like rangka) — multi-cabang via BranchStock.
            const jobBranchId: number | null = (job as any).branchId ?? null;
            const ingredients = job.transactionItem?.productVariant?.product?.ingredients || [];
            for (const ing of ingredients) {
                if (ing.rawMaterialVariantId) {
                    const needed = Number(ing.quantity);
                    const newGlobal = await this._adjustStock(tx, jobBranchId, ing.rawMaterialVariantId, -needed);
                    await tx.stockMovement.create({
                        data: {
                            productVariantId: ing.rawMaterialVariantId,
                            type: 'OUT',
                            quantity: Math.ceil(needed),
                            reason: `Pemasangan Job #${job.jobNumber} — ${ing.name}`,
                            balanceAfter: newGlobal,
                            referenceId: job.jobNumber,
                            ...(jobBranchId != null ? { branchId: jobBranchId } : {}),
                        } as any,
                    });
                }
            }

            return (tx as any).productionJob.update({
                where: { id },
                data: {
                    status: 'PASANG',
                    assemblyStartedAt: new Date(),
                    ...(assemblyNote ? { assemblyNote } : {})
                },
                include: this.jobInclude(),
            });
        });
    }

    async completeAssembly(id: number, assemblyNote?: string) {
        const job = await (this.prisma as any).productionJob.findUnique({ where: { id } });
        if (!job) throw new NotFoundException('Job tidak ditemukan');
        if (job.status !== 'PASANG') throw new BadRequestException('Job belum dalam status PASANG');

        return (this.prisma as any).productionJob.update({
            where: { id },
            data: {
                status: 'SELESAI',
                assemblyCompletedAt: new Date(),
                ...(assemblyNote ? { assemblyNote } : {})
            },
            include: this.jobInclude(),
        });
    }

    async pickupJob(id: number) {
        const job = await (this.prisma as any).productionJob.findUnique({ where: { id } });
        if (!job) throw new NotFoundException('Job tidak ditemukan');
        if (job.status !== 'SELESAI') throw new BadRequestException('Job belum SELESAI');

        return (this.prisma as any).productionJob.update({
            where: { id },
            data: { status: 'DIAMBIL', pickedUpAt: new Date() },
            include: this.jobInclude(),
        });
    }

    async createBatch(data: {
        jobIds: number[];
        rollVariantId?: number;
        usedWaste: boolean;
        totalAreaM2?: number;  // total luas gabungan dalam m²
    }) {
        return this.prisma.$transaction(async (tx) => {
            const jobs = await (tx as any).productionJob.findMany({
                where: { id: { in: data.jobIds }, status: 'ANTRIAN' },
            });

            if (jobs.length !== data.jobIds.length) {
                throw new BadRequestException('Beberapa job tidak dalam status ANTRIAN atau tidak ditemukan');
            }

            const count = await (tx as any).productionBatch.count();
            const batchNumber = `BATCH-${String(count + 1).padStart(4, '0')}`;

            // Batch multi-cabang: asumsikan semua job dalam batch dari cabang yang sama.
            // Kalau beda-beda, fallback ke null (hanya update global cache) — tapi ini skenario langka.
            const batchBranchIds = Array.from(new Set(jobs.map((j: any) => j.branchId ?? null)));
            const batchBranchId: number | null = batchBranchIds.length === 1 ? batchBranchIds[0] as any : null;

            if (!data.usedWaste && data.rollVariantId && data.totalAreaM2) {
                const areaToDeduct = Math.ceil(data.totalAreaM2);

                if (batchBranchId != null) {
                    const bs = await (tx as any).branchStock.findUnique({
                        where: { branchId_productVariantId: { branchId: batchBranchId, productVariantId: data.rollVariantId } },
                        select: { stock: true },
                    });
                    const have = Number(bs?.stock ?? 0);
                    if (have < areaToDeduct) {
                        throw new BadRequestException(
                            `Stok bahan di cabang ini tidak cukup. Tersisa: ${have}m², dibutuhkan: ${areaToDeduct}m²`
                        );
                    }
                } else {
                    const roll = await (tx as any).productVariant.findUnique({ where: { id: data.rollVariantId } });
                    if (!roll) throw new NotFoundException('Bahan tidak ditemukan');
                    if (Number(roll.stock) < areaToDeduct) {
                        throw new BadRequestException(
                            `Stok bahan tidak cukup. Tersisa: ${Number(roll.stock)}m², dibutuhkan: ${areaToDeduct}m²`
                        );
                    }
                }

                const newGlobal = await this._adjustStock(tx, batchBranchId, data.rollVariantId, -areaToDeduct);

                await tx.stockMovement.create({
                    data: {
                        productVariantId: data.rollVariantId,
                        type: 'OUT',
                        quantity: areaToDeduct,
                        reason: `Gabung Cetak ${batchNumber} (${data.totalAreaM2.toFixed(2)}m²)`,
                        balanceAfter: newGlobal,
                        referenceId: batchNumber,
                        ...(batchBranchId != null ? { branchId: batchBranchId } : {}),
                    } as any,
                });
            }

            const batch = await (tx as any).productionBatch.create({
                data: {
                    batchNumber,
                    rollVariantId: data.rollVariantId || null,
                    usedWaste: data.usedWaste,
                    rollLengthUsed: data.totalAreaM2 || null,
                    status: 'PROSES',
                    startedAt: new Date(),
                },
            });

            await (tx as any).productionJob.updateMany({
                where: { id: { in: data.jobIds } },
                data: { status: 'PROSES', batchId: batch.id, startedAt: new Date() },
            });

            // Store total area in batch rollLengthUsed field
            await (tx as any).productionBatch.update({
                where: { id: batch.id },
                data: { rollLengthUsed: data.totalAreaM2 || null },
            });

            return batch;
        });
    }

    async completeBatch(id: number) {
        return this.prisma.$transaction(async (tx) => {
            const batch = await (tx as any).productionBatch.findUnique({ where: { id } });
            if (!batch) throw new NotFoundException('Batch tidak ditemukan');
            if (batch.status !== 'PROSES') throw new BadRequestException('Batch tidak dalam status PROSES');

            await (tx as any).productionJob.updateMany({
                where: { batchId: id, status: 'PROSES' },
                data: { status: 'SELESAI', completedAt: new Date() },
            });

            return (tx as any).productionBatch.update({
                where: { id },
                data: { status: 'SELESAI', completedAt: new Date() },
            });
        });
    }

    async verifyPin(pin: string, branchId?: number) {
        // Prioritas: BranchSettings.operatorPin cabang terpilih → fallback StoreSettings.operatorPin
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

    async getStats(branchId?: number) {
        const branchWhere = branchId ? { branchId } : {};
        const [antrian, proses, menungguPasang, pasang, selesai] = await Promise.all([
            (this.prisma as any).productionJob.count({ where: { status: 'ANTRIAN', ...branchWhere } }),
            (this.prisma as any).productionJob.count({ where: { status: 'PROSES', ...branchWhere } }),
            (this.prisma as any).productionJob.count({ where: { status: 'MENUNGGU_PASANG', ...branchWhere } }),
            (this.prisma as any).productionJob.count({ where: { status: 'PASANG', ...branchWhere } }),
            (this.prisma as any).productionJob.count({ where: { status: 'SELESAI', ...branchWhere } }),
        ]);
        return { antrian, proses, menungguPasang, pasang, selesai };
    }
}
