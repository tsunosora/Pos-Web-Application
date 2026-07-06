import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FollowUpsService } from '../crm/follow-ups/follow-ups.service';

@Injectable()
export class ProductionService {
    constructor(
        private prisma: PrismaService,
        private followUps: FollowUpsService,
    ) {}

    /**
     * Trigger after-sales FU 3 hari setelah pickup. Idempotent + dedup di
     * FollowUpsService. Dipanggil dari pickupJob & bulkPickup. Error tidak
     * boleh bubble — flow pickup tidak boleh gagal karena CRM error.
     */
    private async _triggerAfterSales(jobIds: number[]) {
        try {
            const jobs: any[] = await (this.prisma as any).productionJob.findMany({
                where: { id: { in: jobIds } },
                select: { id: true, transactionId: true, branchId: true },
            });
            const txIds = Array.from(new Set(jobs.map(j => j.transactionId).filter(Boolean)));
            if (txIds.length === 0) return;
            const txs: any[] = await (this.prisma as any).transaction.findMany({
                where: { id: { in: txIds } },
                select: { id: true, customerId: true, branchId: true, userId: true },
            });
            const txMap = new Map(txs.map(t => [t.id, t]));
            for (const job of jobs) {
                const tx = txMap.get(job.transactionId);
                if (!tx?.customerId) continue;
                await this.followUps.scheduleAfterSales({
                    customerId: tx.customerId,
                    branchId: tx.branchId ?? job.branchId ?? null,
                    sourceRef: `production-pickup:job-${job.id}`,
                    assignedToId: tx.userId ?? null,
                });
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.error('[afterSales] gagal trigger:', err);
        }
    }

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
                    checkoutNumber: true,
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

    /**
     * Catat aktivitas penyelesaian job oleh operator board (status-mode) agar ikut
     * terhitung di leaderboard operator — yang membaca ProductionJobActivity
     * (STAGE_CHANGE oleh actorRole OPERATOR). Board status-mode tidak punya field
     * operator, jadi attribusi diambil dari nama yang diisi operator saat login.
     */
    private async logOperatorDone(jobId: number, toStage: string, operatorName?: string, client?: any, coOperatorNames?: string[]) {
        const primary = operatorName?.trim();
        if (!primary) return;
        // Kerja sama: tulis 1 baris kredit per operator, bobot 1/N (bagi rata).
        const partners = (coOperatorNames ?? [])
            .map(n => (n || '').trim())
            .filter(n => n && n !== primary);
        const all = Array.from(new Set([primary, ...partners]));
        const weight = 1 / all.length;
        await ((client ?? this.prisma) as any).productionJobActivity.createMany({
            data: all.map(name => ({ jobId, action: 'STAGE_CHANGE', toStage, actorName: name, actorRole: 'OPERATOR', actorWeight: weight })),
        });
    }

    async completeJob(id: number, operatorNote?: string, operatorName?: string, coOperatorNames?: string[]) {
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
        const opName = operatorName?.trim();

        const updated = await (this.prisma as any).productionJob.update({
            where: { id },
            data: {
                status: nextStatus,
                completedAt: new Date(),
                ...(operatorNote ? { operatorNote } : {}),
                ...(opName ? { lastUpdatedBy: opName, lastUpdatedAt: new Date() } : {}),
            },
            include: this.jobInclude(),
        });
        // SELESAI = produksi tuntas (dihitung "selesai" + omzet); MENUNGGU_PASANG =
        // produksi cetak selesai tapi tunggu rakit → forward stage non-done.
        await this.logOperatorDone(id, nextStatus === 'SELESAI' ? 'SELESAI' : 'ANTRIAN_PRESS', opName, undefined, coOperatorNames);
        return updated;
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

    async completeAssembly(id: number, assemblyNote?: string, operatorName?: string, coOperatorNames?: string[]) {
        const job = await (this.prisma as any).productionJob.findUnique({ where: { id } });
        if (!job) throw new NotFoundException('Job tidak ditemukan');
        if (job.status !== 'PASANG') throw new BadRequestException('Job belum dalam status PASANG');

        const opName = operatorName?.trim();
        const updated = await (this.prisma as any).productionJob.update({
            where: { id },
            data: {
                status: 'SELESAI',
                assemblyCompletedAt: new Date(),
                ...(assemblyNote ? { assemblyNote } : {}),
                ...(opName ? { lastUpdatedBy: opName, lastUpdatedAt: new Date() } : {}),
            },
            include: this.jobInclude(),
        });
        await this.logOperatorDone(id, 'SELESAI', opName, undefined, coOperatorNames);
        return updated;
    }

    async pickupJob(id: number) {
        const job = await (this.prisma as any).productionJob.findUnique({ where: { id } });
        if (!job) throw new NotFoundException('Job tidak ditemukan');
        if (job.status !== 'SELESAI') throw new BadRequestException('Job belum SELESAI');

        const updated = await (this.prisma as any).productionJob.update({
            where: { id },
            data: { status: 'DIAMBIL', pickedUpAt: new Date() },
            include: this.jobInclude(),
        });

        // Schedule after-sales FU (idempotent + error-tolerant)
        await this._triggerAfterSales([id]);

        return updated;
    }

    /**
     * Bulk pickup: konfirmasi banyak job sekaligus sudah diambil customer.
     * Validasi: semua id harus status SELESAI. Kalau optional `branchId` di-pass,
     * validate juga semua job dari cabang itu (security: kasir cabang lain tidak
     * bisa pickup job cabang lain).
     * Return: jumlah updated + list skipped (untuk feedback UI).
     */
    async bulkPickup(ids: number[], branchId?: number | null): Promise<{ updated: number; skipped: { id: number; reason: string }[] }> {
        if (!Array.isArray(ids) || ids.length === 0) {
            throw new BadRequestException('Daftar id wajib diisi');
        }
        const safeIds = ids.map(n => Number(n)).filter(n => Number.isFinite(n) && n > 0);
        if (!safeIds.length) throw new BadRequestException('Tidak ada id valid');

        return this.prisma.$transaction(async (tx) => {
            const jobs: any[] = await (tx as any).productionJob.findMany({
                where: { id: { in: safeIds } },
                select: { id: true, status: true, branchId: true },
            });
            const skipped: { id: number; reason: string }[] = [];
            const validIds: number[] = [];
            const foundIds = new Set(jobs.map(j => j.id));
            for (const id of safeIds) {
                if (!foundIds.has(id)) {
                    skipped.push({ id, reason: 'Tidak ditemukan' });
                }
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
                const res = await (tx as any).productionJob.updateMany({
                    where: { id: { in: validIds }, status: 'SELESAI' },
                    data: { status: 'DIAMBIL', pickedUpAt: new Date() },
                });
                updated = res.count;
            }
            return { updated, skipped, validIds };
        }).then(async (result) => {
            // After transaction commits, fire after-sales (outside tx supaya
            // dedup query lihat data ter-commit, dan kalau gagal tidak rollback pickup).
            if (result.validIds.length > 0) {
                await this._triggerAfterSales(result.validIds);
            }
            return { updated: result.updated, skipped: result.skipped };
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

    async completeBatch(id: number, operatorName?: string, coOperatorNames?: string[]) {
        return this.prisma.$transaction(async (tx) => {
            const batch = await (tx as any).productionBatch.findUnique({ where: { id } });
            if (!batch) throw new NotFoundException('Batch tidak ditemukan');
            if (batch.status !== 'PROSES') throw new BadRequestException('Batch tidak dalam status PROSES');

            const opName = operatorName?.trim();
            const toComplete: any[] = await (tx as any).productionJob.findMany({
                where: { batchId: id, status: 'PROSES' },
                select: { id: true },
            });

            await (tx as any).productionJob.updateMany({
                where: { batchId: id, status: 'PROSES' },
                data: { status: 'SELESAI', completedAt: new Date(), ...(opName ? { lastUpdatedBy: opName, lastUpdatedAt: new Date() } : {}) },
            });

            // Attribusi tiap job ke operator (leaderboard membaca activity log).
            // Kerja sama: 1 baris kredit per operator per job, bobot 1/N (bagi rata).
            if (opName && toComplete.length) {
                const partners = (coOperatorNames ?? [])
                    .map(n => (n || '').trim())
                    .filter(n => n && n !== opName);
                const all = Array.from(new Set([opName, ...partners]));
                const weight = 1 / all.length;
                await (tx as any).productionJobActivity.createMany({
                    data: toComplete.flatMap(j => all.map(name => ({ jobId: j.id, action: 'STAGE_CHANGE', toStage: 'SELESAI', actorName: name, actorRole: 'OPERATOR', actorWeight: weight }))),
                });
            }

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

    // ─── Pipeline Kanban (admin view) ──────────────────────────────────────────
    // Stages: DESIGN, PRINT, ANTRIAN_PRESS, JAHIT, QC_PACKING, KIRIM, RETUR, SELESAI
    // Field `pipelineStage` di-set independen dari `status` (yang dipakai operator).

    private static readonly PIPELINE_STAGES = [
        'DESIGN', 'PRINT', 'ANTRIAN_PRESS', 'JAHIT', 'QC_PACKING', 'KIRIM', 'RETUR', 'SELESAI',
    ] as const;

    async getPipelineJobs(branchId?: number) {
        // Hanya tampilkan: (1) job non-terminal di stage apapun, (2) job terminal (SELESAI/RETUR)
        // yang baru di-update dalam 14 hari terakhir. Ini cegah ratusan job lama membebani kanban.
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 14);

        const where: any = {
            ...(branchId ? { branchId } : {}),
            cancelledAt: null, // job batal di-hide dari kanban aktif (tetap dihitung di leaderboard)
            OR: [
                { pipelineStage: null },                                                 // belum di-stage → tampil di DESIGN
                { pipelineStage: { notIn: ['SELESAI', 'RETUR'] } },                     // masih aktif
                { pipelineStage: { in: ['SELESAI', 'RETUR'] }, updatedAt: { gte: cutoff } }, // baru selesai/retur
            ],
        };
        const jobs = await (this.prisma as any).productionJob.findMany({
            where,
            orderBy: [{ priority: 'desc' }, { deadline: 'asc' }, { createdAt: 'asc' }],
            include: {
                transaction: {
                    select: {
                        id: true, invoiceNumber: true, customerName: true, customerPhone: true,
                    },
                },
                transactionItem: {
                    select: {
                        id: true, quantity: true, widthCm: true, heightCm: true, unitType: true,
                        productVariant: {
                            select: {
                                id: true, variantName: true,
                                product: { select: { id: true, name: true } },
                            },
                        },
                    },
                },
                branch: { select: { id: true, name: true, code: true } },
                proofs: { orderBy: { position: 'asc' }, select: { id: true, filename: true, caption: true } },
            },
            take: 500, // hard cap supaya FE tidak overload
        });
        return jobs;
    }

    async addProof(jobId: number, filename: string, actor?: { name?: string; role?: 'ADMIN' | 'OPERATOR' }, designerName?: string) {
        const last = await (this.prisma as any).productionJobProof.findFirst({
            where: { jobId },
            orderBy: { position: 'desc' },
            select: { position: true },
        });
        const isFirstProof = !last;
        const nextPos = last ? last.position + 1 : 0;
        const caption = actor?.name ? `by ${actor.name}` : null;
        const proof = await (this.prisma as any).productionJobProof.create({
            data: { jobId, filename, position: nextPos, caption },
        });
        const jobUpdate: any = {};
        if (actor?.name) {
            jobUpdate.lastUpdatedBy = actor.name;
            jobUpdate.lastUpdatedAt = new Date();
        }
        if (isFirstProof) {
            jobUpdate.designEnteredAt = new Date();
        }
        // Kredit desainer (dipilih saat upload) → leaderboard produksi desainer.
        // Hanya untuk atribusi produksi; tidak menyentuh lead.designerName.
        if (designerName && designerName.trim()) {
            jobUpdate.designerName = designerName.trim();
        }
        if (Object.keys(jobUpdate).length > 0) {
            await (this.prisma as any).productionJob.update({
                where: { id: jobId },
                data: jobUpdate,
            });
        }
        await this.logProofActivity(jobId, 'PROOF_UPLOAD', actor, { proofId: proof.id, filename });
        return proof;
    }

    async deleteProof(proofId: number, actor?: { name?: string; role?: 'ADMIN' | 'OPERATOR' }) {
        const proof = await (this.prisma as any).productionJobProof.findUnique({
            where: { id: proofId }, select: { jobId: true, filename: true },
        });
        if (!proof) return { ok: true };
        await (this.prisma as any).productionJobProof.delete({ where: { id: proofId } });

        // Sync proofImageUrl ke proof terakhir yang tersisa, atau null jika sudah habis.
        // Ini penting supaya legacy fallback di getProofList tidak menampilkan gambar lama.
        const remaining = await (this.prisma as any).productionJobProof.findFirst({
            where: { jobId: proof.jobId },
            orderBy: { position: 'asc' },
            select: { filename: true },
        });
        const jobUpdate: any = { proofImageUrl: remaining ? remaining.filename : null };
        if (actor?.name) {
            jobUpdate.lastUpdatedBy = actor.name;
            jobUpdate.lastUpdatedAt = new Date();
        }
        await (this.prisma as any).productionJob.update({
            where: { id: proof.jobId },
            data: jobUpdate,
        });

        await this.logProofActivity(proof.jobId, 'PROOF_DELETE', actor, { proofId, filename: proof.filename });
        return { ok: true };
    }

    async deleteJob(id: number) {
        // ProductionJobProof di-cascade-delete otomatis (onDelete: Cascade di schema)
        await (this.prisma as any).productionJob.delete({ where: { id } });
        return { ok: true };
    }

    // Tandai job batal (klien tidak jadi order). Di-hide dari kanban tapi tetap di DB
    // untuk statistik leaderboard designer. Set cancel=false untuk membatalkan status batal.
    async setJobCancelled(id: number, cancel: boolean, reason?: string, actor?: { name?: string }) {
        await (this.prisma as any).productionJob.update({
            where: { id },
            data: cancel
                ? {
                    cancelledAt: new Date(),
                    cancelReason: reason?.trim() || null,
                    ...(actor?.name ? { lastUpdatedBy: actor.name, lastUpdatedAt: new Date() } : {}),
                }
                : { cancelledAt: null, cancelReason: null },
        });
        return { ok: true };
    }

    async updatePipelineStage(
        id: number,
        data: {
            pipelineStage?: string;
            penjahitName?: string;
            jahitInDate?: string;
            jahitEstimate?: string;
            qcNote?: string;
            returnReason?: string;
            proofImageUrl?: string | null;
            isExpress?: boolean;
            designerName?: string | null;
            coOperatorNames?: string[];
        },
        actor?: { name?: string; role?: 'ADMIN' | 'OPERATOR' },
    ) {
        // Load existing untuk dapat fromStage di audit
        const existing = await (this.prisma as any).productionJob.findUnique({
            where: { id }, select: { pipelineStage: true },
        });
        const updateData: any = {};
        if (data.pipelineStage !== undefined) {
            if (!ProductionService.PIPELINE_STAGES.includes(data.pipelineStage as any)) {
                throw new BadRequestException(`Pipeline stage tidak valid: ${data.pipelineStage}`);
            }
            updateData.pipelineStage = data.pipelineStage;
        }
        // Proof image setter (stage-agnostic — biasa di DESIGN tapi bisa di-update di stage lain juga)
        if (data.proofImageUrl !== undefined) {
            updateData.proofImageUrl = data.proofImageUrl || null;
        }
        if (data.isExpress !== undefined) {
            updateData.isExpress = data.isExpress;
        }
        if (data.designerName !== undefined) {
            updateData.designerName = data.designerName || null;
        }

        // Auto-set timestamp berdasarkan transisi
        if (data.pipelineStage === 'JAHIT') {
            if (data.penjahitName !== undefined) updateData.penjahitName = data.penjahitName || null;
            if (data.jahitInDate !== undefined) {
                updateData.jahitInDate = data.jahitInDate ? new Date(data.jahitInDate) : null;
            }
            if (data.jahitEstimate !== undefined) {
                updateData.jahitEstimate = data.jahitEstimate ? new Date(data.jahitEstimate) : null;
            }
        }
        if (data.pipelineStage === 'QC_PACKING' && data.qcNote !== undefined) {
            updateData.qcNote = data.qcNote || null;
        }
        if (data.pipelineStage === 'KIRIM') {
            updateData.shippedAt = new Date();
        }
        if (data.pipelineStage === 'RETUR') {
            updateData.returnedAt = new Date();
            if (data.returnReason !== undefined) updateData.returnReason = data.returnReason || null;
        }

        // Audit metadata
        if (actor?.name) {
            updateData.lastUpdatedBy = actor.name;
            updateData.lastUpdatedAt = new Date();
        }

        const updated = await (this.prisma as any).productionJob.update({
            where: { id },
            data: updateData,
        });

        // Log activity entries (one per kind of change, biar history readable)
        const acts: any[] = [];
        if (data.pipelineStage !== undefined && existing?.pipelineStage !== data.pipelineStage) {
            // Kerja sama (khusus operator): tulis 1 baris STAGE_CHANGE per operator,
            // bobot 1/N (bagi rata). Admin/tanpa rekan → 1 baris bobot 1 (perilaku lama).
            const partners = (actor?.role === 'OPERATOR' ? (data.coOperatorNames ?? []) : [])
                .map((n: string) => (n || '').trim())
                .filter((n: string) => n && n !== actor?.name);
            const all = Array.from(new Set([actor?.name, ...partners].filter(Boolean)));
            const names = all.length ? all : [actor?.name ?? null];
            const weight = names.length ? 1 / names.length : 1;
            for (const name of names) {
                acts.push({
                    jobId: id,
                    action: 'STAGE_CHANGE',
                    fromStage: existing?.pipelineStage ?? null,
                    toStage: data.pipelineStage,
                    actorName: name ?? null,
                    actorRole: actor?.role ?? null,
                    actorWeight: weight,
                });
            }
        }
        if (data.pipelineStage === 'JAHIT' && (data.penjahitName || data.jahitEstimate)) {
            acts.push({
                jobId: id,
                action: 'JAHIT_INFO',
                toStage: 'JAHIT',
                actorName: actor?.name ?? null,
                actorRole: actor?.role ?? null,
                meta: {
                    penjahitName: data.penjahitName,
                    jahitInDate: data.jahitInDate,
                    jahitEstimate: data.jahitEstimate,
                },
            });
        }
        if (data.qcNote) {
            acts.push({
                jobId: id, action: 'QC_NOTE',
                actorName: actor?.name ?? null, actorRole: actor?.role ?? null,
                meta: { qcNote: data.qcNote },
            });
        }
        if (data.returnReason) {
            acts.push({
                jobId: id, action: 'RETURN_REASON',
                actorName: actor?.name ?? null, actorRole: actor?.role ?? null,
                meta: { returnReason: data.returnReason },
            });
        }
        if (acts.length > 0) {
            await (this.prisma as any).productionJobActivity.createMany({ data: acts });
        }

        return updated;
    }

    /** Verify PIN operator untuk akses public endpoint. */
    async verifyOperatorPinPublic(pin: string, branchId?: number): Promise<void> {
        const result = await this.verifyPin(pin, branchId);
        if (!result.valid) {
            throw new BadRequestException(result.message || 'PIN operator salah');
        }
    }

    async logProofActivity(jobId: number, action: 'PROOF_UPLOAD' | 'PROOF_DELETE', actor?: { name?: string; role?: 'ADMIN' | 'OPERATOR' }, meta?: any) {
        if (!actor?.name && !meta) return;
        await (this.prisma as any).productionJobActivity.create({
            data: {
                jobId, action,
                actorName: actor?.name ?? null,
                actorRole: actor?.role ?? null,
                meta: meta ?? undefined,
            },
        });
    }

    async getJobActivities(jobId: number) {
        return (this.prisma as any).productionJobActivity.findMany({
            where: { jobId },
            orderBy: { createdAt: 'desc' },
            take: 100,
        });
    }
}
