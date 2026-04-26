import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import * as fs from 'fs';
import * as path from 'path';

export type SalesOrderStatus = 'DRAFT' | 'SENT' | 'INVOICED' | 'CANCELLED';

export interface CreateSalesOrderDto {
    customerId?: number | null;
    customerName: string;
    customerPhone?: string | null;
    customerAddress?: string | null;
    designerName: string;
    branchName?: string | null; // cabang asal SO (auto dari designer.branchName atau manual)
    notes?: string | null;
    deadline?: string | null; // ISO
    items: {
        productVariantId: number;
        quantity: number;
        widthCm?: number | null;
        heightCm?: number | null;
        unitType?: string | null;
        pcs?: number | null;
        customPrice?: number | null;
        note?: string | null;
    }[];
}

export interface UpdateSalesOrderDto extends Partial<CreateSalesOrderDto> {}

@Injectable()
export class SalesOrdersService {
    constructor(
        private prisma: PrismaService,
        private whatsapp: WhatsappService,
    ) {}

    private soInclude() {
        return {
            items: {
                include: {
                    productVariant: {
                        select: {
                            id: true,
                            sku: true,
                            variantName: true,
                            price: true,
                            product: { select: { id: true, name: true, pricingMode: true } },
                        },
                    },
                },
            },
            proofs: {
                orderBy: { createdAt: 'asc' },
            },
            transaction: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    checkoutNumber: true,
                    status: true,
                    grandTotal: true,
                },
            },
            customer: { select: { id: true, name: true, phone: true, address: true } },
        };
    }

    async generateSoNumber(): Promise<string> {
        const today = new Date();
        const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const prefix = `SO-${yyyymmdd}-`;
        const last = await (this.prisma as any).salesOrder.findFirst({
            where: { soNumber: { startsWith: prefix } },
            orderBy: { soNumber: 'desc' },
            select: { soNumber: true },
        });
        let nextSeq = 1;
        if (last?.soNumber) {
            const n = parseInt(last.soNumber.slice(prefix.length), 10);
            if (!Number.isNaN(n)) nextSeq = n + 1;
        }
        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    async list(status?: SalesOrderStatus, search?: string, designerName?: string) {
        const where: any = {};
        if (status) where.status = status;
        if (designerName) where.designerName = designerName;
        if (search && search.trim()) {
            const q = search.trim();
            where.OR = [
                { soNumber: { contains: q } },
                { customerName: { contains: q } },
                { customerPhone: { contains: q } },
            ];
        }
        return (this.prisma as any).salesOrder.findMany({
            where,
            include: this.soInclude(),
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: number) {
        const so = await (this.prisma as any).salesOrder.findUnique({
            where: { id },
            include: this.soInclude(),
        });
        if (!so) throw new NotFoundException('Surat Order tidak ditemukan');
        return so;
    }

    async pendingInvoiceCount() {
        const count = await (this.prisma as any).salesOrder.count({ where: { status: 'SENT' } });
        return { count };
    }

    async create(data: CreateSalesOrderDto, fallbackBranchId?: number | null) {
        if (!data.items || data.items.length === 0) {
            throw new BadRequestException('Minimal 1 item harus diisi');
        }
        if (!data.customerName?.trim()) {
            throw new BadRequestException('Nama customer wajib diisi');
        }
        if (!data.designerName?.trim()) {
            throw new BadRequestException('Nama desainer wajib diisi');
        }

        // Auto-tag branchName dari cabang aktif user kalau belum di-set di body.
        let branchName: string | null = data.branchName ?? null;
        if (!branchName && fallbackBranchId != null) {
            try {
                const branch = await (this.prisma as any).companyBranch.findUnique({
                    where: { id: fallbackBranchId },
                    select: { name: true },
                });
                if (branch?.name) branchName = branch.name;
            } catch { /* abaikan */ }
        }

        const soNumber = await this.generateSoNumber();
        const so = await (this.prisma as any).salesOrder.create({
            data: {
                soNumber,
                status: 'DRAFT',
                customerId: data.customerId ?? null,
                customerName: data.customerName,
                customerPhone: data.customerPhone ?? null,
                customerAddress: data.customerAddress ?? null,
                designerName: data.designerName,
                branchName,
                notes: data.notes ?? null,
                deadline: data.deadline ? new Date(data.deadline) : null,
                items: {
                    create: data.items.map((it) => ({
                        productVariantId: it.productVariantId,
                        quantity: it.quantity,
                        widthCm: it.widthCm ?? null,
                        heightCm: it.heightCm ?? null,
                        unitType: it.unitType ?? null,
                        pcs: it.pcs ?? null,
                        customPrice: it.customPrice ?? null,
                        note: it.note ?? null,
                    })),
                },
            },
            include: this.soInclude(),
        });
        return so;
    }

    async update(id: number, data: UpdateSalesOrderDto) {
        const existing = await this.findOne(id);
        if (existing.status === 'INVOICED' || existing.status === 'CANCELLED') {
            throw new BadRequestException('SO yang sudah diinvoice / dibatalkan tidak dapat diubah');
        }

        const updateData: any = {};
        if (data.customerId !== undefined) updateData.customerId = data.customerId;
        if (data.customerName !== undefined) updateData.customerName = data.customerName;
        if (data.customerPhone !== undefined) updateData.customerPhone = data.customerPhone;
        if (data.customerAddress !== undefined) updateData.customerAddress = data.customerAddress;
        if (data.designerName !== undefined) updateData.designerName = data.designerName;
        if (data.notes !== undefined) updateData.notes = data.notes;
        if (data.deadline !== undefined) updateData.deadline = data.deadline ? new Date(data.deadline) : null;

        // Ganti items hanya jika masih DRAFT (bukan SENT) — setelah SENT, hanya notes/customer/proofs boleh
        if (data.items && existing.status === 'DRAFT') {
            await (this.prisma as any).salesOrderItem.deleteMany({ where: { salesOrderId: id } });
            updateData.items = {
                create: data.items.map((it) => ({
                    productVariantId: it.productVariantId,
                    quantity: it.quantity,
                    widthCm: it.widthCm ?? null,
                    heightCm: it.heightCm ?? null,
                    unitType: it.unitType ?? null,
                    pcs: it.pcs ?? null,
                    customPrice: it.customPrice ?? null,
                    note: it.note ?? null,
                })),
            };
        }

        return (this.prisma as any).salesOrder.update({
            where: { id },
            data: updateData,
            include: this.soInclude(),
        });
    }

    async addProofs(id: number, files: Express.Multer.File[], captions?: string[]) {
        await this.findOne(id);
        if (!files || files.length === 0) throw new BadRequestException('Tidak ada file yang diupload');
        const created: any[] = [];
        for (let i = 0; i < files.length; i++) {
            const f = files[i];
            // Simpan path relatif terhadap cwd backend (public/uploads/...)
            // multer destination './public/uploads' → f.path = public/uploads/xxx
            const relative = f.path.replace(/\\/g, '/');
            const proof = await (this.prisma as any).salesOrderProof.create({
                data: {
                    salesOrderId: id,
                    filename: relative,
                    caption: captions?.[i] ?? null,
                },
            });
            created.push(proof);
        }
        return created;
    }

    async removeProof(soId: number, proofId: number) {
        const proof = await (this.prisma as any).salesOrderProof.findUnique({ where: { id: proofId } });
        if (!proof || proof.salesOrderId !== soId) throw new NotFoundException('Proof tidak ditemukan');
        // Hapus file fisik best-effort
        try {
            const abs = path.join(process.cwd(), proof.filename);
            if (fs.existsSync(abs)) fs.unlinkSync(abs);
        } catch {
            // ignore
        }
        await (this.prisma as any).salesOrderProof.delete({ where: { id: proofId } });
        return { success: true };
    }

    private buildCaption(so: any, customMessage?: string): string {
        const lines: string[] = [];
        lines.push(`*SURAT ORDER ${so.soNumber}*`);
        lines.push('');
        lines.push(`Pelanggan: ${so.customerName}`);
        if (so.customerPhone) lines.push(`HP: ${so.customerPhone}`);
        lines.push(`Desainer: ${so.designerName}`);
        if (so.deadline) {
            lines.push(`Deadline: ${new Date(so.deadline).toLocaleString('id-ID')}`);
        }
        lines.push('');
        lines.push('*Detail Item:*');
        (so.items || []).forEach((it: any, idx: number) => {
            const productName = it.productVariant?.product?.name || 'Produk';
            const variantName = it.productVariant?.variantName ? ` — ${it.productVariant.variantName}` : '';
            let dim = '';
            if (it.widthCm && it.heightCm) {
                const u = it.unitType || 'm';
                dim = ` [${it.widthCm}×${it.heightCm}${u}]`;
            }
            const pcsStr = it.pcs && it.pcs > 1 ? ` ×${it.pcs}pcs` : '';
            const qtyStr = ` (${it.quantity})`;
            const noteStr = it.note ? `\n     _${it.note}_` : '';
            lines.push(`${idx + 1}. ${productName}${variantName}${dim}${pcsStr}${qtyStr}${noteStr}`);
        });
        if (so.notes) {
            lines.push('');
            lines.push(`*Catatan:*\n${so.notes}`);
        }
        if (customMessage && customMessage.trim()) {
            lines.push('');
            lines.push(customMessage.trim());
        }
        lines.push('');
        lines.push('_Silakan kasir segera dibuatkan nota._');
        return lines.join('\n');
    }

    async sendToWhatsappGroup(id: number, customMessage?: string, fallbackBranchId?: number | null) {
        const so = await this.findOne(id);
        if (so.status === 'INVOICED' || so.status === 'CANCELLED') {
            throw new BadRequestException('SO yang sudah diinvoice / dibatalkan tidak dapat dikirim ulang');
        }

        // Resolve branchId dari SO.branchName (SalesOrder belum punya FK branchId).
        // Coba 3 strategi: exact match, case-insensitive, substring (untuk handle "Cab Sewon" vs "Sewon").
        const soBranchName: string | null = (so as any).branchName ?? null;
        let branchId: number | null = null;
        let matchedBranchName: string | null = null;
        let resolvedFrom: string = 'none';
        if (soBranchName) {
            try {
                // 1) Exact match name
                let branch = await (this.prisma as any).companyBranch.findFirst({
                    where: { name: soBranchName, isActive: true },
                    select: { id: true, name: true, code: true },
                });
                // 2) Try multiple strategies dengan loop di memori
                if (!branch) {
                    const allBranches: any[] = await (this.prisma as any).companyBranch.findMany({
                        where: { isActive: true },
                        select: { id: true, name: true, code: true },
                    });
                    const queryLower = soBranchName.toLowerCase().trim();
                    const queryTokens = queryLower.split(/\s+/).filter(t => t.length >= 3); // skip token kecil

                    // 2a) Case-insensitive name match
                    branch = allBranches.find(b => b.name.toLowerCase().trim() === queryLower) || null;
                    // 2b) Match by code (case-insensitive)
                    if (!branch) {
                        branch = allBranches.find(b =>
                            b.code && (
                                b.code.toLowerCase() === queryLower ||
                                queryLower.includes(b.code.toLowerCase()) ||
                                queryLower === b.code.toLowerCase()
                            ),
                        ) || null;
                    }
                    // 2c) Substring match name
                    if (!branch) {
                        branch = allBranches.find(b =>
                            b.name.toLowerCase().includes(queryLower) ||
                            queryLower.includes(b.name.toLowerCase()),
                        ) || null;
                    }
                    // 2d) Token-based match — paling longgar.
                    // Misal query "Cab Sewon" → token ["cab","sewon"]; branch "Voliko Cabang Sewon (CAB)" → match karena ada "sewon" & "cab"
                    if (!branch && queryTokens.length > 0) {
                        let bestScore = 0;
                        for (const b of allBranches) {
                            const haystack = `${b.name} ${b.code ?? ''}`.toLowerCase();
                            let score = 0;
                            for (const tok of queryTokens) {
                                if (haystack.includes(tok)) score++;
                            }
                            if (score > bestScore) {
                                bestScore = score;
                                branch = b;
                            }
                        }
                    }
                }
                if (branch) {
                    branchId = branch.id;
                    matchedBranchName = branch.name;
                    resolvedFrom = 'so.branchName';
                }
            } catch { /* abaikan */ }
        }

        // Fallback: kalau SO tidak punya branchName atau tidak match, pakai cabang aktif user
        // (dari header X-Branch-Id). Cocok untuk SO lama yang dibuat sebelum multi-branch.
        if (!branchId && fallbackBranchId != null) {
            try {
                const branch = await (this.prisma as any).companyBranch.findUnique({
                    where: { id: fallbackBranchId },
                    select: { id: true, name: true, isActive: true },
                });
                if (branch?.isActive) {
                    branchId = branch.id;
                    matchedBranchName = branch.name;
                    resolvedFrom = 'fallback (cabang aktif user)';
                }
            } catch { /* abaikan */ }
        }

        // Logging untuk debug
        // eslint-disable-next-line no-console
        console.log(`[sendToWhatsappGroup] SO #${id} branchName="${soBranchName}" fallbackBranchId=${fallbackBranchId} → branchId=${branchId} (matched="${matchedBranchName}", from=${resolvedFrom})`);

        const designGroupId = await this.whatsapp.resolveDesignGroupId(branchId);
        if (!designGroupId) {
            const detail: string[] = [];
            detail.push(`SO branchName: "${soBranchName ?? '(kosong)'}"`);
            detail.push(`Cabang aktif user: ${fallbackBranchId ?? '(none)'}`);
            detail.push(`Resolusi: ${resolvedFrom}`);
            detail.push(`Cabang ter-resolve: ${matchedBranchName ? `"${matchedBranchName}" (id=${branchId})` : 'TIDAK DITEMUKAN'}`);
            detail.push(`BranchSettings.waDesignGroupId: kosong`);
            detail.push(`Global designGroupId fallback: kosong`);
            // Tampilkan daftar cabang aktif supaya user tahu nama persisnya
            try {
                const allBranches: any[] = await (this.prisma as any).companyBranch.findMany({
                    where: { isActive: true },
                    select: { name: true, code: true },
                });
                if (allBranches.length) {
                    const list = allBranches.map(b => `"${b.name}"${b.code ? ` (${b.code})` : ''}`).join(', ');
                    detail.push(`Cabang tersedia: ${list}`);
                }
            } catch { /* abaikan */ }
            throw new BadRequestException(
                `Group WA Desain belum di-set. Diagnostik: ${detail.join(' | ')}. ` +
                `Solusi: (1) buka Settings → Konfigurasi Cabang → pilih cabang yang benar → isi "Design Group ID", ATAU ` +
                `(2) update profil desainer di Settings → Designers supaya Branch Name persis sama dengan salah satu cabang di atas.`,
            );
        }

        // Cek bot connection sebelum kirim
        const status = this.whatsapp.getConnectionStatus();
        if (!status?.isReady) {
            throw new BadRequestException(
                `Bot WA tidak terhubung (status: ${status?.status || 'unknown'}). Buka Settings → WhatsApp → scan QR ulang.`,
            );
        }

        const caption = this.buildCaption(so, customMessage);
        const imagePaths = (so.proofs || []).map((p: any) => p.filename);

        const ok = await this.whatsapp.sendToDesignGroup(caption, imagePaths, branchId);
        if (!ok) {
            throw new BadRequestException(
                `Gagal kirim ke WA group "${designGroupId}". Kemungkinan: bot belum jadi member group, atau group ID salah. Cek log backend untuk detail.`,
            );
        }

        const newStatus = so.status === 'DRAFT' ? 'SENT' : so.status;
        return (this.prisma as any).salesOrder.update({
            where: { id },
            data: {
                status: newStatus,
                sentToWaAt: new Date(),
            },
            include: this.soInclude(),
        });
    }

    async markCancelled(id: number, reason: string) {
        const so = await this.findOne(id);
        if (so.status === 'INVOICED') throw new BadRequestException('SO sudah diinvoice, tidak dapat dibatalkan');
        if (so.status === 'CANCELLED') throw new BadRequestException('SO sudah dibatalkan');
        return (this.prisma as any).salesOrder.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                cancelledAt: new Date(),
                cancelReason: reason || null,
            },
            include: this.soInclude(),
        });
    }

    async markInvoiced(id: number, transactionId: number) {
        const so = await (this.prisma as any).salesOrder.findUnique({ where: { id } });
        if (!so) return null;
        if (so.status === 'INVOICED' || so.status === 'CANCELLED') return so;
        return (this.prisma as any).salesOrder.update({
            where: { id },
            data: {
                status: 'INVOICED',
                invoicedAt: new Date(),
                transactionId,
            },
        });
    }
}
