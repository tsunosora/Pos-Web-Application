import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const worksheetInclude = {
    variableCosts: {
        include: { productVariant: { include: { product: { include: { unit: true } } } } }
    },
    fixedCosts: true,
    productVariant: { include: { product: true } }
};

@Injectable()
export class HppService {
    constructor(private prisma: PrismaService) { }

    async findAll(variantId?: number) {
        return this.prisma.hppWorksheet.findMany({
            where: variantId ? { productVariantId: variantId } : undefined,
            include: worksheetInclude,
            orderBy: { updatedAt: 'desc' }
        });
    }

    async findOne(id: number) {
        const worksheet = await this.prisma.hppWorksheet.findUnique({
            where: { id },
            include: worksheetInclude
        });
        if (!worksheet) throw new NotFoundException('Worksheet not found');
        return worksheet;
    }

    async findByVariant(variantId: number) {
        return this.prisma.hppWorksheet.findMany({
            where: { productVariantId: variantId },
            include: worksheetInclude,
            orderBy: { updatedAt: 'desc' }
        });
    }

    async findByProduct(productId: number) {
        // Try by productId first (new link)
        const ws = await (this.prisma as any).hppWorksheet.findFirst({
            where: { productId },
            include: worksheetInclude,
            orderBy: { updatedAt: 'desc' }
        });
        if (ws) return ws;

        // Fallback: find by productVariantId for any variant of this product (backward compat)
        const variants = await this.prisma.productVariant.findMany({
            where: { productId },
            select: { id: true }
        });
        if (!variants.length) return null;
        const variantIds = variants.map(v => v.id);
        return this.prisma.hppWorksheet.findFirst({
            where: { productVariantId: { in: variantIds } },
            include: worksheetInclude,
            orderBy: { updatedAt: 'desc' }
        });
    }

    async create(data: any) {
        const prismaAny = this.prisma as any;
        return prismaAny.hppWorksheet.create({
            data: {
                productName: data.productName,
                targetVolume: data.targetVolume,
                targetMargin: data.targetMargin,
                productVariantId: data.productVariantId || null,
                productId: data.productId || null,
                variableCosts: {
                    create: data.variableCosts.map((vc: any) => ({
                        productVariantId: vc.productVariantId || null,
                        customMaterialName: vc.customMaterialName || null,
                        customPrice: vc.customPrice || null,
                        usageAmount: vc.usageAmount,
                        usageUnit: vc.usageUnit
                    }))
                },
                fixedCosts: {
                    create: data.fixedCosts.map((fc: any) => ({
                        name: fc.name,
                        amount: fc.amount
                    }))
                }
            },
            include: worksheetInclude
        });
    }

    async update(id: number, data: any) {
        await this.prisma.hppVariableCost.deleteMany({ where: { worksheetId: id } });
        await this.prisma.hppFixedCost.deleteMany({ where: { worksheetId: id } });

        const prismaAny = this.prisma as any;
        return prismaAny.hppWorksheet.update({
            where: { id },
            data: {
                productName: data.productName,
                targetVolume: data.targetVolume,
                targetMargin: data.targetMargin,
                ...(data.productVariantId !== undefined ? { productVariantId: data.productVariantId || null } : {}),
                ...(data.productId !== undefined ? { productId: data.productId || null } : {}),
                variableCosts: {
                    create: data.variableCosts.map((vc: any) => ({
                        productVariantId: vc.productVariantId || null,
                        customMaterialName: vc.customMaterialName || null,
                        customPrice: vc.customPrice || null,
                        usageAmount: vc.usageAmount,
                        usageUnit: vc.usageUnit
                    }))
                },
                fixedCosts: {
                    create: data.fixedCosts.map((fc: any) => ({
                        name: fc.name,
                        amount: fc.amount
                    }))
                }
            },
            include: worksheetInclude
        });
    }

    async remove(id: number) {
        return this.prisma.hppWorksheet.delete({ where: { id } });
    }

    /**
     * Apply calculated HPP from worksheet to the linked variant's hpp field.
     * Caller passes the calculated hppPerUnit value (result from frontend calculator).
     */
    async applyToVariant(worksheetId: number, hppPerUnit: number) {
        const worksheet = await this.findOne(worksheetId);
        if (!worksheet.productVariantId) {
            throw new BadRequestException('Worksheet ini belum ditautkan ke varian produk manapun.');
        }

        await this.prisma.productVariant.update({
            where: { id: worksheet.productVariantId },
            data: { hpp: hppPerUnit }
        });

        // Record the applied timestamp
        await this.prisma.hppWorksheet.update({
            where: { id: worksheetId },
            data: { appliedAt: new Date() }
        });

        return {
            message: `HPP Rp ${hppPerUnit.toLocaleString('id-ID')}/unit berhasil diterapkan ke varian.`,
            worksheetId,
            variantId: worksheet.productVariantId,
            hppPerUnit
        };
    }

