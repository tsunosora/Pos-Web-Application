import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch, assertBranchAccess } from '../common/branch-where.helper';

@Injectable()
export class StockOpnameService {
    constructor(private readonly prisma: PrismaService) {}

    // ─── Admin: buat sesi baru ─────────────────────────────────────────────────
    async startSession(
        dto: { notes?: string; categoryId?: number; expiresHours?: number },
        branchCtx: BranchContext,
    ) {
        const branchId = requireBranch(branchCtx);
        const hours = dto.expiresHours ?? 24;
        const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

        return this.prisma.stockOpnameSession.create({
            data: {
                notes: dto.notes,
                categoryId: dto.categoryId ?? null,
                expiresAt,
                branchId,
            } as any,
            include: { category: { select: { id: true, name: true } } },
        });
    }

    // ─── Admin: list semua sesi ────────────────────────────────────────────────
    async getSessions(branchCtx: BranchContext) {
        return this.prisma.stockOpnameSession.findMany({
            where: { ...branchWhere(branchCtx) },
            orderBy: { startDate: 'desc' },
            include: {
                category: { select: { id: true, name: true } },
                _count: { select: { items: true } },
            },
        });
    }

    // ─── Admin: detail sesi + items dikelompokkan per varian ──────────────────
    async getSessionDetail(id: string, branchCtx: BranchContext) {
        const session = await this.prisma.stockOpnameSession.findUnique({
            where: { id },
            include: {
                category: { select: { id: true, name: true } },
                items: {
                    include: {
                        productVariant: {
                            include: {
                                product: { select: { id: true, name: true, imageUrl: true } },
                            },
                        },
                    },
                    orderBy: { submittedAt: 'desc' },
                },
            },
        });

        if (!session) throw new NotFoundException('Sesi tidak ditemukan');
        assertBranchAccess(branchCtx, (session as any).branchId ?? null);
        return session;
    }

    // ─── Admin: batalkan sesi ─────────────────────────────────────────────────
    async cancelSession(id: string, branchCtx: BranchContext) {
        const session = await this.prisma.stockOpnameSession.findUnique({ where: { id } });
        if (!session) throw new NotFoundException('Sesi tidak ditemukan');
        assertBranchAccess(branchCtx, (session as any).branchId ?? null);
        if (session.status !== 'ONGOING') {
            throw new BadRequestException('Sesi sudah ditutup atau dibatalkan');
        }

        return this.prisma.stockOpnameSession.update({
            where: { id },
            data: { status: 'CANCELLED', endDate: new Date() },
        });
    }

