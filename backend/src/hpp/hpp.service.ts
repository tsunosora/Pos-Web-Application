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

    /**
     * Ringkasan rumus HPP tiap produk untuk halaman owner (read-only).
     * Sumber HPP efektif mengikuti logika transaksi: BOM varian > flat variant.hpp.
     * Worksheet (biaya variabel + tetap) ditampilkan sebagai info tambahan; biaya klik
     * iklan sengaja TIDAK dimasukkan ke HPP efektif agar tak drift dengan variant.hpp.
     */
    async getProductHppOverview(params?: { categoryId?: number; includeArchived?: boolean }) {
        const num = (v: any) => Number(v) || 0;

        const products = await this.prisma.product.findMany({
            where: {
                ...(params?.categoryId ? { categoryId: params.categoryId } : {}),
                ...(params?.includeArchived ? {} : { isActive: true }),
            },
            orderBy: { name: 'asc' },
            include: {
                category: { select: { id: true, name: true } },
                ingredients: true,
                variants: {
                    orderBy: { id: 'asc' },
                    include: {
                        variantIngredients: true,
                        hppWorksheets: {
                            orderBy: { id: 'desc' },
                            include: worksheetInclude,
                        },
                    },
                },
            },
        });

        return products.map((p: any) => {
            const productBom = (p.ingredients || []).map((ing: any) => ({
                name: ing.name,
                quantity: num(ing.quantity),
                unit: ing.unit,
                price: num(ing.price),
                subtotal: num(ing.price) * num(ing.quantity),
            }));
            const productBomHpp = productBom.reduce((s: number, x: any) => s + x.subtotal, 0);

            const variants = (p.variants || []).map((v: any) => {
                // 1) BOM varian
                const variantBom = (v.variantIngredients || []).map((ing: any) => ({
                    name: ing.name,
                    quantity: num(ing.quantity),
                    unit: ing.unit,
                    price: num(ing.price),
                    isServiceCost: !!ing.isServiceCost,
                    subtotal: num(ing.price) * num(ing.quantity),
                }));
                const variantBomHpp = variantBom.length
                    ? variantBom.reduce((s: number, x: any) => s + x.subtotal, 0)
                    : null;

                // 2) flat tersimpan
                const storedHpp = num(v.hpp);

                // 3) worksheet terbaru (jika ada) — subtotal dihitung sama seperti /reports/hpp
                const ws = (v.hppWorksheets || [])[0];
                let worksheet: any = null;
                if (ws) {
                    const variableCosts = (ws.variableCosts || []).map((c: any) => {
                        const isCustom = !c.productVariantId;
                        const price = isCustom ? num(c.customPrice) : num(c.productVariant?.price);
                        const priceUnitName = isCustom
                            ? 'unit'
                            : (c.productVariant?.product?.unit?.name || 'unit');
                        const pUnitMatch = String(priceUnitName).match(/\d+/);
                        const pUnitNum = pUnitMatch ? parseInt(pUnitMatch[0]) || 1 : 1;
                        const subtotal =
                            price === 0 || num(c.usageAmount) === 0
                                ? 0
                                : (price / pUnitNum) * num(c.usageAmount);
                        return {
                            name: isCustom
                                ? (c.customMaterialName || 'Bahan')
                                : (c.productVariant?.product?.name || `Varian #${c.productVariantId}`),
                            usageAmount: num(c.usageAmount),
                            usageUnit: c.usageUnit,
                            unitPrice: price,
                            subtotal,
                        };
                    });
                    const totalVariable = variableCosts.reduce((s: number, x: any) => s + x.subtotal, 0);
                    const fixedCosts = (ws.fixedCosts || []).map((f: any) => ({
                        name: f.name,
                        amount: num(f.amount),
                    }));
                    const totalFixedMonthly = fixedCosts.reduce((s: number, x: any) => s + x.amount, 0);
                    const targetVolume = Math.max(1, num(ws.targetVolume) || 1);
                    const allocatedFixed = totalFixedMonthly / targetVolume;
                    const targetMargin = num(ws.targetMargin);
                    const hppPerUnit = totalVariable + allocatedFixed;
                    const suggestedPrice =
                        targetMargin >= 0 && targetMargin < 100
                            ? Math.round(hppPerUnit / (1 - targetMargin / 100))
                            : Math.round(hppPerUnit);
                    worksheet = {
                        id: ws.id,
                        targetVolume,
                        targetMargin,
                        appliedAt: ws.appliedAt,
                        variableCosts,
                        fixedCosts,
                        totalVariable,
                        totalFixedMonthly,
                        allocatedFixed,
                        hppPerUnit,
                        suggestedPrice,
                    };
                }

                // HPP efektif = BOM varian jika ada, else flat tersimpan
                const effectiveHpp = variantBomHpp != null ? variantBomHpp : storedHpp;
                const source: 'variant-bom' | 'flat' | 'none' =
                    variantBomHpp != null ? 'variant-bom' : storedHpp > 0 ? 'flat' : 'none';

                const price = num(v.price);
                const margin = price > 0 ? ((price - effectiveHpp) / price) * 100 : null;

                return {
                    variantId: v.id,
                    variantName: v.variantName || v.sku || `Varian #${v.id}`,
                    sku: v.sku,
                    price,
                    storedHpp,
                    variantBom,
                    variantBomHpp,
                    worksheet,
                    effectiveHpp,
                    source,
                    margin,
                };
            });

            return {
                productId: p.id,
                productName: p.name,
                category: p.category ? { id: p.category.id, name: p.category.name } : null,
                productBom,
                productBomHpp,
                variants,
            };
        });
    }
}
