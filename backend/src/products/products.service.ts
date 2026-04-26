import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';

/**
 * Override variant.stock dengan stok cabang aktif (BranchStock).
 * Kalau branchCtx.branchId null (Owner "Semua Cabang"), biarkan stock aggregate.
 * Mutasi in-place untuk hindari deep-clone.
 */
async function attachBranchStocks(prisma: PrismaService, products: any[], branchCtx: BranchContext) {
    if (!branchCtx?.branchId) return products;
    const variantIds = products.flatMap((p) => (p.variants ?? []).map((v: any) => v.id));
    if (variantIds.length === 0) return products;
    const branchStocks: { productVariantId: number; stock: number }[] = await (prisma as any).branchStock.findMany({
        where: { branchId: branchCtx.branchId, productVariantId: { in: variantIds } },
        select: { productVariantId: true, stock: true },
    });
    const stockMap = new Map<number, number>();
    branchStocks.forEach((bs) => stockMap.set(bs.productVariantId, bs.stock));
    for (const p of products) {
        for (const v of p.variants ?? []) {
            v.aggregateStock = v.stock; // simpan global aggregate kalau frontend butuh
            v.stock = stockMap.get(v.id) ?? 0;
        }
    }
    return products;
}

const variantInclude = {
    priceTiers: { orderBy: { minQty: 'asc' as const } },
    variantIngredients: {
        include: { rawMaterialVariant: { include: { product: true } } },
        orderBy: { id: 'asc' as const }
    },
    clickRate: true,
};

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async create(data: any) {
        const { variants, ingredients, ...productData } = data;

        // Strip priceTiers & variantIngredients from variants before nested create
        const variantsToCreate = (variants || []).map((v: any) => {
            const { priceTiers, variantIngredients, ...variantData } = v;
            return variantData;
        });

        const product = await this.prisma.product.create({
            data: {
                ...productData,
                variants: { create: variantsToCreate },
                ingredients: { create: ingredients || [] }
            },
            include: {
                category: { include: { parent: { select: { id: true, name: true } } } } as any,
                unit: true,
                variants: { include: variantInclude },
                ingredients: true
            }
        });

        // Create priceTiers & variantIngredients per variant
        for (let i = 0; i < (variants || []).length; i++) {
            const v = variants[i];
            const createdVariant = product.variants[i];
            if (v.priceTiers?.length) {
                await this.prisma.variantPriceTier.createMany({
                    data: v.priceTiers.map((t: any) => ({ ...t, variantId: createdVariant.id }))
                });
            }
            if (v.variantIngredients?.length) {
                await this.prisma.variantIngredient.createMany({
                    data: v.variantIngredients.map((ing: any) => ({ ...ing, variantId: createdVariant.id }))
                });
            }
        }

        return this.findOne(product.id);
    }

    async findAll(branchCtx: BranchContext = { branchId: null, isOwner: true, roleName: null } as any) {
        const products = await (this.prisma as any).product.findMany({
            include: {
                category: { include: { parent: { select: { id: true, name: true } } } } as any,
                unit: true,
                clickRate: true,
                variants: {
                    include: {
                        ...variantInclude,
                        movements: {
                            where: {
                                OR: [
                                    { referenceId: 'initial-stock' },
                                    { reason: { contains: 'Stok Awal' } },
                                ],
                            } as any,
                            orderBy: { createdAt: 'asc' as const },
                            take: 1,
                            select: { quantity: true, balanceAfter: true, createdAt: true },
                        },
                    },
                },
                ingredients: true
            }
        });
        return attachBranchStocks(this.prisma, products, branchCtx);
    }

    async findOne(id: number, branchCtx: BranchContext = { branchId: null, isOwner: true, roleName: null } as any) {
        const product = await (this.prisma as any).product.findUnique({
            where: { id },
            include: {
                category: { include: { parent: { select: { id: true, name: true } } } } as any,
                unit: true,
                variants: { include: variantInclude },
                ingredients: true,
                clickRate: true,
            }
        });
        if (!product) throw new NotFoundException(`Product #${id} not found`);
        await attachBranchStocks(this.prisma, [product], branchCtx);
        return product;
    }

    async findOnePublic(id: number) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: { include: { parent: { select: { id: true, name: true } } } } as any,
                unit: true,
                variants: {
                    include: {
                        priceTiers: { orderBy: { minQty: 'asc' as const } }
                    }
                }
            }
        });
        if (!product) throw new NotFoundException(`Product #${id} not found`);
        return {
            ...product,
            variants: product.variants.map(({ hpp, stock, ...rest }) => rest)
        };
    }

    async update(id: number, data: any) {
        await this.findOne(id);
        const { variants, ingredients, deletedVariantIds, ...productData } = data;

        try {
            await this.prisma.product.update({ where: { id }, data: productData });

            // Hapus varian yang dihapus dari frontend
            if (deletedVariantIds?.length) {
                await this.prisma.productVariant.deleteMany({
                    where: { id: { in: deletedVariantIds }, productId: id },
                });
            }

            if (variants) {
                for (const v of variants) {
                    const { priceTiers, variantIngredients, id: variantId, ...variantData } = v;
                    let savedVariantId: number;

                    if (variantId) {
                        await this.prisma.productVariant.update({ where: { id: variantId }, data: variantData });
                        savedVariantId = variantId;
                    } else {
                        const created = await this.prisma.productVariant.create({ data: { ...variantData, productId: id } });
                        savedVariantId = created.id;
                    }

                    // Replace price tiers if provided
                    if (priceTiers !== undefined) {
                        await this.prisma.variantPriceTier.deleteMany({ where: { variantId: savedVariantId } });
                        if (priceTiers.length > 0) {
                            await this.prisma.variantPriceTier.createMany({
                                data: priceTiers.map((t: any) => {
                                    const { id: _id, variantId: _vid, ...tierData } = t;
                                    return { ...tierData, variantId: savedVariantId };
                                })
                            });
                        }
                    }

                    // Replace variant ingredients if provided
                    if (variantIngredients !== undefined) {
                        await this.prisma.variantIngredient.deleteMany({ where: { variantId: savedVariantId } });
                        if (variantIngredients.length > 0) {
                            await this.prisma.variantIngredient.createMany({
                                data: variantIngredients.map((ing: any) => {
                                    const { id: _id, variantId: _vid, rawMaterialVariant: _rm, ...ingData } = ing;
                                    return { ...ingData, variantId: savedVariantId };
                                })
                            });
                        }
                    }
                }
            }

            if (ingredients !== undefined) {
                await this.prisma.ingredient.deleteMany({ where: { productId: id } });
                if (ingredients.length > 0) {
                    await this.prisma.ingredient.createMany({
                        data: ingredients.map((ing: any) => ({ ...ing, productId: id }))
                    });
                }
            }
        } catch (e: any) {
            if (e.code === 'P2002') {
                const field = e.meta?.target?.join(', ') ?? 'field';
                throw new ConflictException(`Duplikat nilai pada ${field} — pastikan SKU setiap varian unik`);
            }
            throw e;
        }

        return this.findOne(id);
    }

    async bulkImport(payload: { products: any[] }) {
        const results: { created: number; skipped: number; errors: { name: string; message: string }[] } = {
            created: 0,
            skipped: 0,
            errors: [],
        };

        for (const item of payload.products) {
            try {
                // findFirst karena name tidak lagi @unique (mendukung sub-kategori)
                let category = await (this.prisma as any).category.findFirst({ where: { name: item.category, parentId: null } });
                if (!category) category = await (this.prisma as any).category.create({ data: { name: item.category } });
                const unit = await this.prisma.unit.upsert({
                    where: { name: item.unit },
                    create: { name: item.unit },
                    update: {},
                });

                // Map variants from bulk format to create format
                const variants = (item.variants || []).map((v: any) => ({
                    variantName: v.variantName || null,
                    sku: v.sku,
                    price: v.price,
                    hpp: v.hpp || 0,
                    stock: v.stock || 0,
                    size: v.size || null,
                    color: v.color || null,
                }));

                const product = await this.create({
                    name: item.name,
                    categoryId: category.id,
                    unitId: unit.id,
                    pricingMode: item.pricingMode || 'UNIT',
                    productType: item.productType || 'SELLABLE',
                    description: item.description || null,
                    requiresProduction: item.requiresProduction || false,
                    trackStock: true,
                    variants,
                });

                // Create HPP worksheets if provided
                for (const ws of (item.hppWorksheets || [])) {
                    const variant = product.variants.find((v: any) => v.sku === ws.variantSku);
                    const varCosts = (ws.variableCosts || []).filter((vc: any) => vc.customMaterialName && vc.usageAmount);
                    const fixCosts = (ws.fixedCosts || []).filter((fc: any) => fc.name && fc.amount);

                    await this.prisma.hppWorksheet.create({
                        data: {
                            productName: `${item.name}${ws.variantSku ? ' - ' + ws.variantSku : ''}`,
                            targetVolume: ws.targetVolume || 1,
                            targetMargin: ws.targetMargin || 50,
                            productVariantId: variant?.id || null,
                            variableCosts: {
                                create: varCosts.map((vc: any) => ({
                                    customMaterialName: vc.customMaterialName,
                                    customPrice: vc.customPrice || 0,
                                    usageAmount: vc.usageAmount,
                                    usageUnit: vc.usageUnit || 'pcs',
                                })),
                            },
                            fixedCosts: {
                                create: fixCosts.map((fc: any) => ({
                                    name: fc.name,
                                    amount: fc.amount,
                                })),
                            },
                        },
                    });
                }

                results.created++;
            } catch (err: any) {
                results.errors.push({ name: item.name, message: err.message });
            }
        }

        return results;
    }

    async updateImageUrl(id: number, imageUrl: string) {
        await this.findOne(id);
        return this.prisma.product.update({ where: { id }, data: { imageUrl } });
    }

    async updateImageUrls(id: number, imageUrls: string[]) {
        await this.findOne(id);
        return this.prisma.product.update({ where: { id }, data: { imageUrls: JSON.stringify(imageUrls) } });
    }

    async remove(id: number) {
        await this.findOne(id);
        return this.prisma.product.delete({ where: { id } });
    }

    async bulkRemove(ids: number[]) {
        const results = await Promise.allSettled(ids.map(id => this.remove(id)));
        const deleted = results.filter(r => r.status === 'fulfilled').length;
        const failed  = results.filter(r => r.status === 'rejected').length;
        return { deleted, failed };
    }

    // ── Variant management ──────────────────────────────────────────────────

    async addVariant(productId: number, variantData: any) {
        await this.findOne(productId);
        const { priceTiers, variantIngredients, ...data } = variantData;
        const variant = await this.prisma.productVariant.create({
            data: { ...data, productId },
            include: variantInclude
        });
        if (priceTiers?.length) {
            await this.prisma.variantPriceTier.createMany({
                data: priceTiers.map((t: any) => ({ ...t, variantId: variant.id }))
            });
        }
        if (variantIngredients?.length) {
            await this.prisma.variantIngredient.createMany({
                data: variantIngredients.map((ing: any) => ({ ...ing, variantId: variant.id }))
            });
        }
        // Catat stok awal jika > 0
        if (Number(data.stock) > 0) {
            await this.prisma.stockMovement.create({
                data: {
                    productVariantId: variant.id,
                    type: 'IN',
                    quantity: Number(data.stock),
                    reason: 'Stok Awal',
                    balanceAfter: Number(data.stock),
                    referenceId: 'initial-stock',
                } as any,
            });
        }
        return this.prisma.productVariant.findUnique({ where: { id: variant.id }, include: variantInclude });
    }

    async updateVariant(variantId: number, variantData: any) {
        const { priceTiers, variantIngredients, ...data } = variantData;
        const oldVariant = await this.prisma.productVariant.findUnique({ where: { id: variantId }, select: { stock: true } });
        await this.prisma.productVariant.update({ where: { id: variantId }, data });
        if (priceTiers !== undefined) {
            await this.replacePriceTiers(variantId, priceTiers);
        }
        if (variantIngredients !== undefined) {
            await this.replaceVariantIngredients(variantId, variantIngredients);
        }
        // Catat pergerakan stok jika ada perubahan stok manual
        if (oldVariant && data.stock !== undefined && Number(data.stock) !== Number(oldVariant.stock)) {
            const newStock = Number(data.stock);
            await this.prisma.stockMovement.create({
                data: {
                    productVariantId: variantId,
                    type: 'ADJUST',
                    quantity: Math.round(Math.abs(newStock - Number(oldVariant.stock)) * 100),
                    reason: 'Penyesuaian Manual',
                    balanceAfter: newStock,
                    referenceId: 'manual-adjust',
                } as any,
            });
        }
        return this.prisma.productVariant.findUnique({ where: { id: variantId }, include: variantInclude });
    }

    async updateVariantImageUrl(variantId: number, variantImageUrl: string) {
        return this.prisma.productVariant.update({ where: { id: variantId }, data: { variantImageUrl } });
    }

    async removeVariant(variantId: number) {
        return this.prisma.productVariant.delete({ where: { id: variantId } });
    }

    // ── Product Ingredient management ───────────────────────────────────────

    async addIngredient(productId: number, ingredientData: any) {
        await this.findOne(productId);
        return this.prisma.ingredient.create({ data: { ...ingredientData, productId } });
    }

    async updateIngredient(ingredientId: number, data: any) {
        return this.prisma.ingredient.update({ where: { id: ingredientId }, data });
    }

    async removeIngredient(ingredientId: number) {
        return this.prisma.ingredient.delete({ where: { id: ingredientId } });
    }

    // ── Variant Price Tiers ─────────────────────────────────────────────────

    async getPriceTiers(variantId: number) {
        return this.prisma.variantPriceTier.findMany({
            where: { variantId },
            orderBy: { minQty: 'asc' }
        });
    }

    async replacePriceTiers(variantId: number, tiers: any[]) {
        await this.prisma.variantPriceTier.deleteMany({ where: { variantId } });
        if (tiers.length > 0) {
            await this.prisma.variantPriceTier.createMany({
                data: tiers.map((t: any) => {
                    const { id: _id, variantId: _vid, ...tierData } = t;
                    return { ...tierData, variantId };
                })
            });
        }
        return this.getPriceTiers(variantId);
    }

    async removePriceTier(tierId: number) {
        return this.prisma.variantPriceTier.delete({ where: { id: tierId } });
    }

    // ── Variant Ingredients ─────────────────────────────────────────────────

    async getVariantIngredients(variantId: number) {
        return this.prisma.variantIngredient.findMany({
            where: { variantId },
            include: { rawMaterialVariant: { include: { product: true } } },
            orderBy: { id: 'asc' }
        });
    }

    async replaceVariantIngredients(variantId: number, ingredients: any[]) {
        await this.prisma.variantIngredient.deleteMany({ where: { variantId } });
        if (ingredients.length > 0) {
            await this.prisma.variantIngredient.createMany({
                data: ingredients.map((ing: any) => {
                    const { id: _id, variantId: _vid, rawMaterialVariant: _rm, ...ingData } = ing;
                    return { ...ingData, variantId };
                })
            });
        }
        return this.getVariantIngredients(variantId);
    }

    async removeVariantIngredient(ingredientId: number) {
        return this.prisma.variantIngredient.delete({ where: { id: ingredientId } });
    }

    // ── Stock History ───────────────────────────────────────────────────────

    async getVariantStockHistory(variantId: number, page = 1, limit = 50) {
        const skip = (page - 1) * limit;
        const [movements, total] = await Promise.all([
            (this.prisma as any).stockMovement.findMany({
                where: { productVariantId: variantId },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
                select: {
                    id: true,
                    type: true,
                    quantity: true,
                    reason: true,
                    balanceAfter: true,
                    referenceId: true,
                    createdAt: true,
                },
            }),
            (this.prisma as any).stockMovement.count({ where: { productVariantId: variantId } }),
        ]);
        return { movements, total, page, limit };
    }
}