    async applyVariantsCustom(worksheetId: number, variants: { variantId: number; hppPerUnit: number; scaleFactor: number }[]) {
        const sourceWs = await this.prisma.hppWorksheet.findUnique({
            where: { id: worksheetId },
            include: { variableCosts: true, fixedCosts: true }
        });
        if (!sourceWs) throw new NotFoundException('Worksheet tidak ditemukan.');

        await Promise.all(variants.map(async ({ variantId, hppPerUnit, scaleFactor }) => {
            // 1. Update hpp field varian
            await this.prisma.productVariant.update({
                where: { id: variantId },
                data: { hpp: hppPerUnit }
            });

            // 2. Scale variable costs berdasarkan scaleFactor
            const vcData = sourceWs.variableCosts.map((vc: any) => ({
                productVariantId: vc.productVariantId ?? null,
                customMaterialName: vc.customMaterialName ?? null,
                customPrice: vc.customPrice ?? null,
                usageAmount: Number(vc.usageAmount) * scaleFactor,
                usageUnit: vc.usageUnit,
            }));
            const fcData = sourceWs.fixedCosts.map((fc: any) => ({ name: fc.name, amount: fc.amount }));

            // 3. Buat / update worksheet untuk varian ini
            const existingWs = await this.prisma.hppWorksheet.findFirst({ where: { productVariantId: variantId } });
            if (existingWs) {
                await this.prisma.hppVariableCost.deleteMany({ where: { worksheetId: existingWs.id } });
                await this.prisma.hppFixedCost.deleteMany({ where: { worksheetId: existingWs.id } });
                await this.prisma.hppWorksheet.update({
                    where: { id: existingWs.id },
                    data: {
                        targetVolume: sourceWs.targetVolume,
                        targetMargin: sourceWs.targetMargin,
                        appliedAt: new Date(),
                        variableCosts: { create: vcData },
                        fixedCosts: { create: fcData },
                    }
                });
            } else {
                const variant = await this.prisma.productVariant.findUnique({
                    where: { id: variantId },
                    include: { product: true }
                });
                const wsName = variant
                    ? (variant.product.name + (variant.variantName ? ` — ${variant.variantName}` : ''))
                    : sourceWs.productName;
                await this.prisma.hppWorksheet.create({
                    data: {
                        productName: wsName,
                        targetVolume: sourceWs.targetVolume,
                        targetMargin: sourceWs.targetMargin,
                        productVariantId: variantId,
                        appliedAt: new Date(),
                        variableCosts: { create: vcData },
                        fixedCosts: { create: fcData },
                    }
                });
            }
        }));

        await this.prisma.hppWorksheet.update({ where: { id: worksheetId }, data: { appliedAt: new Date() } });
        return { message: `HPP berhasil diterapkan ke ${variants.length} varian.`, count: variants.length };
    }

    async applyToVariants(worksheetId: number, variantIds: number[], hppPerUnit: number) {
        if (!variantIds || variantIds.length === 0) {
            throw new BadRequestException('Pilih minimal satu varian.');
        }

        // Ambil source worksheet beserta semua biaya
        const sourceWs = await this.prisma.hppWorksheet.findUnique({
            where: { id: worksheetId },
            include: { variableCosts: true, fixedCosts: true }
        });
        if (!sourceWs) throw new NotFoundException('Worksheet tidak ditemukan.');

        await Promise.all(variantIds.map(async (variantId) => {
            // 1. Update hpp field varian
            await this.prisma.productVariant.update({
                where: { id: variantId },
                data: { hpp: hppPerUnit }
            });

            // 2. Jika ini adalah varian yang sudah di-link ke source worksheet, update appliedAt saja
            if (sourceWs.productVariantId === variantId) {
                await this.prisma.hppWorksheet.update({
                    where: { id: worksheetId },
                    data: { appliedAt: new Date() }
                });
                return;
            }

            // 3. Cari worksheet yang sudah ada untuk varian ini
            const existingWs = await this.prisma.hppWorksheet.findFirst({
                where: { productVariantId: variantId }
            });

            const vcData = sourceWs.variableCosts.map((vc: any) => ({
                productVariantId: vc.productVariantId ?? null,
                customMaterialName: vc.customMaterialName ?? null,
                customPrice: vc.customPrice ?? null,
                usageAmount: vc.usageAmount,
                usageUnit: vc.usageUnit,
            }));
            const fcData = sourceWs.fixedCosts.map((fc: any) => ({
                name: fc.name,
                amount: fc.amount,
            }));

            if (existingWs) {
                // Update worksheet yang sudah ada — sync biaya dari source
                await this.prisma.hppVariableCost.deleteMany({ where: { worksheetId: existingWs.id } });
                await this.prisma.hppFixedCost.deleteMany({ where: { worksheetId: existingWs.id } });
                await this.prisma.hppWorksheet.update({
                    where: { id: existingWs.id },
                    data: {
                        targetVolume: sourceWs.targetVolume,
                        targetMargin: sourceWs.targetMargin,
                        appliedAt: new Date(),
                        variableCosts: { create: vcData },
                        fixedCosts: { create: fcData },
                    }
                });
            } else {
                // Buat worksheet baru untuk varian ini
                const variant = await this.prisma.productVariant.findUnique({
                    where: { id: variantId },
                    include: { product: true }
                });
                const wsName = variant
                    ? (variant.product.name + (variant.variantName ? ` — ${variant.variantName}` : ''))
                    : sourceWs.productName;

                await this.prisma.hppWorksheet.create({
                    data: {
                        productName: wsName,
                        targetVolume: sourceWs.targetVolume,
                        targetMargin: sourceWs.targetMargin,
                        productVariantId: variantId,
                        appliedAt: new Date(),
                        variableCosts: { create: vcData },
                        fixedCosts: { create: fcData },
                    }
                });
            }
        }));

        // Stamp appliedAt pada source worksheet juga (jika belum di-handle di atas)
        if (!variantIds.includes(sourceWs.productVariantId as number)) {
            await this.prisma.hppWorksheet.update({
                where: { id: worksheetId },
                data: { appliedAt: new Date() }
            });
        }

        return {
            message: `HPP Rp ${hppPerUnit.toLocaleString('id-ID')}/unit berhasil diterapkan ke ${variantIds.length} varian.`,
            worksheetId,
            variantIds,
            hppPerUnit,
            count: variantIds.length
        };
    }
}
