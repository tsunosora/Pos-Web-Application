import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface WoItem { size: string; qty: number }
export interface WoPrintPattern { name: string; qty: number; ok?: boolean }
export interface WoQcRow { criteria: string; ok?: boolean; note?: string; inspector?: string }

export class UpsertWorkOrderDto {
    productionJobId!: number;
    woNumber?: string;
    orderDate?: string;
    source?: string;
    designerName?: string;
    deadline?: string;
    customerName?: string;
    collarType?: string;
    fabricType?: string;
    mockupImageUrl?: string;
    printLayoutImageUrl?: string;
    mockupImages?: string[];
    printLayoutImages?: string[];
    shortSleeveItems?: WoItem[];
    longSleeveItems?: WoItem[];
    pantsItems?: WoItem[];
    printPatterns?: WoPrintPattern[];
    qcChecklist?: WoQcRow[];
    tglPrint?: string | null;
    tglPress?: string | null;
    tglJahit?: string | null;
    printInspector?: string;
    jahitInspector?: string;
    notes?: string;
}

// Default QC checklist & pola print sesuai sample WO jersey
const DEFAULT_QC: WoQcRow[] = [
    { criteria: 'Desain Sudah Sesuai' },
    { criteria: 'Jmlh Layout Desain' },
    { criteria: 'Hasil Press' },
    { criteria: 'Jumlah Pola Setelah di Press' },
    { criteria: 'Jahitan' },
];
const DEFAULT_PATTERNS: WoPrintPattern[] = [
    { name: 'Badan Depan', qty: 0 },
    { name: 'Badan Belakang', qty: 0 },
    { name: 'Lengan', qty: 0 },
    { name: 'Kerah', qty: 0 },
];

@Injectable()
export class WorkOrdersService {
    constructor(private readonly prisma: PrismaService) {}

    private get wo(): any { return (this.prisma as any).jerseyWorkOrder; }

