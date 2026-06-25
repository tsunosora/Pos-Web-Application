import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DiscordService } from '../discord/discord.service';
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
        private discord: DiscordService,
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
                            priceTiers: {
                                orderBy: { minQty: 'asc' as const },
                                select: { minQty: true, maxQty: true, price: true },
                            },
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

    /**
     * Nomor SO per cabang: SO-{KODE}-{YYYYMMDD}-{NNNN}. Tiap cabang punya urutan
     * harian sendiri (prefix beda → sequence beda), jadi nomor antar cabang tidak
     * bercampur. Tanpa cabang / kode cabang kosong → format lama SO-{YYYYMMDD}-{NNNN}.
     */
    async generateSoNumber(branchName?: string | null): Promise<string> {
        const today = new Date();
        const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        let code = '';
        const branchId = await this.resolveBranchId(branchName);
        if (branchId != null) {
            const b = await (this.prisma as any).companyBranch.findUnique({
                where: { id: branchId }, select: { code: true },
            });
            code = (b?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
        const prefix = code ? `SO-${code}-${yyyymmdd}-` : `SO-${yyyymmdd}-`;
        // Hitung urutan dari MAX NUMERIK (bukan orderBy teks) — kebal terhadap
        // padding lama 3 digit & data campur. orderBy teks bisa salah karena
        // "036" > "0037" secara string → menghasilkan nomor duplikat.
        const rows = await (this.prisma as any).salesOrder.findMany({
            where: { soNumber: { startsWith: prefix } },
            select: { soNumber: true },
        });
        let maxN = 0;
        for (const r of rows) {
            const n = parseInt(String(r.soNumber).slice(prefix.length), 10);
            if (Number.isFinite(n) && n > maxN) maxN = n;
        }
        return `${prefix}${String(maxN + 1).padStart(4, '0')}`;
    }

    /**
     * Resolve nama-nama cabang yang relevan untuk filter SO berdasarkan branchId.
     * SO simpan `branchName` (string), tidak punya FK branchId. Untuk match akurat:
     * - Ambil CompanyBranch.name + code
     * - Return array nama yang mungkin tersimpan di SO.branchName
     *   (cover variasi: nama persis, code, atau nama mengandung code)
     */
    private async resolveBranchNamesForFilter(branchId: number): Promise<string[] | null> {
        try {
            const branch = await (this.prisma as any).companyBranch.findUnique({
                where: { id: branchId },
                select: { name: true, code: true },
            });
            if (!branch) return null;
            const names: string[] = [branch.name];
            if (branch.code) names.push(branch.code);
            return names;
        } catch {
            return null;
        }
    }

    /** Build WHERE clause untuk filter SO per cabang. Owner mode null = no filter. */
    private async branchFilter(branchId: number | null): Promise<any> {
        if (branchId == null) return {}; // Owner "Semua Cabang"
        const names = await this.resolveBranchNamesForFilter(branchId);
        if (!names || !names.length) return { branchName: '__no_branch_match__' }; // pasti kosong
        return {
            OR: [
                { branchName: { in: names } },
                // Fallback: cocok kalau branchName mengandung salah satu name/code (mis. "Cab Sewon" match "Voliko Cabang Sewon")
                ...names.map(n => ({ branchName: { contains: n } })),
            ],
        };
    }

    /** Bangun where dasar (branch + search + designer), TANPA filter status. */
    private async buildListWhere(search?: string, designerName?: string, branchId?: number | null) {
        const where: any = await this.branchFilter(branchId ?? null);
        if (designerName) where.designerName = designerName;
        if (search && search.trim()) {
            const q = search.trim();
            // Gabungkan dengan branch filter pakai AND supaya search & branch dua-duanya mandatory
            const searchOR = [
                { soNumber: { contains: q } },
                { customerName: { contains: q } },
                { customerPhone: { contains: q } },
            ];
            if (where.OR) {
                // Sudah ada OR dari branch filter — pindahkan ke AND
                const branchOR = where.OR;
                delete where.OR;
                where.AND = [{ OR: branchOR }, { OR: searchOR }];
            } else {
                where.OR = searchOR;
            }
        }
        return where;
    }

    async list(status?: SalesOrderStatus, search?: string, designerName?: string, branchId?: number | null) {
        const where = await this.buildListWhere(search, designerName, branchId);
        if (status) where.status = status;
        return (this.prisma as any).salesOrder.findMany({
            where,
            include: this.soInclude(),
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Versi paginasi untuk halaman admin — kembalikan baris satu halaman + total +
     * counts per status (lingkup branch+search, mengabaikan tab status aktif) untuk
     * kartu ringkasan & badge tab. Mencegah load semua SO sekaligus.
     */
    async listPaged(opts: {
        status?: SalesOrderStatus;
        search?: string;
        designerName?: string;
        branchId?: number | null;
        page?: number;
        pageSize?: number;
    } = {}) {
        const { status, search, designerName, branchId, page = 1, pageSize = 20 } = opts;
        const baseWhere = await this.buildListWhere(search, designerName, branchId);

        // counts per status — sekali query groupBy
        const grouped: any[] = await (this.prisma as any).salesOrder.groupBy({
            by: ['status'],
            where: baseWhere,
            _count: { _all: true },
        });
        const counts: Record<string, number> = { ALL: 0, DRAFT: 0, SENT: 0, INVOICED: 0, CANCELLED: 0 };
        for (const g of grouped) {
            counts[g.status] = g._count._all;
            counts.ALL += g._count._all;
        }

        const where = status ? { ...baseWhere, status } : baseWhere;
        const total = status ? (counts[status] ?? 0) : counts.ALL;
        const take = Math.min(Math.max(Number(pageSize) || 20, 1), 100);
        const safePage = Math.max(Number(page) || 1, 1);

        const rows = await (this.prisma as any).salesOrder.findMany({
            where,
            include: this.soInclude(),
            orderBy: { createdAt: 'desc' },
            skip: (safePage - 1) * take,
            take,
        });

        return { rows, total, page: safePage, pageSize: take, counts };
    }

    async findOne(id: number, branchId?: number | null) {
        const so = await (this.prisma as any).salesOrder.findUnique({
            where: { id },
            include: this.soInclude(),
        });
        if (!so) throw new NotFoundException('Surat Order tidak ditemukan');
        // Cek scoping: kalau branchId di-pass (staff), pastikan SO ini miliknya
        if (branchId != null) {
            const names = await this.resolveBranchNamesForFilter(branchId);
            if (names && names.length) {
                const soBranch: string = (so as any).branchName ?? '';
                const match = names.some(n => soBranch === n || soBranch.toLowerCase().includes(n.toLowerCase()));
                if (!match) {
                    throw new NotFoundException('Surat Order tidak ditemukan di cabang Anda');
                }
            }
        }
        return so;
    }

    /**
     * Cari SO yang masih aktif (DRAFT/SENT, belum jadi nota) milik customer tertentu.
     * Dipakai untuk memperingatkan CS saat mau convert lead/buat nota: kalau sudah ada
     * SO, sebaiknya "Buat dari SO" itu — bukan nota baru (cegah nota dobel).
     */
    async findActiveByCustomer(query: string, branchId?: number | null) {
        const q = (query || '').trim();
        if (!q) return [];
        const branchWhereClause = await this.branchFilter(branchId ?? null);
        const digits = q.replace(/\D/g, '');
        const or: any[] = [{ customerName: { contains: q } }];
        if (digits.length >= 4) or.push({ customerPhone: { contains: digits } });
        const list = await (this.prisma as any).salesOrder.findMany({
            where: { AND: [branchWhereClause, { status: { in: ['DRAFT', 'SENT'] } }, { OR: or }] },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
                id: true, soNumber: true, status: true, customerName: true,
                customerPhone: true, designerName: true, createdAt: true,
            },
        });
        return list;
    }

    async pendingInvoiceCount(branchId?: number | null) {
        const where: any = await this.branchFilter(branchId ?? null);
        where.status = 'SENT';
        const count = await (this.prisma as any).salesOrder.count({ where });
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

        // Lapis pengaman konkurensi: kalau nomor SO keburu dipakai proses lain
        // (P2002 unique), regenerate & ulang. generateSoNumber sudah max-numerik.
        let so: any;
        for (let attempt = 0; ; attempt++) {
            const soNumber = await this.generateSoNumber(branchName);
            try {
                so = await (this.prisma as any).salesOrder.create({
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
                break;
            } catch (e: any) {
                if (e?.code === 'P2002' && attempt < 5) continue;
                throw e;
            }
        }
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

        // Ganti items selama SO belum di-invoice/dibatalkan (DRAFT atau SENT).
        // Guard INVOICED/CANCELLED sudah di atas. Ini supaya salah input bahan/qty
        // bisa diperbaiki tanpa bikin SO baru, meski sudah terkirim ke Discord.
        if (data.items) {
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

    private buildCaption(so: any, customMessage?: string, footer = '_Silakan kasir segera dibuatkan nota._'): string {
        const lines: string[] = [];
        lines.push(`*SURAT ORDER ${so.soNumber}*`);
        lines.push('');
        lines.push(`Pelanggan: ${so.customerName}`);
        if (so.customerPhone) lines.push(`HP: ${so.customerPhone}`);
        lines.push(`Desainer: ${so.designerName}`);
        if (so.branchName) lines.push(`Cabang: ${so.branchName}`);
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
        lines.push(footer);
        return lines.join('\n');
    }

    /**
     * "Lead Order" dari portal desainer: buat Lead CRM dari SO ini, langsung TERTAUT
     * (convertedSalesOrderId) — alur designer-first. CS tinggal follow-up/nego; saat SO
     * di-checkout di POS, lead otomatis CLOSED_WON ke nota yang sama (hook transactions).
     * Idempoten: kalau sudah ada lead tertaut ke SO ini, kembalikan yang lama.
     */
    /**
     * Preview lead aktif untuk satu nomor HP — dipakai halaman buat SO desainer
     * supaya desainer tahu customer ini sudah punya lead aktif (biasanya dari CS),
     * sebelum memutuskan "Lead Order" (yang akan menempel ke lead itu — satu pintu)
     * atau memang order baru yang berbeda. Read-only, ringan.
     */
    async lookupActiveLeadsByPhone(phone: string) {
        if (!phone) return [];
        let s = phone.replace(/\D/g, '');
        if (s.startsWith('62')) s = s.slice(2);
        if (s.startsWith('0')) s = s.slice(1);
        if (!s || s.length < 5) return []; // butuh cukup digit agar tidak match terlalu lebar

        const leads = await (this.prisma as any).lead.findMany({
            where: {
                phoneNormalized: s,
                status: { notIn: ['CLOSED_WON', 'CLOSED_LOST', 'INVALID'] },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: this.LEAD_PREVIEW_INCLUDE,
        });

        return leads.map((l: any) => this.mapLeadPreview(l));
    }

    private readonly LEAD_PREVIEW_INCLUDE = {
        assignedTo: { select: { name: true } },
        createdBy: { select: { name: true } },
        convertedSO: { select: { id: true, soNumber: true } },
        branch: { select: { name: true } },
        items: { select: { id: true } },
    };

    private mapLeadPreview(l: any) {
        return {
            id: l.id,
            name: l.name,
            phone: l.phone,
            status: l.status,
            level: l.level,
            source: l.source,
            sourceDetail: l.sourceDetail,
            needs: l.needs,
            estimatedValue: l.estimatedValue != null ? Number(l.estimatedValue) : null,
            // siapa CS yang menangani / membuat lead ini
            assignedToName: l.assignedTo?.name ?? null,
            createdByName: l.createdBy?.name ?? null,
            designerName: l.designerName ?? null,
            branchName: l.branch?.name ?? null,
            // sudah ada SO desainer yang tertaut?
            hasSO: !!l.convertedSalesOrderId,
            soNumber: l.convertedSO?.soNumber ?? null,
            itemCount: l.items?.length ?? 0,
            followUpDate: l.followUpDate,
            createdAt: l.createdAt,
            // asal lead: dibuat desainer (dari SO) vs dibuat CS (manual)
            origin: l.sourceDetail === 'SO Desainer' ? 'DESIGNER' : 'CS',
        };
    }

    /**
     * Daftar lead AKTIF dari CS yang belum punya SO — ditampilkan sebagai kartu di
     * halaman buat SO desainer. Desainer cukup klik kartu untuk mengisi data customer
     * (dan SO otomatis ditempel ke lead itu saat "Lead Order"). Lead yang dibuat dari
     * SO desainer sendiri dikecualikan (bukan antrian CS).
     */
    async listActiveCsLeads() {
        const leads = await (this.prisma as any).lead.findMany({
            where: {
                status: { notIn: ['CLOSED_WON', 'CLOSED_LOST', 'INVALID'] },
                convertedSalesOrderId: null,             // belum ada SO = antrian yg butuh desainer
                NOT: { sourceDetail: 'SO Desainer' },    // hanya lead buatan CS
            },
            orderBy: { createdAt: 'desc' },
            take: 60,
            include: this.LEAD_PREVIEW_INCLUDE,
        });
        return leads.map((l: any) => this.mapLeadPreview(l));
    }

    /**
     * @param opts.targetLeadId  Tempel SO ke lead spesifik ini (desainer pilih dari banner lead aktif).
     * @param opts.forceNewLead  Paksa buat lead baru terpisah (repeat order yang berbeda) — lewati satu pintu.
     */
    async createLeadFromSO(id: number, opts?: { targetLeadId?: number; forceNewLead?: boolean }) {
        const so = await this.findOne(id);
        if (so.status === 'INVOICED' || so.status === 'CANCELLED') {
            throw new BadRequestException('SO yang sudah jadi nota / dibatalkan tidak bisa dijadikan lead');
        }

        // Estimasi nilai order dari item SO (kasar, untuk kolom estimatedValue lead)
        let estimate = 0;
        for (const it of so.items || []) {
            const qty = Number(it.quantity) || 1;
            let price = Number(it.customPrice ?? it.productVariant?.price ?? 0);
            // Harga tier (mode UNIT, sama dengan resolusi di transactions.service):
            // customPrice tetap menang; tanpa customPrice, cocokkan qty ke tier varian
            if (it.customPrice == null && it.productVariant?.product?.pricingMode !== 'AREA_BASED') {
                const tiers: any[] = it.productVariant?.priceTiers || [];
                const hit = tiers.find((t: any) => qty >= t.minQty && (t.maxQty == null || qty <= t.maxQty));
                if (hit) price = Number(hit.price);
            }
            const pcs = Number(it.pcs) > 1 ? Number(it.pcs) : 1;
            let units = 1;
            if (it.widthCm && it.heightCm) {
                units = it.unitType === 'cm'
                    ? (Number(it.widthCm) * Number(it.heightCm)) / 10000
                    : Number(it.widthCm) * Number(it.heightCm);
            } else if (it.unitType === 'menit' && it.widthCm) {
                units = Number(it.widthCm);
            }
            estimate += Math.round(price * units * qty * pcs);
        }

        const branchId = await this.resolveBranchId((so as any).branchName);
        const phone: string | null = so.customerPhone ?? null;
        // Normalisasi sama dengan leads.service: strip non-digit, drop leading 62/0
        let phoneNormalized: string | null = null;
        if (phone) {
            let s = phone.replace(/\D/g, '');
            if (s.startsWith('62')) s = s.slice(2);
            if (s.startsWith('0')) s = s.slice(1);
            phoneNormalized = s || null;
        }

        const imagePaths = (so.proofs || []).map((p: any) => p.filename);

        const existing = await (this.prisma as any).lead.findFirst({
            where: { convertedSalesOrderId: id },
        });

        // ── SO direvisi desainer: sinkronkan lead yang sudah ada ──────────────
        // Lead yang sudah closing/lost/invalid tidak disentuh. Data yang diisi CS
        // (sumber, CS yang menangani, status, level) juga tidak ditimpa.
        if (existing) {
            if (['CLOSED_WON', 'CLOSED_LOST', 'INVALID'].includes(existing.status)) {
                return { lead: existing, existing: true };
            }
            const lead = await (this.prisma as any).lead.update({
                where: { id: existing.id },
                data: {
                    name: so.customerName,
                    phone,
                    phoneNormalized,
                    needs: so.notes ?? null,
                    estimatedValue: estimate > 0 ? estimate : null,
                },
            });
            await this.syncLeadImagesFromSO(so, existing.id);
            await (this.prisma as any).leadActivity.create({
                data: {
                    leadId: existing.id,
                    kind: 'NOTE',
                    text: `SO ${so.soNumber} direvisi oleh desainer ${so.designerName} — data & gambar lead disinkronkan (Lead Order)`,
                    meta: { salesOrderId: so.id, revised: true } as any,
                    createdById: null,
                },
            });

            // Notif revisi — embed kuning, beda dari notif lead baru
            this.discord.notifyLeadOrderRevised({
                name: so.customerName,
                soNumber: so.soNumber || undefined,
                designerName: so.designerName || undefined,
                estimatedValue: estimate > 0 ? estimate : undefined,
                needs: so.notes ?? undefined,
                deadline: so.deadline ?? null,
                branchLabel: (so as any).branchName || undefined,
                branchId,
                imagePaths,
            });
            // Kabari #produksi juga bahwa versi sebelumnya tidak berlaku
            const revCaption = this.buildCaption(
                so, undefined,
                '_⚠️ REVISI Lead Order — abaikan versi sebelumnya; CS masih follow-up._',
            );
            this.discord.notifySuratOrder(revCaption, imagePaths, branchId);

            return { lead, existing: true, revised: true };
        }

        // ── SATU PINTU (dengan pilihan desainer) ──────────────────────────────
        // Default: tempel ke lead aktif HP-sama yang belum punya SO (anti lead dobel).
        // - forceNewLead: desainer pilih "buat lead baru terpisah" (repeat order yg berbeda)
        // - targetLeadId: desainer pilih lead spesifik untuk ditempeli SO ini
        let csLead: any = null;
        if (!opts?.forceNewLead && phoneNormalized) {
            const baseWhere = {
                phoneNormalized,
                status: { notIn: ['CLOSED_WON', 'CLOSED_LOST', 'INVALID'] },
                convertedSalesOrderId: null,
            };
            if (opts?.targetLeadId) {
                csLead = await (this.prisma as any).lead.findFirst({
                    where: { ...baseWhere, id: opts.targetLeadId },
                });
                if (!csLead) {
                    throw new BadRequestException(
                        'Lead tujuan tidak bisa menerima SO ini (mungkin sudah closing/dibatalkan atau sudah punya SO lain). Muat ulang halaman lalu pilih lagi.',
                    );
                }
            } else {
                csLead = await (this.prisma as any).lead.findFirst({
                    where: baseWhere,
                    orderBy: { createdAt: 'desc' },
                });
            }
        }
        {
            if (csLead) {
                const lead = await (this.prisma as any).lead.update({
                    where: { id: csLead.id },
                    data: {
                        convertedSalesOrderId: so.id,
                        status: 'NEGOTIATION',
                        // jangan timpa data yang sudah diisi CS — hanya lengkapi yang kosong
                        name: csLead.name || so.customerName,
                        phone: csLead.phone ?? phone,
                        phoneNormalized: csLead.phoneNormalized ?? phoneNormalized,
                        needs: csLead.needs ?? (so.notes ?? null),
                        estimatedValue: csLead.estimatedValue ?? (estimate > 0 ? estimate : null),
                    },
                });
                await this.syncLeadImagesFromSO(so, csLead.id);
                await (this.prisma as any).leadActivity.create({
                    data: {
                        leadId: csLead.id,
                        kind: 'NOTE',
                        text: `SO ${so.soNumber} dari desainer ${so.designerName} ditautkan ke lead CS ini (satu pintu — tanpa lead dobel).`,
                        meta: { salesOrderId: so.id, merged: true } as any,
                        createdById: null,
                    },
                });
                this.discord.notifyLeadOrderRevised({
                    name: so.customerName,
                    soNumber: so.soNumber || undefined,
                    designerName: so.designerName || undefined,
                    estimatedValue: estimate > 0 ? estimate : undefined,
                    needs: so.notes ?? undefined,
                    deadline: so.deadline ?? null,
                    branchLabel: (so as any).branchName || undefined,
                    branchId,
                    imagePaths,
                });
                const mergeCaption = this.buildCaption(
                    so, undefined,
                    '_SO ditautkan ke lead CS yang sudah ada (satu pintu) — CS follow-up; nota dari SO ini setelah deal._',
                );
                this.discord.notifySuratOrder(mergeCaption, imagePaths, branchId);
                return { lead, existing: true, merged: true };
            }
        }

        const lead = await (this.prisma as any).lead.create({
            data: {
                name: so.customerName,
                phone,
                phoneNormalized,
                source: 'OTHER',
                sourceDetail: 'SO Desainer',
                status: 'NEGOTIATION', // sudah ada SO = harga/desain sedang dibahas
                level: 'HOT',
                needs: so.notes ?? null,
                estimatedValue: estimate > 0 ? estimate : null,
                branchId,
                intakeAt: new Date(),
                convertedSalesOrderId: so.id,
            },
        });
        await (this.prisma as any).leadActivity.create({
            data: {
                leadId: lead.id,
                kind: 'NOTE',
                text: `Lead dibuat dari Surat Order ${so.soNumber} oleh desainer ${so.designerName} (Lead Order)`,
                meta: { salesOrderId: so.id } as any,
                createdById: null,
            },
        });

        // Salin gambar proof SO ke galeri lead (lihat syncLeadImagesFromSO)
        await this.syncLeadImagesFromSO(so, lead.id);

        // Beritahu CS via Discord (#penjualan cabang) — gambar desain SO ikut
        // dilampirkan supaya desainer tidak perlu kirim manual lagi
        this.discord.notifyNewLead({
            name: so.customerName,
            phone: phone || undefined,
            source: `SO Desainer (${so.designerName})`,
            estimatedValue: estimate > 0 ? estimate : undefined,
            soNumber: so.soNumber || undefined,
            level: 'HOT',
            needs: so.notes ?? undefined,
            deadline: so.deadline ?? null,
            branchLabel: (so as any).branchName || undefined,
            branchId,
            imagePaths,
        });

        // Broadcast SO + gambar ke #produksi cabang juga, dengan footer khusus
        // lead (nota belum dibuat — masih tahap follow-up CS)
        const caption = this.buildCaption(
            so, undefined,
            '_Lead Order — CS sedang follow-up; nota dibuat dari SO ini setelah deal._',
        );
        this.discord.notifySuratOrder(caption, imagePaths, branchId);

        return { lead, existing: false };
    }

    /**
     * Salin gambar proof SO → galeri lead. File di-COPY (bukan referensi) karena
     * removeProof menghapus file fisik — galeri lead harus tetap utuh.
     * Saat sinkron ulang (SO direvisi), salinan lama dari SO yang sama (prefix
     * `lead-so{id}-`) dibuang dulu; gambar yang di-upload CS sendiri tidak disentuh.
     */
    private async syncLeadImagesFromSO(so: any, leadId: number) {
        const prefix = `/uploads/lead-so${so.id}-`;
        // Buang salinan lama dari SO ini (row + file fisik, best-effort)
        try {
            const olds: any[] = await (this.prisma as any).leadImage.findMany({
                where: { leadId, filename: { startsWith: prefix } },
                select: { filename: true },
            });
            for (const img of olds) {
                try {
                    const abs = path.join(process.cwd(), 'public', img.filename.replace(/^\//, ''));
                    if (fs.existsSync(abs)) fs.unlinkSync(abs);
                } catch { /* ignore */ }
            }
            await (this.prisma as any).leadImage.deleteMany({
                where: { leadId, filename: { startsWith: prefix } },
            });
        } catch { /* ignore — gagal bersih-bersih tidak menggagalkan sync */ }

        const proofs: any[] = so.proofs || [];
        const leadImages: { url: string; caption: string | null }[] = [];
        try { fs.mkdirSync(path.join(process.cwd(), 'public/uploads'), { recursive: true }); } catch { /* ignore */ }
        for (let i = 0; i < proofs.length; i++) {
            try {
                const src = path.join(process.cwd(), proofs[i].filename);
                if (!fs.existsSync(src)) continue;
                const ext = path.extname(proofs[i].filename) || '.png';
                const name = `lead-so${so.id}-${Date.now()}-${i}${ext}`;
                fs.copyFileSync(src, path.join(process.cwd(), 'public/uploads', name));
                leadImages.push({ url: `/uploads/${name}`, caption: proofs[i].caption ?? null });
            } catch { /* best-effort — gambar gagal disalin tidak menggagalkan lead */ }
        }
        if (leadImages.length) {
            // Posisi lanjut setelah gambar lain yang masih ada (mis. upload CS)
            const maxPos = await (this.prisma as any).leadImage.aggregate({
                where: { leadId }, _max: { position: true },
            });
            const base = (maxPos?._max?.position ?? -1) + 1;
            await (this.prisma as any).leadImage.createMany({
                data: leadImages.map((img, i) => ({
                    leadId, filename: img.url, position: base + i, caption: img.caption,
                })),
            });
        }
        // Backward compat: Lead.imageUrl = gambar pertama di galeri saat ini
        const first = await (this.prisma as any).leadImage.findFirst({
            where: { leadId }, orderBy: { position: 'asc' }, select: { filename: true },
        });
        await (this.prisma as any).lead.update({
            where: { id: leadId }, data: { imageUrl: first?.filename ?? null } as any,
        });
    }

    /** Resolve nama cabang (teks di SO) → branchId, untuk routing webhook Discord per cabang. */
    private async resolveBranchId(branchName?: string | null): Promise<number | null> {
        if (!branchName?.trim()) return null;
        try {
            const branches: any[] = await (this.prisma as any).companyBranch.findMany({
                where: { isActive: true }, select: { id: true, name: true, code: true },
            });
            const q = branchName.toLowerCase().trim();
            const hit = branches.find(b => b.name?.toLowerCase().trim() === q)
                || branches.find(b => (b.code || '').toLowerCase() === q)
                || branches.find(b => b.name?.toLowerCase().includes(q) || q.includes((b.name || '').toLowerCase()));
            return hit?.id ?? null;
        } catch { return null; }
    }

    /** Kirim Surat Order ke Discord channel #produksi cabang (pengganti grup WA desain). */
    async sendToDesignChannel(id: number, customMessage?: string) {
        const so = await this.findOne(id);
        if (so.status === 'INVOICED' || so.status === 'CANCELLED') {
            throw new BadRequestException('SO yang sudah diinvoice / dibatalkan tidak dapat dikirim ulang');
        }

        const caption = this.buildCaption(so, customMessage);
        const imagePaths = (so.proofs || []).map((p: any) => p.filename);
        const branchId = await this.resolveBranchId((so as any).branchName);

        const ok = await this.discord.notifySuratOrder(caption, imagePaths, branchId);
        if (!ok) {
            throw new BadRequestException(
                'Gagal kirim Surat Order ke Discord. Pastikan notifikasi Discord aktif, event "Surat Order" menyala, ' +
                'dan webhook channel Produksi terisi (Settings → Discord).',
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