    // ─── Admin: selesaikan sesi, perbarui stok ────────────────────────────────
    async finishSession(
        id: string,
        confirmedItems: { productVariantId: number; confirmedStock: number }[],
        branchCtx: BranchContext,
    ) {
        const session = await this.prisma.stockOpnameSession.findUnique({ where: { id } });
        if (!session) throw new NotFoundException('Sesi tidak ditemukan');
        assertBranchAccess(branchCtx, (session as any).branchId ?? null);
        if (session.status !== 'ONGOING') {
            throw new BadRequestException('Sesi sudah ditutup atau dibatalkan');
        }

        const sessionBranchId: number | null = (session as any).branchId ?? null;

        // Ambil stok saat ini dari BranchStock (per cabang) jika tersedia
        const variantIds = confirmedItems.map(i => i.productVariantId);
        const branchStocks = sessionBranchId
            ? await (this.prisma as any).branchStock.findMany({
                where: { branchId: sessionBranchId, productVariantId: { in: variantIds } },
                select: { productVariantId: true, stock: true },
            })
            : [];
        const bsMap = new Map<number, number>(branchStocks.map((b: any) => [b.productVariantId, Number(b.stock)]));

        const variants = await this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, stock: true },
        });
        const globalMap = new Map(variants.map(v => [v.id, Number(v.stock)]));

        for (const item of confirmedItems) {
            const currentBranchStock = sessionBranchId ? (bsMap.get(item.productVariantId) ?? 0) : (globalMap.get(item.productVariantId) ?? 0);
            const diff = item.confirmedStock - currentBranchStock;
            const currentGlobal = globalMap.get(item.productVariantId) ?? 0;
            const newGlobal = currentGlobal + diff;

            // Update agregat global (cache)
            await this.prisma.productVariant.update({
                where: { id: item.productVariantId },
                data: { stock: newGlobal },
            });

            // Upsert BranchStock
            if (sessionBranchId != null) {
                await (this.prisma as any).branchStock.upsert({
                    where: { branchId_productVariantId: { branchId: sessionBranchId, productVariantId: item.productVariantId } },
                    update: { stock: item.confirmedStock },
                    create: { branchId: sessionBranchId, productVariantId: item.productVariantId, stock: item.confirmedStock },
                });
            }

            if (diff !== 0) {
                await this.prisma.stockMovement.create({
                    data: {
                        productVariantId: item.productVariantId,
                        type: 'ADJUST',
                        quantity: Math.abs(diff),
                        reason: `Stok Opname #${id.slice(0, 8)} — ${diff > 0 ? '+' : ''}${diff}`,
                        balanceAfter: item.confirmedStock,
                        referenceId: `opname-${id.slice(0, 8)}`,
                        branchId: sessionBranchId,
                    } as any,
                });
            }
        }

        await this.prisma.stockOpnameSession.update({
            where: { id },
            data: { status: 'COMPLETED', endDate: new Date() },
        });

        return { message: 'Stok opname selesai', updated: confirmedItems.length };
    }

    // ─── Public: validasi token ────────────────────────────────────────────────
    async verifyToken(token: string) {
        const session = await this.prisma.stockOpnameSession.findUnique({
            where: { id: token },
            include: { category: { select: { id: true, name: true } } },
        });

        if (!session) throw new NotFoundException('Link tidak valid');
        if (session.status !== 'ONGOING') throw new ForbiddenException('Sesi sudah ditutup');
        if (new Date() > session.expiresAt) {
            // Auto-expire
            await this.prisma.stockOpnameSession.update({
                where: { id: token },
                data: { status: 'CANCELLED', endDate: new Date() },
            });
            throw new ForbiddenException('Link sudah kedaluwarsa');
        }

        return {
            sessionId: session.id,
            notes: session.notes,
            categoryName: session.category?.name ?? null,
            expiresAt: session.expiresAt,
            valid: true,
        };
    }

    // ─── Public: daftar produk untuk operator (BLIND — tanpa stok) ────────────
    async getProductsForToken(token: string) {
        await this.verifyToken(token);

        const session = await this.prisma.stockOpnameSession.findUnique({ where: { id: token } });
        const where: any = {};
        if (session?.categoryId) where.categoryId = session.categoryId;

        const products = await this.prisma.product.findMany({
            where,
            include: {
                category: { select: { name: true } },
                unit: { select: { name: true } },
                variants: {
                    select: {
                        id: true,
                        variantName: true,
                        sku: true,
                        size: true,
                        color: true,
                        variantImageUrl: true,
                        isRollMaterial: true,
                        // Sengaja TIDAK sertakan field `stock` — blind count
                    },
                },
            },
            orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
        });

        return products;
    }

    // ─── Public: operator submit hitungan ─────────────────────────────────────
    async submitItems(
        token: string,
        dto: {
            operatorName: string;
            items: {
                productVariantId: number;
                actualStock: number;
                isEstimated?: boolean;
                estimationNotes?: string;
            }[];
        },
    ) {
        await this.verifyToken(token);

        if (!dto.operatorName?.trim()) {
            throw new BadRequestException('Nama operator wajib diisi');
        }

        // Ambil stok sistem saat ini (per cabang sesi kalau ada)
        const sessionRow = await this.prisma.stockOpnameSession.findUnique({ where: { id: token } });
        const sessionBranchId: number | null = (sessionRow as any)?.branchId ?? null;

        const variantIds = dto.items.map(i => i.productVariantId);
        let stockMap: Map<number, number>;
        if (sessionBranchId != null) {
            const bs = await (this.prisma as any).branchStock.findMany({
                where: { branchId: sessionBranchId, productVariantId: { in: variantIds } },
                select: { productVariantId: true, stock: true },
            });
            stockMap = new Map<number, number>(bs.map((b: any) => [b.productVariantId, Number(b.stock)]));
        } else {
            const variants = await this.prisma.productVariant.findMany({
                where: { id: { in: variantIds } },
                select: { id: true, stock: true },
            });
            stockMap = new Map<number, number>(variants.map(v => [v.id, Number(v.stock)]));
        }

        // Hapus input sebelumnya dari operator yang sama di sesi ini (re-submit)
        await this.prisma.stockOpnameItem.deleteMany({
            where: { sessionId: token, operatorName: dto.operatorName.trim() },
        });

        await (this.prisma as any).stockOpnameItem.createMany({
            data: dto.items.map(item => {
                const rounded = Math.round(item.actualStock);
                const sysStock = stockMap.get(item.productVariantId) ?? 0;
                let notes: string | null = null;
                if (item.isEstimated) {
                    notes = `Nilai estimasi: ${item.actualStock}${item.estimationNotes ? ` — ${item.estimationNotes}` : ''}`;
                } else if (item.estimationNotes) {
                    notes = item.estimationNotes;
                }
                return {
                    sessionId: token,
                    operatorName: dto.operatorName.trim(),
                    productVariantId: item.productVariantId,
                    systemStock: sysStock,
                    actualStock: rounded,
                    variance: rounded - sysStock,
                    isEstimated: item.isEstimated ?? false,
                    estimationNotes: notes,
                };
            }),
        });

        return { message: 'Data berhasil disimpan', count: dto.items.length };
    }
}
