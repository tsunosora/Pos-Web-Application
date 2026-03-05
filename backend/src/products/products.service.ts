import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
    constructor(private prisma: PrismaService) { }

    async create(data: any) {
        const { variants, ingredients, ...productData } = data;
        return this.prisma.product.create({
            data: {
                ...productData,
                variants: {
                    create: variants || []
                },
                ingredients: {
                    create: ingredients || []
                }
            },
            include: {
                category: true,
                unit: true,
                variants: true,
                ingredients: true
            }
        });
    }

    async findAll() {
        return this.prisma.product.findMany({
            include: {
                category: true,
                unit: true,
                variants: true,
                ingredients: true
            }
        });
    }

    async findOne(id: number) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                unit: true,
                variants: true,
                ingredients: true
            }
        });
        if (!product) throw new NotFoundException(`Product #${id} not found`);
        return product;
    }

    async update(id: number, data: any) {
        await this.findOne(id);
        const { variants, ingredients, ...productData } = data;

        // Update basic product data
        await this.prisma.product.update({
            where: { id },
            data: productData,
        });

        // Upsert variants if provided
        if (variants) {
            for (const v of variants) {
                if (v.id) {
                    const { id: variantId, ...variantData } = v;
                    await this.prisma.productVariant.update({
                        where: { id: variantId },
                        data: variantData
                    });
                } else {
                    await this.prisma.productVariant.create({
                        data: { ...v, productId: id }
                    });
                }
            }
        }

        // Replace ingredients if provided
        if (ingredients !== undefined) {
            await this.prisma.ingredient.deleteMany({ where: { productId: id } });
            if (ingredients.length > 0) {
                await this.prisma.ingredient.createMany({
                    data: ingredients.map((ing: any) => ({ ...ing, productId: id }))
                });
            }
        }

        return this.findOne(id);
    }

    async updateImageUrl(id: number, imageUrl: string) {
        await this.findOne(id);
        return this.prisma.product.update({
            where: { id },
            data: { imageUrl }
        });
    }

    async updateImageUrls(id: number, imageUrls: string[]) {
        await this.findOne(id);
        return this.prisma.product.update({
            where: { id },
            data: { imageUrls: JSON.stringify(imageUrls) }
        });
    }

    async remove(id: number) {
        await this.findOne(id);
        return this.prisma.product.delete({ where: { id } });
    }

    // Variant management
    async addVariant(productId: number, variantData: any) {
        await this.findOne(productId);
        return this.prisma.productVariant.create({
            data: { ...variantData, productId }
        });
    }

    async updateVariant(variantId: number, variantData: any) {
        return this.prisma.productVariant.update({
            where: { id: variantId },
            data: variantData
        });
    }

    async updateVariantImageUrl(variantId: number, variantImageUrl: string) {
        return this.prisma.productVariant.update({
            where: { id: variantId },
            data: { variantImageUrl }
        });
    }

    async removeVariant(variantId: number) {
        return this.prisma.productVariant.delete({ where: { id: variantId } });
    }

    // Ingredient management
    async addIngredient(productId: number, ingredientData: any) {
        await this.findOne(productId);
        return this.prisma.ingredient.create({
            data: { ...ingredientData, productId }
        });
    }

    async updateIngredient(ingredientId: number, data: any) {
        return this.prisma.ingredient.update({
            where: { id: ingredientId },
            data
        });
    }

    async removeIngredient(ingredientId: number) {
        return this.prisma.ingredient.delete({ where: { id: ingredientId } });
    }
}
