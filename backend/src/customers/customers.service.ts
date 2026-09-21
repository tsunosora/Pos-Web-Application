import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toWaPhone, phoneKey, maskPhone } from '../common/utils/phone.util';
import { lineTotalOf } from '../transactions/area-unit.util';

/**
 * Nilai belanja satu nota. Nota LUNAS = total nota; nota DP = uang yang sudah diterima.
 * `downPayment` nota lunas menyimpan DP awal saja (0 bila lunas sekali bayar) — dulu dijumlah
 * mentah sehingga "Total Belanja" pelanggan kurang ±Rp 440 jt di produksi.
 */
const nilaiNota = (t: { status?: unknown; grandTotal?: unknown; downPayment?: unknown }) =>
    Number(t.status === 'PAID' ? t.grandTotal : t.downPayment) || 0;

@Injectable()
export class CustomersService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Buat customer — nomor HP dinormalkan ke 628xxx, dan dedup by nomor:
     * kalau sudah ada customer dengan nomor sama, kembalikan yang itu (tidak bikin dobel).
     */
    async create(data: { name: string; phone?: string; address?: string }) {
        const phone = toWaPhone(data.phone);
        if (phone) {
            const existing = await this.prisma.customer.findFirst({ where: { phone } });
            if (existing) {
                // lengkapi field kosong dari input (nama/alamat) tanpa menimpa yang sudah ada
                const patch: any = {};
                if (!existing.address && data.address?.trim()) patch.address = data.address.trim();
                if (Object.keys(patch).length) {
                    return this.prisma.customer.update({ where: { id: existing.id }, data: patch });
                }
                return existing;
            }
        }
        return this.prisma.customer.create({
            data: { name: data.name, phone, address: data.address ?? null },
        });
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

    /** Cari customer berdasarkan nama (untuk auto-picker saat input data customer). */
    async searchByName(nameRaw: string): Promise<any[]> {
        const q = String(nameRaw || '').trim();
        if (q.length < 2) return [];
        return this.prisma.customer.findMany({
            where: { name: { contains: q } },
            select: { id: true, name: true, phone: true, address: true },
            orderBy: { name: 'asc' },
            take: 8,
        });
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

    /**
     * Cari customer untuk portal desainer (tanpa JWT, sudah lolos PIN): minimal 3 huruf,
     * maks 20 baris, HP disamarkan, alamat tidak pernah dikirim.
     */
    async searchPublic(qRaw: string): Promise<{ id: number; name: string; phone: string | null }[]> {
        const q = String(qRaw ?? '').trim().slice(0, 60);
        if (q.length < 3) return [];
        const or: any[] = [{ name: { contains: q } }];
        // Cari per nomor hanya bila yang diketik memang nomor (≥ 6 digit).
        const digits = q.replace(/\D/g, '');
        if (digits.length >= 6 && !/[a-z]/i.test(q)) {
            or.push({ phone: { contains: this.canonicalPhone(digits) } });
        }
        const rows = await this.prisma.customer.findMany({
            where: { OR: or },
            select: { id: true, name: true, phone: true },
            orderBy: { name: 'asc' },
            take: 20,
        });
        return rows.map((c) => ({ id: c.id, name: c.name, phone: maskPhone(c.phone) }));
    }

    /** Variasi format nomor untuk query transaksi yang mungkin belum dinormalkan. */
    private phoneVariants(normalized: string | null): string[] {
        if (!normalized) return [];
        const local = '0' + normalized.slice(2); // 628xxx → 08xxx
        return [normalized, local];
    }

    async findAllWithStats(opts?: { page?: number; pageSize?: number; search?: string }) {
        const page = Math.max(Number(opts?.page) || 1, 1);
        const take = Math.min(Math.max(Number(opts?.pageSize) || 20, 1), 100);
        const search = (opts?.search || '').trim();

        const where: any = {};
        if (search) {
            const digits = search.replace(/\D/g, '');
            where.OR = [
                { name: { contains: search } },
                ...(digits.length >= 3 ? [{ phone: { contains: digits } }] : []),
            ];
        }

        const [total, customers] = await Promise.all([
            this.prisma.customer.count({ where }),
            this.prisma.customer.findMany({ where, orderBy: { name: 'asc' }, skip: (page - 1) * take, take }),
        ]);

        // Match transaksi HANYA untuk customer di halaman ini (hemat). Cocokkan by
        // phoneKey supaya tetap match walau format tersimpan beda (08 vs 62 vs +62).
        const phoneVar = Array.from(new Set(customers.flatMap(c => this.phoneVariants(toWaPhone(c.phone)))));
        const noPhoneNames = customers.filter(c => !toWaPhone(c.phone)).map(c => c.name);
        const orClause: any[] = [];
        if (phoneVar.length > 0) orClause.push({ customerPhone: { in: phoneVar } });
        if (noPhoneNames.length > 0) orClause.push({ customerName: { in: noPhoneNames }, customerPhone: null });

        const transactions = orClause.length > 0
            ? await this.prisma.transaction.findMany({
                where: { status: { in: ['PAID', 'PARTIAL'] }, OR: orClause },
                select: { customerPhone: true, customerName: true, downPayment: true, grandTotal: true, status: true, createdAt: true },
            })
            : [];

        const rows = customers.map(c => {
            const ckey = phoneKey(c.phone);
            const matching = transactions.filter(t =>
                (ckey && phoneKey(t.customerPhone) === ckey) ||
                (!ckey && !t.customerPhone && t.customerName === c.name)
            );
            const sorted = matching.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
            return {
                ...c,
                totalOrders: matching.length,
                totalRevenue: matching.reduce((sum, t) => sum + nilaiNota(t), 0),
                lastOrderDate: sorted[0]?.createdAt ?? null,
            };
        });

        return { rows, total, page, pageSize: take };
    }

    /** Ringkasan ringan untuk kartu atas (tanpa load semua customer). */
    async summaryStats() {
        const [totalCustomers, lunas, dp, activePhones] = await Promise.all([
            this.prisma.customer.count(),
            this.prisma.transaction.aggregate({ _sum: { grandTotal: true }, where: { status: 'PAID' } }),
            this.prisma.transaction.aggregate({ _sum: { downPayment: true }, where: { status: 'PARTIAL' } }),
            this.prisma.transaction.findMany({
                where: { status: { in: ['PAID', 'PARTIAL'] }, customerPhone: { not: null } },
                select: { customerPhone: true },
                distinct: ['customerPhone'],
            }),
        ]);
        return {
            totalCustomers,
            totalRevenue: Number(lunas._sum.grandTotal || 0) + Number(dp._sum.downPayment || 0),
            activeCustomers: activePhones.length,
        };
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

        const totalRevenue = transactions.reduce((sum, t) => sum + nilaiNota(t), 0);
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
                productMap[name].revenue += lineTotalOf(item); // dulu harga satuan saja (tanpa qty/luas)
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
                .reduce((sum, t) => sum + nilaiNota(t), 0);
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

            const totalRevenue = matching.reduce((sum, t) => sum + nilaiNota(t), 0);
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
                    productMap[name].revenue += lineTotalOf(item);
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
        const patch: any = { ...data };
        if (data.phone !== undefined) patch.phone = toWaPhone(data.phone); // seragamkan ke 628xxx
        // assignedCsId & tags adalah field CRM yang baru — biarkan Prisma yang validate.
        return this.prisma.customer.update({ where: { id }, data: patch });
    }

    /**
     * Rapikan data: (1) seragamkan SEMUA nomor (customer + transaksi) ke 628xxx,
     * (2) gabungkan customer duplikat (nomor sama) jadi satu — simpan yang paling
     * lengkap, repoint semua referensi (SO, lead, aktivitas, follow-up, referral,
     * kontak WA/sosial, rating CS), lalu hapus yang dobel. Riwayat transaksi TIDAK
     * dihapus (tidak ber-FK ke customer).
     */
    async dedupe() {
        // ── 1. Normalisasi nomor customer ──────────────────────────────────────
        const customers = await this.prisma.customer.findMany({
            select: {
                id: true, name: true, phone: true, address: true, createdAt: true,
                assignedCsId: true, tags: true, leadSource: true, referrerCustomerId: true,
            },
        });
        let customerPhonesFixed = 0;
        for (const c of customers) {
            const norm = toWaPhone(c.phone);
            if (norm !== (c.phone ?? null)) {
                await this.prisma.customer.update({ where: { id: c.id }, data: { phone: norm } });
                customerPhonesFixed++;
                (c as any).phone = norm;
            }
        }

        // ── 2. Normalisasi nomor di transaksi (biar match & data seragam) ───────
        const txs = await this.prisma.transaction.findMany({
            where: { customerPhone: { not: null } },
            select: { id: true, customerPhone: true },
        });
        let txPhonesFixed = 0;
        for (const t of txs) {
            const norm = toWaPhone(t.customerPhone);
            if (norm && norm !== t.customerPhone) {
                await this.prisma.transaction.update({ where: { id: t.id }, data: { customerPhone: norm } });
                txPhonesFixed++;
            }
        }

        // ── 3. Gabung customer duplikat (by nomor kanonik) ──────────────────────
        const byPhone = new Map<string, any[]>();
        for (const c of customers) {
            const k = phoneKey(c.phone);
            if (!k) continue; // tanpa nomor → tidak digabung
            if (!byPhone.has(k)) byPhone.set(k, []);
            byPhone.get(k)!.push(c);
        }

        let duplicateGroups = 0;
        let customersMerged = 0;
        for (const group of byPhone.values()) {
            if (group.length < 2) continue;
            duplicateGroups++;
            // keeper = paling lengkap (punya alamat & nama), lalu paling tua
            const keeper = [...group].sort((a, b) => {
                const sa = (a.address ? 1 : 0) + (a.name ? 1 : 0);
                const sb = (b.address ? 1 : 0) + (b.name ? 1 : 0);
                if (sb !== sa) return sb - sa;
                return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
            })[0];
            const losers = group.filter(c => c.id !== keeper.id);
            const loserIds = losers.map(c => c.id);

            // Lengkapi kolom kosong keeper dari duplikat (alamat, CS, tag, sumber lead)
            const kosong = (v: any) => v == null || v === '' || (Array.isArray(v) && v.length === 0);
            const patch: any = {};
            for (const f of ['address', 'assignedCsId', 'tags', 'leadSource']) {
                if (!kosong(keeper[f])) continue;
                const src = losers.find(c => !kosong(c[f]));
                if (src) patch[f] = src[f];
            }
            // Keeper jangan jadi perujuk dirinya sendiri
            if (keeper.referrerCustomerId != null && loserIds.includes(keeper.referrerCustomerId)) {
                patch.referrerCustomerId = null;
            }

            // Satu grup = satu transaksi: gagal di tengah tidak meninggalkan data setengah pindah.
            // Repoint semua referensi ke keeper (LeadActivity Cascade → WAJIB di-repoint)
            await this.prisma.$transaction(async (tx) => {
                const db = tx as any;
                const pindah = { where: { customerId: { in: loserIds } }, data: { customerId: keeper.id } };
                await db.salesOrder.updateMany(pindah);
                await db.lead.updateMany({ where: { convertedCustomerId: { in: loserIds } }, data: { convertedCustomerId: keeper.id } });
                await db.leadActivity.updateMany(pindah);
                await db.followUp.updateMany(pindah);
                await db.waContact.updateMany(pindah);
                await db.socialContact.updateMany(pindah);
                await db.csRatingResponse.updateMany(pindah);
                await db.customer.updateMany({
                    where: { referrerCustomerId: { in: loserIds }, id: { not: keeper.id } },
                    data: { referrerCustomerId: keeper.id },
                });
                if (Object.keys(patch).length) await db.customer.update({ where: { id: keeper.id }, data: patch });
                await db.customer.deleteMany({ where: { id: { in: loserIds } } });
            }, { timeout: 30_000, maxWait: 10_000 }); // disk server kadang lambat (fsync)
            customersMerged += loserIds.length;
        }

        return { customerPhonesFixed, txPhonesFixed, duplicateGroups, customersMerged };
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

    /** Hapus hanya customer tanpa riwayat CRM; yang tertaut → gabungkan saja. */
    async remove(id: number) {
        const db = this.prisma as any;
        const [leads, sos, wa, social, ratings, activities, followUps] = await Promise.all([
            db.lead.count({ where: { convertedCustomerId: id } }),
            db.salesOrder.count({ where: { customerId: id } }),
            db.waContact.count({ where: { customerId: id } }),
            db.socialContact.count({ where: { customerId: id } }),
            db.csRatingResponse.count({ where: { customerId: id } }),
            db.leadActivity.count({ where: { customerId: id } }),
            db.followUp.count({ where: { customerId: id } }),
        ]);
        const tautan = [
            leads && `${leads} lead`,
            sos && `${sos} sales order`,
            wa && `${wa} kontak WA`,
            social && `${social} kontak sosial`,
            ratings && `${ratings} rating`,
            activities && `${activities} aktivitas CRM`,
            followUps && `${followUps} follow-up`,
        ].filter(Boolean);
        if (tautan.length) {
            throw new BadRequestException(
                `Customer ini masih tertaut ke ${tautan.join(', ')}. Jangan dihapus — gabungkan saja lewat "Rapikan duplikat".`,
            );
        }
        return this.prisma.customer.delete({ where: { id } });
    }
}
