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
    }) {
        console.log("PAYLOAD RECEIVED:", data);
        return this.prisma.$transaction(async (tx) => {
            const settings = await tx.storeSettings.findFirst();
            const enableTax = settings?.enableTax ?? true;
            const taxRate = settings?.taxRate ? Number(settings.taxRate) : 10;

            let subtotal = 0;
            const transactionItemsData: any[] = [];

            for (const item of data.items) {
                const variant = await tx.productVariant.findUnique({
                    where: { id: item.productVariantId },
                    include: { product: true }
                });

                if (!variant) throw new NotFoundException(`Variant ID ${item.productVariantId} not found`);

                const pricingMode = (variant.product as any).pricingMode || 'UNIT';
                let lineTotal = 0;
                let stockToDeduct = item.quantity;
                let widthCm: number | null = null;
                let heightCm: number | null = null;
                let areaCm2: number | null = null;

                if (pricingMode === 'AREA_BASED') {
                    // Area-based calculation depending on unitType
                    if (item.widthCm === undefined) {
                        throw new BadRequestException(`Nilai / Dimensi cetak wajib diisi untuk produk area: ${variant.product.name}`);
                    }
                    widthCm = item.widthCm;
                    heightCm = item.heightCm || 1;

                    let areaM2 = 0;
                    if (item.unitType === 'm') areaM2 = widthCm * heightCm;
                    else if (item.unitType === 'cm') areaM2 = (widthCm * heightCm) / 10000;
                    else if (item.unitType === 'menit') areaM2 = widthCm;
                    else areaM2 = (widthCm * heightCm) / 10000; // fallback to cm

                    areaCm2 = areaM2 * 10000;

                    const pricePerM2 = Number(variant.price);
                    lineTotal = areaM2 * pricePerM2;
                    // Stock is in m²: deduct area used
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
                    transactionItemsData.push({
                        productVariantId: variant.id,
                        quantity: 1,
                        priceAtTime: lineTotal,
                        widthCm,
                        heightCm,
                        areaCm2,
                        note: item.note || null
                    });

                } else {
                    // Standard UNIT mode
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
                    lineTotal = Number(variant.price) * item.quantity;
                    transactionItemsData.push({
                        productVariantId: variant.id,
                        quantity: item.quantity,
                        priceAtTime: variant.price,
                        note: item.note || null
                    });
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
                    items: { create: transactionItemsData }
                },
                include: { items: true, bankAccount: true }
            });

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
                this.prisma.productVariant.findMany({ where: { stock: { lte: 10 } }, include: { product: true }, orderBy: { stock: 'asc' }, take: 5 })
            ]);

        const todaySales = Number(todayTransactions._sum.grandTotal || 0);
        const yesterdaySales = Number(yesterdayTransactions._sum.grandTotal || 0);
        const salesTrend = yesterdaySales === 0 ? 100 : ((todaySales - yesterdaySales) / yesterdaySales) * 100;
        const todayTxCount = todayTransactions._count.id;
        const yesterdayTxCount = yesterdayTransactions._count.id;
        const txTrend = yesterdayTxCount === 0 ? 100 : ((todayTxCount - yesterdayTxCount) / yesterdayTxCount) * 100;
        const todayCashIn = Number(todayCashflow?._sum?.amount || 0);
        const yesterdayCashIn = Number(yesterdayCashflow?._sum?.amount || 0);
        const cashTrend = yesterdayCashIn === 0 ? 100 : ((todayCashIn - yesterdayCashIn) / yesterdayCashIn) * 100;
        const lowStockCount = await this.prisma.productVariant.count({ where: { stock: { lte: 10 } } });

        return {
            sales: { value: todaySales, trend: `${salesTrend > 0 ? '+' : ''}${salesTrend.toFixed(1)}%`, trendUp: salesTrend >= 0 },
            transactions: { value: todayTxCount, trend: `${txTrend > 0 ? '+' : ''}${txTrend.toFixed(1)}%`, trendUp: txTrend >= 0 },
            cashflow: { value: todayCashIn, trend: `${cashTrend > 0 ? '+' : ''}${cashTrend.toFixed(1)}%`, trendUp: cashTrend >= 0 },
            alerts: { count: lowStockCount, items: lowStockItems.map(item => ({ name: `${item.product.name} ${item.size ? `(${item.size})` : ''}`.trim(), stock: item.stock, limit: 10 })) }
        };
    }
}
