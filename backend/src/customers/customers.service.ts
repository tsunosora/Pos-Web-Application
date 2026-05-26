import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
    constructor(private readonly prisma: PrismaService) { }

    async create(data: { name: string; phone?: string; address?: string }) {
        return this.prisma.customer.create({ data });
    }

    /**
     * Lookup customer by phone (untuk dedup di CRM Lead create).
     *
     * Strategi: query SEMUA customer yang punya phone, lalu normalize di JS
     * supaya matching tidak gagal karena format berbeda di DB (mis. "+62 812-3456-7890"
     * vs input "08123456789"). Untuk toko dengan <10k customer ini cukup cepat.
     *
     * Match rules (case-insensitive, urutan prioritas):
     *   1. Exact match normalized (62812... === 62812...)
     *   2. Last-8-digit match (tail nomor sama — biar match walau kode negara beda)
     */
    async lookupByPhone(phoneRaw: string): Promise<any[]> {
        const inputNorm = String(phoneRaw || '').replace(/\D/g, '');
        if (!inputNorm || inputNorm.length < 4) return [];

        // Bentuk variants input untuk exact match (0xxx ↔ 62xxx)
        const inputCanonical = this.canonicalPhone(inputNorm);
        const inputLast8 = inputNorm.slice(-8);

        const all = await this.prisma.customer.findMany({
            where: { phone: { not: null } },
            select: { id: true, name: true, phone: true, address: true },
        });

        // Score & rank: 2 = exact canonical, 1 = last-8 match
        type Scored = { c: any; score: number };
        const scored: Scored[] = [];
        for (const c of all) {
            const dbNorm = String(c.phone || '').replace(/\D/g, '');
            if (!dbNorm) continue;
            const dbCanon = this.canonicalPhone(dbNorm);
            if (dbCanon === inputCanonical) { scored.push({ c, score: 2 }); continue; }
            if (inputLast8.length >= 8 && dbNorm.endsWith(inputLast8)) { scored.push({ c, score: 1 }); continue; }
            // Reverse: input bisa lebih pendek dari yang di DB
            if (dbNorm.length >= 8 && inputNorm.endsWith(dbNorm.slice(-8))) { scored.push({ c, score: 1 }); }
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, 5).map(s => s.c);
    }

    /** Normalize phone to canonical form: strip leading 62 atau 0, hanya digit. */
    private canonicalPhone(digits: string): string {
        let s = digits;
        if (s.startsWith('62')) s = s.slice(2);
        if (s.startsWith('0')) s = s.slice(1);
        return s;
    }

    async findAll() {
        return this.prisma.customer.findMany({ orderBy: { name: 'asc' } });
    }

    async findAllWithStats() {
        const customers = await this.prisma.customer.findMany({ orderBy: { name: 'asc' } });

        const phones = customers.filter(c => c.phone).map(c => c.phone!);
        const noPhoneNames = customers.filter(c => !c.phone).map(c => c.name);

        const orClause: any[] = [];
        if (phones.length > 0) orClause.push({ customerPhone: { in: phones } });
        if (noPhoneNames.length > 0) orClause.push({ customerName: { in: noPhoneNames }, customerPhone: null });

        const transactions = orClause.length > 0
            ? await this.prisma.transaction.findMany({
                where: { status: { in: ['PAID', 'PARTIAL'] }, OR: orClause },
                select: { customerPhone: true, customerName: true, downPayment: true, createdAt: true },
            })
            : [];

        return customers.map(c => {
            const matching = transactions.filter(t =>
                (c.phone && t.customerPhone === c.phone) ||
                (!c.phone && t.customerName === c.name)
            );
            const sorted = matching.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
            return {
                ...c,
                totalOrders: matching.length,
                totalRevenue: matching.reduce((sum, t) => sum + Number(t.downPayment), 0),
                lastOrderDate: sorted[0]?.createdAt ?? null,
            };
        });
    }

    async getAnalytics(id: number) {
        const customer = await this.prisma.customer.findUnique({ where: { id } });
        if (!customer) throw new NotFoundException('Customer not found');

        const where: any = { status: { in: ['PAID', 'PARTIAL'] } };
        if (customer.phone) where.customerPhone = customer.phone;
        else where.customerName = customer.name;

        const transactions = await this.prisma.transaction.findMany({
            where,
            include: {
                items: { include: { productVariant: { include: { product: true } } } },
            },
            orderBy: { createdAt: 'desc' },
        });

        const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.downPayment), 0);
        const totalOrders = transactions.length;
        const lastOrderDate = transactions[0]?.createdAt ?? null;

        // Top products by order frequency
        const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
        for (const t of transactions) {
            for (const item of t.items) {
                if (!item.productVariant) continue;
                const name = item.productVariant.product.name;
                if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
                productMap[name].qty += item.quantity;
                productMap[name].revenue += Number(item.priceAtTime);
            }
        }
        const topProducts = Object.values(productMap).sort((a, b) => b.qty - a.qty).slice(0, 8);

        // Monthly spend last 6 months
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'];
        const now = new Date();
        const monthlySpend = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
            const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
            const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
            const total = transactions
                .filter(t => t.createdAt && t.createdAt >= monthStart && t.createdAt <= monthEnd)
                .reduce((sum, t) => sum + Number(t.downPayment), 0);
            return { month: monthNames[d.getMonth()], total };
        });

        const recentTransactions = transactions.slice(0, 10).map(t => ({
            id: t.id,
            invoiceNumber: t.invoiceNumber,
            grandTotal: Number(t.grandTotal),
            downPayment: Number(t.downPayment),
            status: t.status,
            paymentMethod: t.paymentMethod,
            createdAt: t.createdAt,
            itemCount: t.items.length,
            items: t.items.map(i => i.productVariant?.product.name ?? (i as any).customName ?? 'Item Custom'),
        }));

        return { customer, totalRevenue, totalOrders, lastOrderDate, topProducts, monthlySpend, recentTransactions };
    }

    async findAllForExport() {
        const customers = await this.prisma.customer.findMany({ orderBy: { name: 'asc' } });

        const phones = customers.filter(c => c.phone).map(c => c.phone!);
        const noPhoneNames = customers.filter(c => !c.phone).map(c => c.name);

        const orClause: any[] = [];
        if (phones.length > 0) orClause.push({ customerPhone: { in: phones } });
        if (noPhoneNames.length > 0) orClause.push({ customerName: { in: noPhoneNames }, customerPhone: null });

        const transactions = orClause.length > 0
            ? await this.prisma.transaction.findMany({
                where: { status: { in: ['PAID', 'PARTIAL'] }, OR: orClause },
                include: { items: { include: { productVariant: { include: { product: true } } } } },
                orderBy: { createdAt: 'desc' },
            })
            : [];

        return customers.map(c => {
            const matching = transactions.filter(t =>
                (c.phone && t.customerPhone === c.phone) ||
                (!c.phone && t.customerName === c.name)
            );

            const totalRevenue = matching.reduce((sum, t) => sum + Number(t.downPayment), 0);
            const totalOrders = matching.length;
            const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
            const lastOrderDate = matching[0]?.createdAt ?? null;

            // Top products
            const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};
            for (const t of matching) {
                for (const item of t.items) {
                    if (!item.productVariant) continue;
                    const name = item.productVariant.product.name;
                    if (!productMap[name]) productMap[name] = { name, qty: 0, revenue: 0 };
                    productMap[name].qty += item.quantity;
                    productMap[name].revenue += Number(item.priceAtTime);
                }
            }
            const topProducts = Object.values(productMap)
                .sort((a, b) => b.qty - a.qty)
                .slice(0, 5);

            // Payment method preference
            const methodCount: Record<string, number> = {};
            for (const t of matching) {
                methodCount[t.paymentMethod] = (methodCount[t.paymentMethod] ?? 0) + 1;
            }
            const preferredPayment = Object.entries(methodCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

            return {
                ...c,
                totalOrders,
                totalRevenue,
                avgOrder,
                lastOrderDate,
                topProducts,
                preferredPayment,
            };
        });
    }

    async update(id: number, data: {
        name?: string;
        phone?: string;
        address?: string;
        assignedCsId?: number | null;
        tags?: any;
    }) {
        // assignedCsId & tags adalah field CRM yang baru — biarkan Prisma yang validate.
        return this.prisma.customer.update({ where: { id }, data: data as any });
    }

    /** Timeline CRM untuk customer: activities + follow-ups + assigned CS. */
    async getCrmTimeline(id: number) {
        const customer = await (this.prisma as any).customer.findUnique({
            where: { id },
            include: {
                assignedCs: { select: { id: true, name: true, email: true } },
            },
        });
        if (!customer) throw new NotFoundException('Customer not found');

        const [activities, followUps] = await Promise.all([
            (this.prisma as any).leadActivity.findMany({
                where: { customerId: id },
                orderBy: { createdAt: 'desc' },
                take: 100,
                include: { createdBy: { select: { id: true, name: true } } },
            }),
            (this.prisma as any).followUp.findMany({
                where: { customerId: id },
                orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
                include: {
                    assignedTo: { select: { id: true, name: true, email: true } },
                    template: { select: { id: true, name: true } },
                },
            }),
        ]);

        return {
            customer: {
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                leadSource: customer.leadSource ?? null,
                assignedCs: customer.assignedCs ?? null,
                tags: customer.tags ?? null,
            },
            activities,
            followUps,
        };
    }

    async remove(id: number) {
        return this.prisma.customer.delete({ where: { id } });
    }
}
