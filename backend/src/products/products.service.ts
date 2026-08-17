import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { BranchContext } from '../common/branch-context.decorator';
import { resolveCompositeQuote } from './composite.util';

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
            where: { isActive: true },   // sembunyikan produk yang diarsipkan (soft-delete)
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

    /**
     * Hitung harga & HPP produk COMPOSITE (produk konfigurasi) dari opsi terpilih.
     * Resolve variant komponen dari DB → panggil resolveCompositeQuote (murni).
     * Dipakai preview POS DAN saat checkout (validasi ulang harga di server —
     * jangan percaya harga dari client).
     */
    async computeComposite(productId: number, selectedOptions: Record<string, any>) {
        const product = await (this.prisma as any).product.findUnique({ where: { id: productId } });
        if (!product) throw new NotFoundException(`Produk ${productId} tidak ditemukan`);
        const config = product.compositeConfig;
        if (product.pricingMode !== 'COMPOSITE' || !config) {
            throw new BadRequestException(`Produk ${productId} bukan produk konfigurasi`);
        }

        // Kumpulkan variantId yang dirujuk komponen (dari opsi variantRef terpilih).
        const variantIds = (config.components ?? [])
            .map((c: any) => Number(selectedOptions[c.variantFrom]))
            .filter((n: number) => Number.isFinite(n) && n > 0);
        const uniqueIds = [...new Set<number>(variantIds)];
        const variants = await (this.prisma as any).productVariant.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true, variantName: true, price: true, hpp: true, product: { select: { name: true } } },
        });
        const variantMap: Record<number, { name: string; price: number; hpp: number }> = {};
        for (const v of variants) {
            const label = `${v.product?.name ?? ''}${v.variantName ? ' — ' + v.variantName : ''}`.trim();
            variantMap[v.id] = { name: label, price: Number(v.price), hpp: Number(v.hpp) };
        }

        const quote = resolveCompositeQuote(config, selectedOptions, variantMap);
        return {
            productId,
            name: quote.name,
            price: Math.round(quote.price),
            hpp: Math.round(quote.hpp),
            breakdown: quote.breakdown,
        };
    }

    /**
     * Resolusi opsi produk COMPOSITE untuk form POS: opsi variantRef diubah jadi
     * daftar pilihan konkret { variantId, label, price } sesuai filter
     * (categoryId / productId / variantNameLike). Opsi select/number diteruskan apa adanya.
     */
    async getCompositeOptions(productId: number) {
        const product = await (this.prisma as any).product.findUnique({ where: { id: productId } });
        if (!product) throw new NotFoundException(`Produk ${productId} tidak ditemukan`);
        const config = product.compositeConfig;
        if (product.pricingMode !== 'COMPOSITE' || !config) {
            throw new BadRequestException(`Produk ${productId} bukan produk konfigurasi`);
        }

        const options: any[] = [];
        for (const opt of config.options ?? []) {
            if (opt.type !== 'variantRef') { options.push(opt); continue; }
            const f = opt.filter ?? {};
            const where: any = { product: { isActive: true } };
            if (f.productId) where.productId = Number(f.productId);
            if (f.categoryId) where.product = { ...where.product, categoryId: Number(f.categoryId) };
            if (f.variantNameLike) where.variantName = { contains: String(f.variantNameLike) };
            const variants = await (this.prisma as any).productVariant.findMany({
                where,
                select: { id: true, variantName: true, price: true, product: { select: { name: true } } },
                orderBy: { id: 'asc' },
            });
            options.push({
                key: opt.key,
                label: opt.label,
                type: 'variantRef',
                choices: variants.map((v: any) => ({
                    variantId: v.id,
                    label: `${v.product?.name ?? ''}${v.variantName ? ' — ' + v.variantName : ''}`.trim(),
                    price: Number(v.price),
                })),
            });
        }
        return { productId, options, nameTemplate: config.nameTemplate ?? '' };
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
        // Bahan baku tidak boleh diakses publik (mis. langsung via URL)
        if (!product || (product as any).productType === 'RAW_MATERIAL') {
            throw new NotFoundException(`Product #${id} not found`);
        }
        return {
            ...product,
            variants: product.variants.map(({ hpp, stock, ...rest }) => rest)
        };
    }

    /**
     * Produk terlaris — ranking berdasarkan total quantity di TransactionItem.
     * Return produk (shape sama seperti findAll) + `soldQty`, urut terbanyak.
     * Publik (dipakai blok landing "Produk Unggulan").
     */
    async bestSellers(limit = 10) {
        const groups: any[] = await (this.prisma as any).transactionItem.groupBy({
            by: ['productVariantId'],
            where: { productVariantId: { not: null } },
            _sum: { quantity: true },
        });
        if (!groups.length) return [];

        const variantIds = groups.map(g => g.productVariantId).filter(Boolean);
        const variants = await this.prisma.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, productId: true },
        });
        const vToP = new Map(variants.map(v => [v.id, v.productId]));

        const prodQty = new Map<number, number>();
        for (const g of groups) {
            const pid = vToP.get(g.productVariantId);
            if (!pid) continue;
            prodQty.set(pid, (prodQty.get(pid) || 0) + Number(g._sum?.quantity || 0));
        }
        const topIds = Array.from(prodQty.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, Math.max(1, limit))
            .map(([id]) => id);
        if (!topIds.length) return [];

        const all = await this.findAllPublicSafe();
        const byId = new Map((all as any[]).map(p => [p.id, p]));
        return topIds
            .map(id => byId.get(id))
            .filter(Boolean)
            .map(p => ({ ...p, soldQty: prodQty.get(p.id) || 0 }));
    }

    /** Buang field sensitif (hpp/modal) dari varian untuk konsumsi publik. */
    private sanitizePublic(products: any[]): any[] {
        return (products || []).map((p) => ({
            ...p,
            variants: (p.variants || []).map((v: any) => {
                const { hpp, aggregateStock, ...rest } = v;
                return rest;
            }),
        }));
    }

    /** Daftar produk untuk publik (tanpa hpp, tanpa bahan baku). */
    async findAllPublicSafe() {
        const all = await this.findAll();
        // Sembunyikan bahan baku (RAW_MATERIAL) — tidak untuk dijual ke umum
        const sellable = (all as any[]).filter((p) => p.productType !== 'RAW_MATERIAL');
        return this.sanitizePublic(sellable);
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
        try {
            // Hard-delete kalau produk belum pernah dipakai (cascade varian & BOM).
            await this.prisma.product.delete({ where: { id } });
            return { id, archived: false, message: 'Produk dihapus.' };
        } catch (e: any) {
            // FK: produk sudah dipakai di transaksi/SO/opname → arsipkan (soft-delete)
            // supaya hilang dari daftar TAPI riwayat penjualan tetap utuh.
            if (e?.code === 'P2003') {
                await (this.prisma as any).product.update({ where: { id }, data: { isActive: false } });
                return { id, archived: true, message: 'Produk sudah pernah dipakai di transaksi/SO, jadi diarsipkan (disembunyikan dari daftar). Riwayat tetap aman.' };
            }
            throw e;
        }
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

        // Enrich dengan transaction info supaya UI bisa tampilkan link nota + customer + badge titipan.
        // Resolve referenceId:
        //   "tx-<invoiceNumber>" → lookup transaction by invoiceNumber
        //   "JOB-<...>"          → lookup ProductionJob → transaction
        //   tx not found         → mark sebagai deleted (info ada di reason snapshot)
        const refs = Array.from(new Set(
            movements
                .map((m: any) => m.referenceId)
                .filter((r: any) => typeof r === 'string' && r.length > 0),
        )) as string[];
        const txInvoices = refs.filter(r => r.startsWith('tx-')).map(r => r.slice(3));
        const jobNumbers = refs.filter(r => r.startsWith('JOB-'));

        const txByInvoice = new Map<string, any>();
        if (txInvoices.length) {
            const txs = await (this.prisma as any).transaction.findMany({
                where: { invoiceNumber: { in: txInvoices } },
                select: {
                    id: true, invoiceNumber: true, checkoutNumber: true, customerName: true,
                    branchId: true, productionBranchId: true,
                    branch: { select: { id: true, name: true, code: true } },
                    productionBranch: { select: { id: true, name: true, code: true } },
                },
            });
            for (const t of txs) txByInvoice.set(t.invoiceNumber, t);
        }
        const txByJob = new Map<string, any>();
        if (jobNumbers.length) {
            const jobs: any[] = await (this.prisma as any).productionJob.findMany({
                where: { jobNumber: { in: jobNumbers } },
                select: {
                    jobNumber: true,
                    transaction: {
                        select: {
                            id: true, invoiceNumber: true, checkoutNumber: true, customerName: true,
                            branchId: true, productionBranchId: true,
                            branch: { select: { id: true, name: true, code: true } },
                            productionBranch: { select: { id: true, name: true, code: true } },
                        },
                    },
                },
            });
            for (const j of jobs) {
                if (j.transaction) txByJob.set(j.jobNumber, j.transaction);
            }
        }

        const enriched = movements.map((m: any) => {
            const ref: string | null = m.referenceId ?? null;
            let tx: any = null;
            let deletedTxInvoice: string | null = null;
            if (ref) {
                if (ref.startsWith('tx-')) {
                    const inv = ref.slice(3);
                    tx = txByInvoice.get(inv) ?? null;
                    if (!tx) deletedTxInvoice = inv;
                } else if (ref.startsWith('JOB-')) {
                    tx = txByJob.get(ref) ?? null;
                }
            }
            if (tx) {
                const isTitipan = tx.productionBranchId != null && tx.productionBranchId !== tx.branchId;
                tx = { ...tx, isTitipan };
            }
            return { ...m, transaction: tx, deletedTxInvoice };
        });

        return { movements: enriched, total, page, limit };
    }
}
