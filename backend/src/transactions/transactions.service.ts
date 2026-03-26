import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod, TransactionStatus, CashflowType } from '@prisma/client';

@Injectable()
export class TransactionsService {
    constructor(private prisma: PrismaService) { }

    async create(data: {
        items: {
            productVariantId: number;
            quantity: number;
            widthCm?: number;
            heightCm?: number;
            unitType?: string;
            note?: string;
        }[];
        paymentMethod: PaymentMethod;
        discount?: number;
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        dueDate?: string;
        downPayment?: number;
        cashierName?: string;
        employeeName?: string;
        bankAccountId?: number;
        productionPriority?: string;
        productionDeadline?: string;
        productionNotes?: string;
    }) {
        return this.prisma.$transaction(async (tx) => {
            const settings = await tx.storeSettings.findFirst();
            const enableTax = settings?.enableTax ?? true;
            const taxRate = settings?.taxRate ? Number(settings.taxRate) : 10;

            let subtotal = 0;
            const transactionItemsData: any[] = [];

            for (const item of data.items) {
                const variant = await tx.productVariant.findUnique({
                    where: { id: item.productVariantId },
                    include: {
                        product: { include: { ingredients: true } },
                        priceTiers: { orderBy: { minQty: 'asc' } },
                        variantIngredients: true
                    }
                });

                if (!variant) throw new NotFoundException(`Variant ID ${item.productVariantId} not found`);

                const pricingMode = (variant.product as any).pricingMode || 'UNIT';
                let lineTotal = 0;
                let widthCm: number | null = null;
                let heightCm: number | null = null;
                let areaCm2: number | null = null;

                const requiresProduction = (variant.product as any).requiresProduction === true;
                const trackStock = (variant.product as any).trackStock !== false;

                // Resolve tier price for UNIT mode
                const priceTiers: any[] = (variant as any).priceTiers || [];
                let resolvedPrice = Number(variant.price);
                if (pricingMode === 'UNIT' && priceTiers.length > 0) {
                    const matchedTier = priceTiers.find((t: any) =>
                        item.quantity >= t.minQty && (t.maxQty === null || item.quantity <= t.maxQty)
                    );
                    if (matchedTier) resolvedPrice = Number(matchedTier.price);
                }

                // Calculate HPP from variant ingredients if defined; fallback to variant.hpp
                const variantIngredients: any[] = (variant as any).variantIngredients || [];
                let resolvedHpp = Number(variant.hpp);
                if (variantIngredients.length > 0) {
                    resolvedHpp = variantIngredients.reduce((sum: number, ing: any) => {
                        return sum + Number(ing.price) * Number(ing.quantity);
                    }, 0);
                }

                if (pricingMode === 'AREA_BASED') {
                    // Area-based calculation depending on unitType
                    if (item.widthCm === undefined) {
                        throw new BadRequestException(`Nilai / Dimensi cetak wajib diisi untuk produk area: ${variant.product.name}`);
                    }
                    widthCm = item.widthCm;
                    heightCm = item.heightCm || 1;

                    // priceMultiplier: raw area in input unit (for price calculation)
                    // areaM2: always in m² (for stock deduction & movement logging)
                    let priceMultiplier = 0;
                    let areaM2 = 0;
                    if (item.unitType === 'm') {
                        priceMultiplier = widthCm * heightCm;
                        areaM2 = widthCm * heightCm;
                    } else if (item.unitType === 'cm') {
                        priceMultiplier = widthCm * heightCm;         // price per cm²
                        areaM2 = (widthCm * heightCm) / 10000;        // convert to m² for stock
                    } else if (item.unitType === 'menit') {
                        priceMultiplier = widthCm;
                        areaM2 = widthCm;
                    } else {
                        priceMultiplier = (widthCm * heightCm) / 10000;
                        areaM2 = (widthCm * heightCm) / 10000;
                    }

                    areaCm2 = areaM2 * 10000;

                    lineTotal = priceMultiplier * resolvedPrice;

                    if (!requiresProduction && trackStock) {
                        const currentStock = Number(variant.stock);
                        if (currentStock < areaM2) {
                            throw new BadRequestException(
                                `Stok bahan ${variant.product.name} tidak cukup. Tersisa: ${currentStock.toFixed(2)} m², dibutuhkan: ${areaM2.toFixed(2)} m²`
                            );
                        }
                        await tx.productVariant.update({
                            where: { id: variant.id },
                            data: { stock: Math.floor((currentStock - areaM2) * 100) / 100 }
                        });
                        await tx.stockMovement.create({
                            data: {
                                productVariantId: variant.id,
                                type: 'OUT',
                                quantity: Math.ceil(areaM2 * 100),
                                reason: `Penjualan Cetak ${widthCm}×${heightCm}cm (${areaM2.toFixed(2)}m²)`
                            }
                        });

                        // Deduct product-level BOM (AREA_BASED)
                        const ingredients = (variant.product as any).ingredients || [];
                        for (const ing of ingredients) {
                            if (ing.rawMaterialVariantId) {
                                const rawVariant = await tx.productVariant.findUnique({ where: { id: ing.rawMaterialVariantId } });
                                if (rawVariant) {
                                    const neededStock = Number(ing.quantity) * areaM2;
                                    await tx.productVariant.update({
                                        where: { id: rawVariant.id },
                                        data: { stock: Math.floor((Number(rawVariant.stock) - neededStock) * 100) / 100 }
                                    });
                                    await tx.stockMovement.create({
                                        data: {
                                            productVariantId: rawVariant.id,
                                            type: 'OUT',
                                            quantity: Math.ceil(neededStock * 100),
                                            reason: `Terpotong oleh Penjualan ${variant.product.name}`
                                        }
                                    });
                                }
                            }
                        }

                        // Deduct variant-level ingredients (AREA_BASED, non-service-cost only)
                        for (const ing of variantIngredients) {
                            if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                                const rawVariant = await tx.productVariant.findUnique({ where: { id: ing.rawMaterialVariantId } });
                                if (rawVariant) {
                                    const neededStock = Number(ing.quantity) * areaM2;
                                    await tx.productVariant.update({
                                        where: { id: rawVariant.id },
                                        data: { stock: Math.floor((Number(rawVariant.stock) - neededStock) * 100) / 100 }
                                    });
                                    await tx.stockMovement.create({
                                        data: {
                                            productVariantId: rawVariant.id,
                                            type: 'OUT',
                                            quantity: Math.ceil(neededStock * 100),
                                            reason: `Terpotong (varian) oleh Penjualan ${variant.product.name}`
                                        }
                                    });
                                }
                            }
                        }
                    }

                    transactionItemsData.push({
                        productVariantId: variant.id,
                        quantity: 1,
                        priceAtTime: lineTotal,
                        hppAtTime: resolvedHpp,
                        widthCm,
                        heightCm,
                        areaCm2,
                        note: item.note || null,
                        _requiresProduction: requiresProduction,
                    });

                } else {
                    // Standard UNIT mode
                    if (trackStock) {
                        if (variant.stock < item.quantity) {
                            throw new BadRequestException(`Stok tidak cukup untuk ${variant.product.name}`);
                        }
                        await tx.productVariant.update({
                            where: { id: variant.id },
                            data: { stock: variant.stock - item.quantity }
                        });
                        await tx.stockMovement.create({
                            data: {
                                productVariantId: variant.id,
                                type: 'OUT',
                                quantity: item.quantity,
                                reason: `Penjualan (Checkout)`
                            }
                        });
                    }

                    lineTotal = resolvedPrice * item.quantity;
                    transactionItemsData.push({
                        productVariantId: variant.id,
                        quantity: item.quantity,
                        priceAtTime: resolvedPrice,
                        hppAtTime: resolvedHpp,
                        note: item.note || null,
                        _requiresProduction: requiresProduction,
                    });

                    // Deduct product-level BOM (UNIT)
                    const ingredients = (variant.product as any).ingredients || [];
                    for (const ing of ingredients) {
                        if (ing.rawMaterialVariantId) {
                            const rawVariant = await tx.productVariant.findUnique({ where: { id: ing.rawMaterialVariantId } });
                            if (rawVariant) {
                                const neededStock = Number(ing.quantity) * item.quantity;
                                await tx.productVariant.update({
                                    where: { id: rawVariant.id },
                                    data: { stock: Math.floor((Number(rawVariant.stock) - neededStock) * 100) / 100 }
                                });
                                await tx.stockMovement.create({
                                    data: {
                                        productVariantId: rawVariant.id,
                                        type: 'OUT',
                                        quantity: Math.ceil(neededStock * 100),
                                        reason: `Terpotong oleh Penjualan ${variant.product.name}`
                                    }
                                });
                            }
                        }
                    }

                    // Deduct variant-level ingredients (UNIT, non-service-cost only)
                    for (const ing of variantIngredients) {
                        if (ing.rawMaterialVariantId && !ing.isServiceCost) {
                            const rawVariant = await tx.productVariant.findUnique({ where: { id: ing.rawMaterialVariantId } });
                            if (rawVariant) {
                                const neededStock = Number(ing.quantity) * item.quantity;
                                await tx.productVariant.update({
                                    where: { id: rawVariant.id },
                                    data: { stock: Math.floor((Number(rawVariant.stock) - neededStock) * 100) / 100 }
                                });
                                await tx.stockMovement.create({
                                    data: {
                                        productVariantId: rawVariant.id,
                                        type: 'OUT',
                                        quantity: Math.ceil(neededStock * 100),
                                        reason: `Terpotong (varian) oleh Penjualan ${variant.product.name}`
                                    }
                                });
                            }
                        }
                    }
                }

                subtotal += lineTotal;
            }

            const discountAmount = data.discount || 0;
            const amountAfterDiscount = subtotal - discountAmount;

            let taxAmount = 0;
            if (enableTax) {
                taxAmount = amountAfterDiscount * (taxRate / 100);
            }

            const grandTotal = amountAfterDiscount + taxAmount;
            const downPayment = data.downPayment !== undefined ? data.downPayment : grandTotal;
            const status = downPayment < grandTotal ? TransactionStatus.PARTIAL : TransactionStatus.PAID;

            const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const count = await tx.transaction.count({
                where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
            });
            const invoiceNumber = `INV-${dateStr}-${(count + 1).toString().padStart(4, '0')}`;

            // Strip internal flags before creating items
            const itemsForCreate = transactionItemsData.map(({ _requiresProduction, ...rest }: any) => rest);

            const transaction = await tx.transaction.create({
                data: {
                    invoiceNumber,
                    totalAmount: subtotal,
                    discount: discountAmount,
                    tax: taxAmount,
                    grandTotal,
                    paymentMethod: data.paymentMethod,
                    status: status,
                    customerName: data.customerName || null,
                    customerPhone: data.customerPhone || null,
                    customerAddress: data.customerAddress || null,
                    dueDate: data.dueDate ? new Date(data.dueDate) : null,
                    downPayment: downPayment,
                    cashierName: data.cashierName || null,
                    employeeName: data.employeeName || null,
                    bankAccountId: data.bankAccountId || null,
                    productionPriority: data.productionPriority || 'NORMAL',
                    productionDeadline: data.productionDeadline ? new Date(data.productionDeadline) : null,
                    productionNotes: data.productionNotes || null,
                    items: { create: itemsForCreate }
                },
                include: { items: true, bankAccount: true }
            } as any);

            // Create ProductionJob for items that require production
            const hasProductionItems = transactionItemsData.some((d: any) => d._requiresProduction);
            let jobSeq = hasProductionItems ? await (tx as any).productionJob.count() : 0;
            for (let i = 0; i < transactionItemsData.length; i++) {
                if (transactionItemsData[i]._requiresProduction) {
                    jobSeq++;
                    const txItem = (transaction as any).items[i];
                    const jobDateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
                    await (tx as any).productionJob.create({
                        data: {
                            jobNumber: `JOB-${jobDateStr}-${String(jobSeq).padStart(4, '0')}`,
                            transactionId: transaction.id,
                            transactionItemId: txItem.id,
                            status: 'ANTRIAN',
                            priority: data.productionPriority || 'NORMAL',
                            deadline: data.productionDeadline ? new Date(data.productionDeadline) : null,
                            notes: data.productionNotes || null,
                        },
                    });
                }
            }

            // Log initial payment into Cashflow
            if (downPayment > 0) {
                const customerInfo = data.customerName ? ` untuk Bpk/Ibu ${data.customerName}` : '';
                await tx.cashflow.create({
                    data: {
                        type: CashflowType.INCOME,
                        category: status === TransactionStatus.PARTIAL ? 'Pembayaran DP' : 'Penjualan Lunas',
                        amount: downPayment,
                        paymentMethod: data.paymentMethod,
                        bankAccountId: data.bankAccountId || null,
                        note: `Pembayaran Invoice ${invoiceNumber}${customerInfo} via ${data.paymentMethod}`,
                    }
                });
            }

            return transaction;
        });
    }

    async findAll() {
        return this.prisma.transaction.findMany({
            include: {
                items: {
                    include: { productVariant: { include: { product: true } } }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
    }

    async findOne(id: number) {
        const transaction = await this.prisma.transaction.findUnique({
            where: { id },
            include: {
                items: {
                    include: { productVariant: { include: { product: true } } }
                }
            }
        });
        if (!transaction) throw new NotFoundException('Transaction not found');
        return transaction;
    }

    async payOff(id: number, data: { paymentMethod: PaymentMethod, bankAccountId?: number }) {
        return this.prisma.$transaction(async (tx) => {
            const transaction = await tx.transaction.findUnique({ where: { id } });
            if (!transaction) throw new NotFoundException('Transaction not found');
            if (transaction.status === TransactionStatus.PAID) throw new BadRequestException('Transaction is already paid off');
            if (transaction.status !== TransactionStatus.PARTIAL) throw new BadRequestException('Transaction is not in PARTIAL state');

            const remainingBalance = Number(transaction.grandTotal) - Number(transaction.downPayment);

            if (remainingBalance > 0) {
                // Determine the name to log in cashflow
                const customerInfo = transaction.customerName ? ` untuk Bpk/Ibu ${transaction.customerName}` : '';
                await tx.cashflow.create({
                    data: {
                        type: CashflowType.INCOME,
                        category: 'Pelunasan DP',
                        amount: remainingBalance,
                        paymentMethod: data.paymentMethod,
                        bankAccountId: data.bankAccountId || null,
                        note: `Pelunasan Invoice ${transaction.invoiceNumber}${customerInfo} via ${data.paymentMethod}`,
                    }
                });
            }

            return tx.transaction.update({
                where: { id },
                data: {
                    status: TransactionStatus.PAID,
                    downPayment: transaction.grandTotal, // fully paid
                    paymentMethod: data.paymentMethod // overwrite or keep original? Usually we reflect the final method, or we could just leave original. Let's update paymentMethod to the latest payoff method.
                }
            });
        });
    }

    async getSummaryReport(startDate?: string, endDate?: string) {
        const whereClause: any = { status: TransactionStatus.PAID };
        if (startDate && endDate) {
            whereClause.createdAt = {
                gte: new Date(startDate),
                lte: new Date(endDate + 'T23:59:59.999Z')
            };
        }
        const transactions = await this.prisma.transaction.findMany({
            where: whereClause,
            include: {
                items: { include: { productVariant: { include: { product: true } } } },
                bankAccount: true
            }
        });

        let totalRevenue = 0;
        const totalTransactions = transactions.length;
        const paymentMethodsCount: Record<string, number> = { CASH: 0, QRIS: 0, BANK_TRANSFER: 0 };
        const paymentMethodsRevenue: Record<string, number> = { CASH: 0, QRIS: 0, BANK_TRANSFER: 0 };
        const bankTransfersRevenue: Record<string, number> = {};
        const itemSales: Record<number, { name: string, sku: string, qty: number, revenue: number }> = {};

        for (const t of transactions) {
            totalRevenue += Number(t.grandTotal);
            paymentMethodsCount[t.paymentMethod] = (paymentMethodsCount[t.paymentMethod] || 0) + 1;
            paymentMethodsRevenue[t.paymentMethod] = (paymentMethodsRevenue[t.paymentMethod] || 0) + Number(t.grandTotal);

            if (t.paymentMethod === 'BANK_TRANSFER' && t.bankAccount) {
                const bankName = t.bankAccount.bankName;
                bankTransfersRevenue[bankName] = (bankTransfersRevenue[bankName] || 0) + Number(t.grandTotal);
            }

            for (const item of t.items) {
                const variantId = item.productVariantId;
                if (!itemSales[variantId]) {
                    itemSales[variantId] = {
                        name: item.productVariant.product.name,
                        sku: item.productVariant.sku,
                        qty: 0,
                        revenue: 0,
                    };
                }
                itemSales[variantId].qty += item.quantity;
                itemSales[variantId].revenue += Number(item.priceAtTime) * item.quantity;
            }
        }

        return {
            totalRevenue,
            totalTransactions,
            averageTransactionValue: totalTransactions > 0 ? totalRevenue / totalTransactions : 0,
            paymentMethods: paymentMethodsCount,
            paymentMethodsRevenue,
            bankTransfersRevenue,
            topSellingItems: Object.values(itemSales).sort((a, b) => b.qty - a.qty).slice(0, 5)
        };
    }

    async getChartData(period: string = 'daily') {
        const now = new Date();
        const data: { label: string; total: number }[] = [];

        if (period === 'daily') {
            // Last 7 days, per day
            const start = new Date(now);
            start.setDate(start.getDate() - 6);
            start.setHours(0, 0, 0, 0);
            const txs = await this.prisma.transaction.findMany({
                where: { createdAt: { gte: start }, status: TransactionStatus.PAID },
                select: { createdAt: true, grandTotal: true }
            });
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dateStr = d.toISOString().split('T')[0];
                const total = txs
                    .filter(t => t.createdAt?.toISOString().split('T')[0] === dateStr)
                    .reduce((sum, t) => sum + Number(t.grandTotal), 0);
                data.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, total });
            }
        } else if (period === 'weekly') {
            // Last 8 weeks, per week
            for (let i = 7; i >= 0; i--) {
                const weekEnd = new Date(now);
                weekEnd.setDate(weekEnd.getDate() - i * 7);
                weekEnd.setHours(23, 59, 59, 999);
                const weekStart = new Date(weekEnd);
                weekStart.setDate(weekStart.getDate() - 6);
                weekStart.setHours(0, 0, 0, 0);
                const result = await this.prisma.transaction.aggregate({
                    where: { createdAt: { gte: weekStart, lte: weekEnd }, status: TransactionStatus.PAID },
                    _sum: { grandTotal: true }
                });
                const d = weekStart.getDate();
                const m = weekStart.getMonth() + 1;
                data.push({ label: `${d}/${m}`, total: Number(result._sum.grandTotal || 0) });
            }
        } else if (period === 'monthly') {
            // Last 12 months, per month
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
            for (let i = 11; i >= 0; i--) {
                const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
                const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
                const result = await this.prisma.transaction.aggregate({
                    where: { createdAt: { gte: monthStart, lte: monthEnd }, status: TransactionStatus.PAID },
                    _sum: { grandTotal: true }
                });
                data.push({ label: `${monthNames[d.getMonth()]} '${String(d.getFullYear()).slice(2)}`, total: Number(result._sum.grandTotal || 0) });
            }
        } else if (period === 'yearly') {
            // Last 5 years, per year
            for (let i = 4; i >= 0; i--) {
                const year = now.getFullYear() - i;
                const yearStart = new Date(year, 0, 1);
                const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
                const result = await this.prisma.transaction.aggregate({
                    where: { createdAt: { gte: yearStart, lte: yearEnd }, status: TransactionStatus.PAID },
                    _sum: { grandTotal: true }
                });
                data.push({ label: String(year), total: Number(result._sum.grandTotal || 0) });
            }
        }

        return data;
    }

    async getDashboardMetrics() {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        const [todayTransactions, yesterdayTransactions, todayCashflow, yesterdayCashflow, lowStockItems] =
            await Promise.all([
                this.prisma.transaction.aggregate({ where: { createdAt: { gte: todayStart }, status: TransactionStatus.PAID }, _sum: { grandTotal: true }, _count: { id: true } }),
                this.prisma.transaction.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, status: TransactionStatus.PAID }, _sum: { grandTotal: true }, _count: { id: true } }),
                this.prisma.cashflow.aggregate({ where: { createdAt: { gte: todayStart }, type: CashflowType.INCOME }, _sum: { amount: true } }),
                this.prisma.cashflow.aggregate({ where: { createdAt: { gte: yesterdayStart, lt: todayStart }, type: CashflowType.INCOME }, _sum: { amount: true } }),
                this.prisma.productVariant.findMany({ where: { stock: { lte: 10 }, product: { trackStock: true } }, include: { product: true }, orderBy: { stock: 'asc' }, take: 5 })
            ]);

        // Get last 7 days sales for chart
        const sevenDaysAgo = new Date(todayStart);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

        const recentTx = await this.prisma.transaction.findMany({
            where: { createdAt: { gte: sevenDaysAgo }, status: TransactionStatus.PAID },
            select: { createdAt: true, grandTotal: true }
        });

        // Group by Date for Chart
        const salesChartData: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
            const d = new Date(sevenDaysAgo);
            d.setDate(d.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            salesChartData[dateStr] = 0;
        }

        recentTx.forEach(tx => {
            if (tx.createdAt) {
                const dateStr = `${tx.createdAt.getFullYear()}-${String(tx.createdAt.getMonth() + 1).padStart(2, '0')}-${String(tx.createdAt.getDate()).padStart(2, '0')}`;
                if (salesChartData[dateStr] !== undefined) {
                    salesChartData[dateStr] += Number(tx.grandTotal);
                }
            }
        });

        const salesChart = Object.keys(salesChartData).map(date => ({
            date,
            total: salesChartData[date]
        }));

        const todaySales = Number(todayTransactions._sum.grandTotal || 0);
        const yesterdaySales = Number(yesterdayTransactions._sum.grandTotal || 0);
        const salesTrend = yesterdaySales === 0 ? 100 : ((todaySales - yesterdaySales) / yesterdaySales) * 100;
        const todayTxCount = todayTransactions._count.id;
        const yesterdayTxCount = yesterdayTransactions._count.id;
        const txTrend = yesterdayTxCount === 0 ? 100 : ((todayTxCount - yesterdayTxCount) / yesterdayTxCount) * 100;
        const todayCashIn = Number(todayCashflow?._sum?.amount || 0);
        const yesterdayCashIn = Number(yesterdayCashflow?._sum?.amount || 0);
        const cashTrend = yesterdayCashIn === 0 ? 100 : ((todayCashIn - yesterdayCashIn) / yesterdayCashIn) * 100;
        const lowStockCount = await this.prisma.productVariant.count({ where: { stock: { lte: 10 }, product: { trackStock: true } } });

        return {
            sales: { value: todaySales, trend: `${salesTrend > 0 ? '+' : ''}${salesTrend.toFixed(1)}%`, trendUp: salesTrend >= 0 },
            transactions: { value: todayTxCount, trend: `${txTrend > 0 ? '+' : ''}${txTrend.toFixed(1)}%`, trendUp: txTrend >= 0 },
            cashflow: { value: todayCashIn, trend: `${cashTrend > 0 ? '+' : ''}${cashTrend.toFixed(1)}%`, trendUp: cashTrend >= 0 },
            alerts: { count: lowStockCount, items: lowStockItems.map(item => ({ name: `${item.product.name} ${item.size ? `(${item.size})` : ''}`.trim(), stock: item.stock, limit: 10 })) },
            salesChart
        };
    }
}
