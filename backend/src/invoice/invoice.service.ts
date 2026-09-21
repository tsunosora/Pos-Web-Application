import { BadRequestException, Injectable, NotFoundException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import type { BranchContext } from '../common/branch-context.decorator';
import { branchWhere, requireBranch, assertBranchAccess } from '../common/branch-where.helper';
import { isOwnerLevelRole } from '../auth/role-groups';

/** Tanggal hari ini di WIB (YYYYMMDD) — bukan UTC, supaya nomor 00.00–07.00 tidak mundur sehari. */
const ymdWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, '');

/** Alur status yang sah — sama dengan tombol di halaman Invoice & Penawaran (T-41). */
const ALUR: Record<'INVOICE' | 'QUOTATION', Partial<Record<InvoiceStatus, InvoiceStatus[]>>> = {
    INVOICE: { DRAFT: ['SENT', 'CANCELLED'], SENT: ['PAID', 'CANCELLED'] },
    QUOTATION: { DRAFT: ['SENT', 'CANCELLED'], SENT: ['ACCEPTED', 'REJECTED', 'EXPIRED'] },
};

/**
 * Kolom yang boleh diisi klien + total yang DIHITUNG SERVER (T-40). Dulu seluruh body
 * disebar ke Prisma: invoice bisa dibuat langsung "PAID" dengan nomor & total karangan.
 */
function isiInvoice(data: any) {
    const items = Array.isArray(data?.items) ? data.items : [];
    const bersihItems = items.map((it: any, i: number) => {
        const quantity = Number(it?.quantity);
        const price = Number(it?.price);
        const description = String(it?.description ?? '').trim();
        if (!description) throw new BadRequestException(`Item ke-${i + 1}: deskripsi wajib diisi.`);
        // Pecahan boleh (baris luas: 3 × 1,5 m = 4,5 m²) — dibulatkan 2 desimal seperti kolomnya.
        if (!Number.isFinite(quantity) || quantity <= 0) throw new BadRequestException(`Item ke-${i + 1}: jumlah harus lebih dari 0.`);
        if (quantity > 1_000_000) throw new BadRequestException(`Item ke-${i + 1}: jumlah terlalu besar.`);
        if (!Number.isFinite(price) || price < 0) throw new BadRequestException(`Item ke-${i + 1}: harga tidak boleh negatif.`);
        return { description: description.slice(0, 255), unit: it?.unit ? String(it.unit).slice(0, 50) : null, quantity: Math.round(quantity * 100) / 100, price };
    });
    const taxRate = Number(data?.taxRate ?? 0) || 0;
    const discount = Math.round(Number(data?.discount ?? 0) || 0);
    if (taxRate < 0 || taxRate > 100) throw new BadRequestException('PPN harus 0–100%.');
    const subtotal = bersihItems.reduce((s: number, it: any) => s + it.quantity * it.price, 0);
    const taxAmount = Math.round(subtotal * taxRate / 100);
    if (discount < 0 || discount > subtotal + taxAmount) throw new BadRequestException('Diskon tidak boleh negatif atau melebihi total.');
    const tgl = (v: any) => (v ? new Date(v) : null);
    const teks = (v: any, max: number) => (v == null || v === '' ? null : String(v).slice(0, max));
    const clientName = String(data?.clientName ?? '').trim();
    return {
        items: bersihItems,
        fields: {
            ...(data?.clientName !== undefined ? { clientName: clientName.slice(0, 200) } : {}),
            ...(data?.clientCompany !== undefined ? { clientCompany: teks(data.clientCompany, 200) } : {}),
            ...(data?.clientAddress !== undefined ? { clientAddress: teks(data.clientAddress, 5000) } : {}),
            ...(data?.clientPhone !== undefined ? { clientPhone: teks(data.clientPhone, 50) } : {}),
            ...(data?.clientEmail !== undefined ? { clientEmail: teks(data.clientEmail, 150) } : {}),
            ...(data?.dueDate !== undefined ? { dueDate: tgl(data.dueDate) } : {}),
            ...(data?.validUntil !== undefined ? { validUntil: tgl(data.validUntil) } : {}),
            ...(data?.notes !== undefined ? { notes: teks(data.notes, 20000) } : {}),
            ...(data?.letterCity !== undefined ? { letterCity: teks(data.letterCity, 120) } : {}),
            ...(data?.signatoryName !== undefined ? { signatoryName: teks(data.signatoryName, 120) } : {}),
            ...(data?.signatoryPhone !== undefined ? { signatoryPhone: teks(data.signatoryPhone, 50) } : {}),
            taxRate, taxAmount, discount, subtotal, total: subtotal + taxAmount - discount,
        },
    };
}