    /** Generate kode produksi: NN.DDMMYY.{InitialBahan} mis. 03.070526.M */
    private async genWoNumber(fabricType?: string): Promise<string> {
        const now = new Date();
        const ddmmyy =
            String(now.getDate()).padStart(2, '0') +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getFullYear()).slice(-2);
        const fabricInitial = (fabricType || 'X').trim().charAt(0).toUpperCase();
        // Hitung berapa WO hari ini untuk running number
        const start = new Date(now); start.setHours(0, 0, 0, 0);
        const end = new Date(now); end.setHours(23, 59, 59, 999);
        const countToday = await this.wo.count({
            where: { createdAt: { gte: start, lte: end } },
        });
        const seq = String(countToday + 1).padStart(2, '0');
        return `${seq}.${ddmmyy}.${fabricInitial}`;
    }

    /** Auto-fill data dari job → transaction → lead untuk pre-populate WO baru. */
    private async buildAutofill(productionJobId: number) {
        const job = await (this.prisma as any).productionJob.findUnique({
            where: { id: productionJobId },
            include: {
                transaction: {
                    select: {
                        id: true, customerName: true, createdAt: true,
                        productionDeadline: true, branchId: true,
                    },
                },
                transactionItem: {
                    select: {
                        quantity: true, customName: true,
                        productVariant: { select: { variantName: true, product: { select: { name: true } } } },
                    },
                },
            },
        });
        if (!job) throw new NotFoundException('Production job tidak ditemukan');

        const tx = job.transaction;
        // Cari lead yang convert ke transaksi ini untuk ambil source
        let source: string | null = null;
        if (tx?.id) {
            const lead = await (this.prisma as any).lead.findFirst({
                where: { convertedTransactionId: tx.id },
                select: { source: true },
            });
            source = lead?.source ?? null;
        }

        const itemQty = Number(job.transactionItem?.quantity) || 0;

        return {
            job,
            autofill: {
                orderDate: tx?.createdAt ?? job.createdAt ?? new Date(),
                source,
                designerName: job.designerName ?? null,
                deadline: job.deadline ?? tx?.productionDeadline ?? null,
                customerName: tx?.customerName ?? null,
                branchId: job.branchId ?? tx?.branchId ?? null,
                itemQty,
            },
        };
    }

    async getByJob(productionJobId: number) {
        return this.wo.findUnique({ where: { productionJobId } });
    }

    /**
     * Opsi jenis kerah & bahan untuk dropdown WO.
     * Diambil dari nilai distinct yang pernah disimpan di WO mana pun — jadi nilai
     * custom yang diketik user otomatis muncul sebagai saran di WO berikutnya.
     * Dedup case-insensitive (varian kapitalisasi pertama dipertahankan).
     */
    async getOptions(): Promise<{ collarTypes: string[]; fabricTypes: string[] }> {
        const rows: any[] = await this.wo.findMany({
            select: { collarType: true, fabricType: true },
        });
        const dedup = (vals: (string | null)[]): string[] => {
            const seen = new Map<string, string>(); // lower → original
            for (const v of vals) {
                const t = (v || '').trim();
                if (!t) continue;
                const key = t.toLowerCase();
                if (!seen.has(key)) seen.set(key, t);
            }
            return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, 'id'));
        };
        return {
            collarTypes: dedup(rows.map(r => r.collarType)),
            fabricTypes: dedup(rows.map(r => r.fabricType)),
        };
    }

    async getOne(id: number) {
        const wo = await this.wo.findUnique({ where: { id } });
        if (!wo) throw new NotFoundException('Work Order tidak ditemukan');
        return wo;
    }

    /** Create WO baru dengan auto-fill. Kalau sudah ada untuk job ini → return existing. */
    async create(data: UpsertWorkOrderDto, userId?: number) {
        if (!data.productionJobId) throw new BadRequestException('productionJobId wajib');

        const existing = await this.getByJob(data.productionJobId);
        if (existing) return existing;

        const { autofill } = await this.buildAutofill(data.productionJobId);
        const woNumber = data.woNumber || await this.genWoNumber(data.fabricType);

        return this.wo.create({
            data: {
                productionJobId: data.productionJobId,
                woNumber,
                orderDate: data.orderDate ? new Date(data.orderDate) : autofill.orderDate,
                source: data.source ?? autofill.source,
                designerName: data.designerName ?? autofill.designerName,
                deadline: data.deadline ? new Date(data.deadline) : autofill.deadline,
                customerName: data.customerName ?? autofill.customerName,
                collarType: data.collarType ?? null,
                fabricType: data.fabricType ?? null,
                mockupImages: data.mockupImages ?? [],
                printLayoutImages: data.printLayoutImages ?? [],
                mockupImageUrl: data.mockupImages?.[0] ?? data.mockupImageUrl ?? null,
                printLayoutImageUrl: data.printLayoutImages?.[0] ?? data.printLayoutImageUrl ?? null,
                shortSleeveItems: data.shortSleeveItems ?? [],
                longSleeveItems: data.longSleeveItems ?? [],
                pantsItems: data.pantsItems ?? [],
                printPatterns: data.printPatterns ?? DEFAULT_PATTERNS,
                qcChecklist: data.qcChecklist ?? DEFAULT_QC,
                tglPrint: data.tglPrint ? new Date(data.tglPrint) : null,
                tglPress: data.tglPress ? new Date(data.tglPress) : null,
                tglJahit: data.tglJahit ? new Date(data.tglJahit) : null,
                printInspector: data.printInspector ?? null,
                jahitInspector: data.jahitInspector ?? null,
                notes: data.notes ?? null,
                branchId: autofill.branchId,
                createdById: userId ?? null,
            },
        });
    }

    async update(id: number, data: UpsertWorkOrderDto, userId?: number) {
        await this.getOne(id);
        const patch: any = {};
        const assign = (k: string, v: any) => { if (v !== undefined) patch[k] = v; };

        assign('woNumber', data.woNumber);
        assign('source', data.source);
        assign('designerName', data.designerName);
        assign('customerName', data.customerName);
        assign('collarType', data.collarType);
        assign('fabricType', data.fabricType);
        if (data.mockupImages !== undefined) {
            patch.mockupImages = data.mockupImages;
            patch.mockupImageUrl = data.mockupImages[0] ?? null;
        }
        if (data.printLayoutImages !== undefined) {
            patch.printLayoutImages = data.printLayoutImages;
            patch.printLayoutImageUrl = data.printLayoutImages[0] ?? null;
        }
        assign('shortSleeveItems', data.shortSleeveItems);
        assign('longSleeveItems', data.longSleeveItems);
        assign('pantsItems', data.pantsItems);
        assign('printPatterns', data.printPatterns);
        assign('qcChecklist', data.qcChecklist);
        assign('printInspector', data.printInspector);
        assign('jahitInspector', data.jahitInspector);
        assign('notes', data.notes);
        if (data.orderDate !== undefined) patch.orderDate = data.orderDate ? new Date(data.orderDate) : null;
        if (data.deadline !== undefined) patch.deadline = data.deadline ? new Date(data.deadline) : null;
        if (data.tglPrint !== undefined) patch.tglPrint = data.tglPrint ? new Date(data.tglPrint) : null;
        if (data.tglPress !== undefined) patch.tglPress = data.tglPress ? new Date(data.tglPress) : null;
        if (data.tglJahit !== undefined) patch.tglJahit = data.tglJahit ? new Date(data.tglJahit) : null;

        return this.wo.update({ where: { id }, data: patch });
    }

    async remove(id: number) {
        await this.getOne(id);
        await this.wo.delete({ where: { id } });
        return { ok: true };
    }
}
