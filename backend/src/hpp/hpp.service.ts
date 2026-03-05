import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HppService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return this.prisma.hppWorksheet.findMany({
            include: {
                variableCosts: {
                    include: { productVariant: { include: { product: { include: { unit: true } } } } }
                },
                fixedCosts: true,
            },
            orderBy: { updatedAt: 'desc' }
        });
    }

    async findOne(id: number) {
        const worksheet = await this.prisma.hppWorksheet.findUnique({
            where: { id },
            include: {
                variableCosts: {
                    include: { productVariant: { include: { product: { include: { unit: true } } } } }
                },
                fixedCosts: true,
            }
        });
        if (!worksheet) throw new NotFoundException('Worksheet not found');
        return worksheet;
    }

    async create(data: any) {
        return this.prisma.hppWorksheet.create({
            data: {
                productName: data.productName,
                targetVolume: data.targetVolume,
                targetMargin: data.targetMargin,
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
            include: { variableCosts: true, fixedCosts: true }
        });
    }

    async update(id: number, data: any) {
        // Drop existing elements for easy fully replacement
        await this.prisma.hppVariableCost.deleteMany({ where: { worksheetId: id } });
        await this.prisma.hppFixedCost.deleteMany({ where: { worksheetId: id } });

        return this.prisma.hppWorksheet.update({
            where: { id },
            data: {
                productName: data.productName,
                targetVolume: data.targetVolume,
                targetMargin: data.targetMargin,
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
            include: { variableCosts: true, fixedCosts: true }
        });
    }

    async remove(id: number) {
        return this.prisma.hppWorksheet.delete({
            where: { id }
        });
    }
}