@Injectable()
export class InvoiceService implements OnModuleInit {
    private readonly logger = new Logger(InvoiceService.name);
    constructor(private prisma: PrismaService) { }

    // Pakai `as any` karena kolom branchId baru ditambah (Prisma Client mungkin belum regen).
    private get model(): any { return (this.prisma as any).invoice; }

    /** Backfill sekali jalan: invoice lama (branchId null) → cabang Pusat. */
    async onModuleInit() {
        try {
            const orphan = await this.model.count({ where: { branchId: null } });
            if (orphan === 0) return;
            const pusatId = await this.resolvePusatBranchId();
            if (!pusatId) {
                this.logger.warn(`Ada ${orphan} invoice tanpa cabang tapi cabang Pusat tidak ditemukan — backfill dilewati.`);
                return;
            }
            const res = await this.model.updateMany({ where: { branchId: null }, data: { branchId: pusatId } });
            this.logger.log(`Backfill invoice: ${res.count} invoice lama di-assign ke cabang Pusat (id=${pusatId}).`);
        } catch (e: any) {
            // Kemungkinan kolom belum ada (db push belum dijalankan) — aman, skip.
            this.logger.warn(`Backfill invoice dilewati: ${e?.message || e}`);
        }
    }

    /** Cari cabang "Pusat": code PST/PUSAT atau nama mengandung "pusat", fallback cabang aktif pertama. */
    private async resolvePusatBranchId(): Promise<number | null> {
        const branches: any[] = await (this.prisma as any).companyBranch.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true },
            orderBy: { id: 'asc' },
        });
        if (!branches.length) return null;
        const byCode = branches.find(b => ['PST', 'PUSAT'].includes((b.code || '').toUpperCase()));
        if (byCode) return byCode.id;
        const byName = branches.find(b => (b.name || '').toLowerCase().includes('pusat'));
        if (byName) return byName.id;
        return branches[0].id; // fallback: cabang tertua
    }

    /** Nomor dibuat SERVER: INV/SPH-YYYYMMDD-NNN (urut per hari, WIB). */
    private async nomorBaru(type: InvoiceType): Promise<string> {
        const awal = `${type === InvoiceType.QUOTATION ? 'SPH' : 'INV'}-${ymdWib()}-`;
        const last = await this.model.findFirst({ where: { invoiceNumber: { startsWith: awal } }, orderBy: { invoiceNumber: 'desc' } });
        const seq = last ? (parseInt(String(last.invoiceNumber).slice(awal.length), 10) || 0) + 1 : 1;
        return `${awal}${String(seq).padStart(3, '0')}`;
    }

    /** quantity kolom Decimal → dikirim sebagai angka (bukan teks "4.50") ke halaman. */
    private angkaItem(inv: any) {
        return inv?.items ? { ...inv, items: inv.items.map((it: any) => ({ ...it, quantity: Number(it.quantity) })) } : inv;
    }

    /** Simpan dengan nomor baru; ulangi bila nomor bentrok dengan permintaan bersamaan. */
    private async buatDenganNomor(type: InvoiceType, data: (nomor: string) => any) {
        for (let i = 0; i < 5; i++) {
            try {
                return this.angkaItem(await this.model.create({ data: data(await this.nomorBaru(type)), include: { items: true } }));
            } catch (e: any) {
                if (e?.code === 'P2002' && i < 4) continue;
                throw e;
            }
        }
    }

    async create(data: any, branchCtx?: BranchContext) {
        const branchId = branchCtx ? requireBranch(branchCtx) : (data.branchId ?? null);
        const type = data?.type === InvoiceType.QUOTATION ? InvoiceType.QUOTATION : InvoiceType.INVOICE;
        const { items, fields } = isiInvoice(data);
        if (!fields.clientName) throw new BadRequestException('Nama klien wajib diisi.');
        // Status selalu DRAFT; berubah hanya lewat PATCH /:id/status yang punya aturan.
        return this.buatDenganNomor(type, (invoiceNumber) => ({
            ...fields, invoiceNumber, type, status: InvoiceStatus.DRAFT, branchId,
            items: { create: items },
        }));
    }

    async findAll(type?: InvoiceType, branchCtx?: BranchContext) {
        const where: any = { ...(branchCtx ? branchWhere(branchCtx) : {}) };
        if (type) where.type = type;
        const rows = await this.model.findMany({
            where,
            orderBy: { date: 'desc' },
            include: { items: true },
        });
        return rows.map((r: any) => this.angkaItem(r));
    }

    /** Ambil invoice + pastikan akses cabang (staff hanya cabangnya). */
    private async getScoped(id: number, branchCtx?: BranchContext) {
        const inv = await this.model.findUnique({ where: { id }, include: { items: true } });
        if (!inv) throw new NotFoundException('Invoice not found');
        if (branchCtx) assertBranchAccess(branchCtx, inv.branchId ?? null);
        return inv;
    }

    async findOne(id: number, branchCtx?: BranchContext) {
        return this.angkaItem(await this.getScoped(id, branchCtx));
    }

    async update(id: number, data: any, branchCtx?: BranchContext) {
        const lama = await this.getScoped(id, branchCtx);
        if (['PAID', 'CANCELLED', 'ACCEPTED', 'REJECTED', 'EXPIRED'].includes(lama.status)) {
            throw new BadRequestException(`Dokumen berstatus ${lama.status} tidak bisa diubah lagi.`);
        }
        // Nomor, status, jenis & total TIDAK ikut dari kiriman; total dihitung dari item (T-40).
        const sumber = data?.items !== undefined ? data : { ...data, items: lama.items };
        const { items, fields } = isiInvoice({ ...lama, ...sumber });

        return this.prisma.$transaction(async (tx) => {
            if (data?.items !== undefined) {
                await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
            }
            await (tx as any).invoice.update({
                where: { id },
                data: {
                    ...fields,
                    ...(data?.items !== undefined ? { items: { create: items } } : {}),
                },
            });
            return this.angkaItem(await (tx as any).invoice.findUnique({ where: { id }, include: { items: true } }));
        });
    }

    async updateStatus(id: number, status: InvoiceStatus, branchCtx?: BranchContext) {
        const inv = await this.getScoped(id, branchCtx);
        if (!Object.values(InvoiceStatus).includes(status)) {
            throw new BadRequestException(`Status "${status}" tidak dikenal.`);
        }
        const boleh = ALUR[inv.type as 'INVOICE' | 'QUOTATION']?.[inv.status as InvoiceStatus] ?? [];
        // Owner boleh membetulkan status yang salah klik (mis. PAID → SENT); selain itu ikut alur.
        if (!boleh.includes(status) && !isOwnerLevelRole(branchCtx?.roleName)) {
            throw new BadRequestException(
                `Status ${inv.status} → ${status} tidak diizinkan. ` +
                (boleh.length ? `Yang boleh: ${boleh.join(', ')}.` : 'Dokumen ini sudah final.'),
            );
        }
        return this.model.update({ where: { id }, data: { status } });
    }

    async updateType(id: number, type: InvoiceType, branchCtx?: BranchContext) {
        const inv = await this.getScoped(id, branchCtx);
        if (!Object.values(InvoiceType).includes(type)) throw new BadRequestException(`Jenis "${type}" tidak dikenal.`);
        if (inv.status !== InvoiceStatus.DRAFT) throw new BadRequestException('Jenis dokumen hanya bisa diubah saat masih DRAFT.');
        return this.model.update({ where: { id }, data: { type } });
    }

    async convertToInvoice(id: number, branchCtx?: BranchContext) {
        const quotation = await this.getScoped(id, branchCtx);
        if (quotation.type !== InvoiceType.QUOTATION) throw new BadRequestException('Hanya surat penawaran (SPH) yang bisa dijadikan invoice.');
        if (['REJECTED', 'EXPIRED', 'CANCELLED'].includes(quotation.status)) {
            throw new BadRequestException(`SPH berstatus ${quotation.status} tidak bisa dijadikan invoice.`);
        }
        // Satu SPH → satu invoice (T-42). Kolom source_quotation_id unik juga menjaga di basis data.
        const sudah = await this.model.findFirst({ where: { sourceQuotationId: id }, select: { invoiceNumber: true } });
        if (sudah) throw new BadRequestException(`SPH ini sudah menjadi invoice ${sudah.invoiceNumber}.`);

        return this.buatDenganNomor(InvoiceType.INVOICE, (newNumber) => ({
                invoiceNumber: newNumber,
                sourceQuotationId: id,
                type: InvoiceType.INVOICE,
                branchId: quotation.branchId ?? null, // invoice baru ikut cabang quotation asal
                clientName: quotation.clientName,
                clientCompany: quotation.clientCompany,
                clientEmail: quotation.clientEmail,
                clientAddress: quotation.clientAddress,
                clientPhone: quotation.clientPhone,
                dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
                subtotal: quotation.subtotal,
                taxRate: quotation.taxRate,
                taxAmount: quotation.taxAmount,
                discount: quotation.discount,
                total: quotation.total,
                notes: quotation.notes,
                status: InvoiceStatus.DRAFT,
                items: {
                    create: quotation.items.map((item: any) => ({
                        description: item.description,
                        unit: item.unit,
                        quantity: item.quantity,
                        price: item.price,
                    })),
                },
        }));
    }

    async remove(id: number, branchCtx?: BranchContext) {
        await this.getScoped(id, branchCtx);
        return this.model.delete({ where: { id } });
    }
}
