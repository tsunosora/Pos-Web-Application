import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { branchWhere, requireBranch } from '../../common/branch-where.helper';
import type { BranchContext } from '../../common/branch-context.decorator';
import { CloseLostDto, ConvertLeadDto, CreateActivityDto, CreateLeadDto, LeadItemDto, UpdateLeadDto } from './leads.dto';
import { TransactionsService } from '../../transactions/transactions.service';
import { DiscordService } from '../../discord/discord.service';

/** Normalisasi nomor HP untuk dedup: strip non-digit, drop leading 62/0. */
function normalizePhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    let s = String(raw).replace(/\D/g, '');
    if (s.startsWith('62')) s = s.slice(2);
    if (s.startsWith('0')) s = s.slice(1);
    return s || null;
}

@Injectable()
export class LeadsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly transactionsService: TransactionsService,
        private readonly discord: DiscordService,
    ) {}

    private async generateSoNumber(branchId?: number | null): Promise<string> {
        // Pattern sama dengan sales-orders.service: SO-{KODE}-{YYYYMMDD}-{NNN}
        // per cabang (urutan tiap cabang terpisah); tanpa cabang → SO-{YYYYMMDD}-{NNN}.
        const today = new Date();
        const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        let code = '';
        if (branchId != null) {
            const b: any = await (this.prisma as any).companyBranch.findUnique({
                where: { id: branchId }, select: { code: true },
            });
            code = (b?.code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        }
        const prefix = code ? `SO-${code}-${yyyymmdd}` : `SO-${yyyymmdd}`;
        const last = await this.prisma.salesOrder.findFirst({
            where: { soNumber: { startsWith: `${prefix}-` } },
            orderBy: { soNumber: 'desc' },
        });
        let n = 1;
        if (last) {
            const tail = last.soNumber.split('-').pop() || '0';
            n = parseInt(tail, 10) + 1;
        }
        return `${prefix}-${String(n).padStart(3, '0')}`;
    }

    /** List + filter + search. */
    async list(ctx: BranchContext, params: {
        status?: string;
        source?: string;
        assignedToId?: number;
        level?: string;
        dateFrom?: string;
        dateTo?: string;
        search?: string;
        page?: number;
        limit?: number;
    }) {
        const where: Prisma.LeadWhereInput = { ...branchWhere(ctx) };
        if (params.status) where.status = params.status as LeadStatus;
        if (params.source) where.source = params.source as any;
        if (params.assignedToId) where.assignedToId = params.assignedToId;
        if (params.level) where.level = params.level as any;
        if (params.dateFrom || params.dateTo) {
            const createdAtFilter: Prisma.DateTimeFilter = {};
            if (params.dateFrom) createdAtFilter.gte = new Date(params.dateFrom);
            if (params.dateTo) {
                const to = new Date(params.dateTo);
                to.setHours(23, 59, 59, 999);
                createdAtFilter.lte = to;
            }
            where.createdAt = createdAtFilter;
        }
        if (params.search) {
            const norm = normalizePhone(params.search);
            where.OR = [
                { name: { contains: params.search } },
                { phoneNormalized: norm ? { contains: norm } : undefined },
                { city: { contains: params.search } },
                { needs: { contains: params.search } },
            ].filter(Boolean) as any;
        }

        const page = Math.max(1, params.page || 1);
        const limit = Math.min(200, Math.max(1, params.limit || 50));
        const [items, total] = await this.prisma.$transaction([
            this.prisma.lead.findMany({
                where,
                orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
                include: {
                    assignedTo: { select: { id: true, name: true, email: true } },
                    branch: { select: { id: true, name: true, code: true } },
                    convertedCustomer: { select: { id: true, name: true, phone: true } },
                    convertedSO: { select: { id: true, soNumber: true } },
                    _count: { select: { activities: true } },
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            this.prisma.lead.count({ where }),
        ]);

        return { items, total, page, limit };
    }

    /** Status summary untuk badge + dashboard. */
    async statusSummary(ctx: BranchContext) {
        const grouped = await this.prisma.lead.groupBy({
            by: ['status'],
            where: branchWhere(ctx),
            _count: { _all: true },
        });
        const summary: Record<string, number> = {
            NEW: 0, FOLLOW_UP: 0, NEGOTIATION: 0, CLOSED_WON: 0, CLOSED_LOST: 0, INVALID: 0,
        };
        for (const g of grouped) summary[g.status] = g._count._all;
        return summary;
    }

    async detail(ctx: BranchContext, id: number) {
        const hasLeadItemModel = !!(this.prisma as any).leadItem?.findMany;
        const includeBase: any = {
            assignedTo: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true } },
            branch: { select: { id: true, name: true, code: true } },
            convertedCustomer: { select: { id: true, name: true, phone: true } },
            convertedSO: { select: { id: true, soNumber: true } },
            activities: {
                orderBy: { createdAt: 'desc' },
                take: 100,
                include: { createdBy: { select: { id: true, name: true } } },
            },
        };
        if (hasLeadItemModel) {
            includeBase.items = {
                orderBy: { id: 'asc' },
                include: {
                    productVariant: {
                        select: {
                            id: true, sku: true, variantName: true, price: true,
                            product: { select: { id: true, name: true, pricingMode: true } },
                        },
                    },
                },
            };
        }

        const lead: any = await this.prisma.lead.findUnique({
            where: { id },
            include: includeBase,
        });
        if (!lead) throw new NotFoundException('Lead tidak ditemukan');

        // Fallback: load items via raw SQL kalau Prisma client tidak punya model
        if (!hasLeadItemModel && lead) {
            const rawItems: any[] = await this.prisma.$queryRawUnsafe(`
                SELECT li.id, li.lead_id AS leadId, li.product_variant_id AS productVariantId,
                       li.description, li.quantity, li.unit_price AS unitPrice,
                       li.width_cm AS widthCm, li.height_cm AS heightCm,
                       li.unit_type AS unitType, li.note,
                       pv.sku AS pv_sku, pv.variant_name AS pv_variantName, pv.price AS pv_price,
                       p.id AS p_id, p.name AS p_name, p.pricing_mode AS p_pricingMode
                FROM lead_items li
                LEFT JOIN product_variants pv ON pv.id = li.product_variant_id
                LEFT JOIN products p ON p.id = pv.product_id
                WHERE li.lead_id = ?
                ORDER BY li.id ASC
            `, id);
            lead.items = (rawItems as any[]).map((r) => ({
                id: Number(r.id),
                leadId: Number(r.leadId),
                productVariantId: r.productVariantId != null ? Number(r.productVariantId) : null,
                description: r.description,
                quantity: Number(r.quantity),
                unitPrice: Number(r.unitPrice),
                widthCm: r.widthCm != null ? Number(r.widthCm) : null,
                heightCm: r.heightCm != null ? Number(r.heightCm) : null,
                unitType: r.unitType,
                note: r.note,
                productVariant: r.productVariantId != null ? {
                    id: Number(r.productVariantId),
                    sku: r.pv_sku,
                    variantName: r.pv_variantName,
                    price: Number(r.pv_price),
                    product: r.p_id != null ? {
                        id: Number(r.p_id),
                        name: r.p_name,
                        pricingMode: r.p_pricingMode,
                    } : null,
                } : null,
            }));
        }
        // Branch isolation: staff cabang lain tidak boleh akses lead cabang lain
        if (!ctx.isOwner && lead.branchId != null && lead.branchId !== ctx.userBranchId) {
            throw new NotFoundException('Lead tidak ditemukan');
        }

        // Always load images (multi). Tidak include via Prisma — defensive.
        lead.images = await this._loadImages(id);

        return lead;
    }

    /**
     * Hitung subtotal item — AREA_BASED kalau widthCm & heightCm ter-isi.
     * Formula:
     *   AREA_BASED: qty × (w × h / 10000) × unitPrice  (unitPrice = harga per m²)
     *   UNIT      : qty × unitPrice
     */
    private calcItemSubtotal(item: { quantity?: number; unitPrice?: number; widthCm?: number | null; heightCm?: number | null }): number {
        const qty = Number(item.quantity) || 0;
        const price = Number(item.unitPrice) || 0;
        const w = Number(item.widthCm) || 0;
        const h = Number(item.heightCm) || 0;
        if (w > 0 && h > 0) {
            const areaM2 = (w * h) / 10000;
            return qty * areaM2 * price;
        }
        return qty * price;
    }

    /** Sum total value dari array items. Dipakai auto-calc estimatedValue. */
    private sumItemsTotal(items: LeadItemDto[] | undefined): number {
        if (!items?.length) return 0;
        return items.reduce((s, it) => s + this.calcItemSubtotal(it), 0);
    }

    /**
     * Replace semua images untuk lead — pakai LeadImage model. Backward compat:
     * juga update Lead.imageUrl = first image (legacy code yang baca single field
     * tetap jalan). Defensive raw SQL fallback.
     */
    private async _syncImages(leadId: number, urls: string[]) {
        const hasModel = !!(this.prisma as any).leadImage?.deleteMany;
        if (hasModel) {
            await (this.prisma as any).leadImage.deleteMany({ where: { leadId } });
        } else {
            await this.prisma.$executeRawUnsafe(`DELETE FROM lead_images WHERE lead_id = ?`, leadId);
        }
        if (urls.length === 0) {
            // Reset Lead.imageUrl juga
            await (this.prisma as any).lead.update({
                where: { id: leadId }, data: { imageUrl: null },
            });
            return;
        }
        const rows = urls.map((url, i) => ({
            leadId, filename: url, position: i, caption: null,
        }));
        if (hasModel) {
            await (this.prisma as any).leadImage.createMany({ data: rows });
        } else {
            for (const r of rows) {
                await this.prisma.$executeRawUnsafe(
                    `INSERT INTO lead_images (lead_id, filename, position, caption) VALUES (?, ?, ?, ?)`,
                    r.leadId, r.filename, r.position, r.caption,
                );
            }
        }
        // Backward compat: Lead.imageUrl = first image
        await (this.prisma as any).lead.update({
            where: { id: leadId }, data: { imageUrl: urls[0] },
        });
    }

    /**
     * Sinkronisasi auto FollowUp task dari Lead.followUpDate.
     * Aturan:
     * - Kalau followUpDate ada → upsert 1 pending FollowUp type=LEAD_FU.
     *   - Kalau sudah ada pending LEAD_FU untuk lead ini → update dueDate-nya saja.
     *   - Kalau belum ada → create baru.
     * - Kalau followUpDate dihapus (null) → batalkan pending LEAD_FU (set SKIPPED).
     * Defensive raw SQL fallback kalau Prisma client belum punya model.
     */
    private async _syncLeadFollowUp(params: {
        leadId: number;
        followUpDate: Date | null;
        branchId: number;
        assignedToId: number | null;
        leadName: string;
    }) {
        const hasModel = !!(this.prisma as any).followUp?.findFirst;
        const findPending = async () => {
            if (hasModel) {
                return await (this.prisma as any).followUp.findFirst({
                    where: { leadId: params.leadId, type: 'LEAD_FU', status: 'PENDING' },
                });
            }
            const rows: any[] = await this.prisma.$queryRawUnsafe(
                `SELECT id FROM follow_ups WHERE lead_id = ? AND type = 'LEAD_FU' AND status = 'PENDING' LIMIT 1`,
                params.leadId,
            );
            return rows[0] || null;
        };

        try {
            const existing = await findPending();

            // Case 1: tanggal dihapus → skip pending FU
            if (!params.followUpDate) {
                if (existing) {
                    if (hasModel) {
                        await (this.prisma as any).followUp.update({
                            where: { id: existing.id }, data: { status: 'SKIPPED' },
                        });
                    } else {
                        await this.prisma.$executeRawUnsafe(
                            `UPDATE follow_ups SET status = 'SKIPPED', updated_at = NOW() WHERE id = ?`,
                            existing.id,
                        );
                    }
                }
                return;
            }

            // Case 2: ada pending → update dueDate
            if (existing) {
                if (hasModel) {
                    await (this.prisma as any).followUp.update({
                        where: { id: existing.id },
                        data: { dueDate: params.followUpDate, assignedToId: params.assignedToId ?? null },
                    });
                } else {
                    await this.prisma.$executeRawUnsafe(
                        `UPDATE follow_ups SET due_date = ?, assigned_to_id = ?, updated_at = NOW() WHERE id = ?`,
                        params.followUpDate, params.assignedToId, existing.id,
                    );
                }
                return;
            }

            // Case 3: belum ada → create baru
            const notes = `Auto-scheduled dari Lead "${params.leadName}" (followUpDate)`;
            if (hasModel) {
                await (this.prisma as any).followUp.create({
                    data: {
                        type: 'LEAD_FU',
                        status: 'PENDING',
                        dueDate: params.followUpDate,
                        leadId: params.leadId,
                        assignedToId: params.assignedToId ?? null,
                        branchId: params.branchId,
                        notes,
                        sourceRef: `lead-fudate:${params.leadId}`,
                    },
                });
            } else {
                await this.prisma.$executeRawUnsafe(
                    `INSERT INTO follow_ups (type, status, due_date, lead_id, assigned_to_id, branch_id, notes, source_ref, created_at, updated_at)
                     VALUES ('LEAD_FU', 'PENDING', ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    params.followUpDate, params.leadId, params.assignedToId,
                    params.branchId, notes, `lead-fudate:${params.leadId}`,
                );
            }
        } catch (err) {
            // eslint-disable-next-line no-console
            console.warn('[_syncLeadFollowUp] gagal:', (err as Error).message);
        }
    }

    /** Load images untuk lead — raw SQL fallback kalau Prisma client model belum ada. */
    private async _loadImages(leadId: number): Promise<{ id: number; filename: string; caption: string | null; position: number }[]> {
        const hasModel = !!(this.prisma as any).leadImage?.findMany;
        if (hasModel) {
            return (this.prisma as any).leadImage.findMany({
                where: { leadId }, orderBy: { position: 'asc' },
                select: { id: true, filename: true, caption: true, position: true },
            });
        }
        const rows: any[] = await this.prisma.$queryRawUnsafe(
            `SELECT id, filename, caption, position FROM lead_images WHERE lead_id = ? ORDER BY position ASC`,
            leadId,
        );
        return rows.map(r => ({ id: Number(r.id), filename: r.filename, caption: r.caption, position: Number(r.position) }));
    }

    /**
     * Replace semua items untuk lead. Validate productVariantId existing.
     * Defensive: kalau Prisma client belum punya `leadItem` model (Windows EPERM
     * saat generate), fallback ke raw SQL.
     */
    /**
     * Buat order online dari website publik (tanpa auth) → tercatat sebagai Lead
     * NEW source WEBSITE (masuk CRM untuk di-follow-up & convert). branchId null.
     * Memicu notifikasi Discord "Lead baru".
     */
    async createPublicOrder(dto: {
        name: string; phone?: string; address?: string; note?: string;
        items?: LeadItemDto[];
    }) {
        if (!dto?.name?.trim()) throw new BadRequestException('Nama wajib diisi');
        const items = Array.isArray(dto.items) ? dto.items.filter(i => i && i.description) : [];
        // sumItemsTotal sadar item area: qty × (w×h/10000) × harga/m²
        const itemsTotal = this.sumItemsTotal(items);

        const needsParts: string[] = [];
        if (dto.note?.trim()) needsParts.push(dto.note.trim());
        if (dto.address?.trim()) needsParts.push(`Alamat: ${dto.address.trim()}`);

        const lead = await this.prisma.lead.create({
            data: {
                name: dto.name.trim(),
                phone: dto.phone || null,
                phoneNormalized: normalizePhone(dto.phone),
                source: 'WEBSITE' as any,
                status: 'NEW' as any,
                level: 'WARM' as any,
                needs: needsParts.join('\n') || null,
                estimatedValue: itemsTotal > 0 ? itemsTotal : null,
                intakeAt: new Date(),
                branchId: null,
                createdById: null,
            } as any,
        });

        if (items.length) await this._syncItems(lead.id, items);

        await this.prisma.leadActivity.create({
            data: {
                leadId: lead.id,
                kind: 'FIRST_CONTACT',
                text: 'Order online via website',
                meta: { source: 'WEBSITE', online: true } as any,
                createdById: null,
            },
        });

        this.discord.notifyNewLead({
            name: dto.name,
            phone: dto.phone || undefined,
            source: 'Website (Order Online)',
            estimatedValue: itemsTotal > 0 ? itemsTotal : undefined,
            branchId: (lead as any).branchId ?? null, // null = order website → webhook global
        });

        return { ok: true, leadId: lead.id, total: itemsTotal };
    }

    private async _syncItems(leadId: number, items: LeadItemDto[]) {
        const hasLeadItemModel = !!(this.prisma as any).leadItem?.deleteMany;

        // Delete existing items, lalu insert ulang
        if (hasLeadItemModel) {
            await (this.prisma as any).leadItem.deleteMany({ where: { leadId } });
        } else {
            await this.prisma.$executeRawUnsafe(`DELETE FROM lead_items WHERE lead_id = ?`, leadId);
        }
        if (!items.length) return;

        // Validate productVariantId yang non-null
        const variantIds = Array.from(new Set(
            items.map(i => i.productVariantId).filter((v): v is number => typeof v === 'number'),
        ));
        if (variantIds.length > 0) {
            const found = await this.prisma.productVariant.findMany({
                where: { id: { in: variantIds } },
                select: { id: true },
            });
            const foundSet = new Set(found.map(v => v.id));
            for (const vid of variantIds) {
                if (!foundSet.has(vid)) {
                    throw new BadRequestException(`ProductVariant #${vid} tidak ditemukan`);
                }
            }
        }

        const rows = items.map(it => ({
            leadId,
            productVariantId: it.productVariantId ?? null,
            description: (it.description || '(tanpa nama)').slice(0, 255),
            quantity: Math.max(1, Number(it.quantity) || 1),
            unitPrice: Number(it.unitPrice) || 0,
            widthCm: it.widthCm ?? null,
            heightCm: it.heightCm ?? null,
            unitType: it.unitType || null,
            note: it.note || null,
        }));

        if (hasLeadItemModel) {
            await (this.prisma as any).leadItem.createMany({ data: rows });
        } else {
            // Raw SQL fallback
            for (const r of rows) {
                await this.prisma.$executeRawUnsafe(
                    `INSERT INTO lead_items
                        (lead_id, product_variant_id, description, quantity, unit_price, width_cm, height_cm, unit_type, note)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    r.leadId, r.productVariantId, r.description, r.quantity, r.unitPrice,
                    r.widthCm, r.heightCm, r.unitType, r.note,
                );
            }
        }
    }

    async create(ctx: BranchContext, data: CreateLeadDto, userId?: number) {
        const branchId = requireBranch(ctx);
        const phoneNorm = normalizePhone(data.phone);

        // Auto-calc estimatedValue dari items kalau tidak di-set manual
        const itemsTotal = this.sumItemsTotal(data.items);
        const finalEstimated = data.estimatedValue ?? (itemsTotal > 0 ? itemsTotal : null);

        const lead = await this.prisma.lead.create({
            data: {
                name: data.name,
                phone: data.phone || null,
                phoneNormalized: phoneNorm,
                source: data.source,
                sourceDetail: data.sourceDetail || null,
                level: data.level || 'WARM',
                status: data.status || 'NEW',
                needs: data.needs || null,
                estimatedValue: finalEstimated,
                city: data.city || null,
                assignedToId: data.assignedToId ?? null,
                intakeAt: data.intakeAt ? new Date(data.intakeAt) : new Date(),
                followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
                deliveryDeadline: data.deliveryDeadline ? new Date(data.deliveryDeadline) : null,
                ...({ imageUrl: data.imageUrl ?? null } as any),
                branchId,
                createdById: userId ?? null,
            } as any,
        });

        // Insert items kalau ada
        if (data.items?.length) {
            await this._syncItems(lead.id, data.items);
        }
        // Sync images kalau ada (imageUrls array). Backward compat: kalau cuma
        // imageUrl single yang di-pass, convert ke array 1 elemen.
        const initialImages = data.imageUrls && data.imageUrls.length > 0
            ? data.imageUrls
            : (data.imageUrl ? [data.imageUrl] : []);
        if (initialImages.length > 0) {
            await this._syncImages(lead.id, initialImages);
        }

        // Auto-create FollowUp task kalau followUpDate di-set
        if (data.followUpDate) {
            await this._syncLeadFollowUp({
                leadId: lead.id,
                followUpDate: new Date(data.followUpDate),
                branchId,
                assignedToId: data.assignedToId ?? null,
                leadName: data.name,
            });
        }

        // Log activity FIRST_CONTACT
        await this.prisma.leadActivity.create({
            data: {
                leadId: lead.id,
                kind: 'FIRST_CONTACT',
                text: `Lead masuk via ${data.source}${data.sourceDetail ? ` (${data.sourceDetail})` : ''}`,
                meta: { source: data.source, sourceDetail: data.sourceDetail },
                createdById: userId ?? null,
            },
        });

        // Notifikasi Discord: lead baru masuk (channel #penjualan)
        let csName: string | undefined;
        if (data.assignedToId) {
            const u = await this.prisma.user.findUnique({ where: { id: data.assignedToId }, select: { name: true } });
            csName = u?.name ?? undefined;
        }
        this.discord.notifyNewLead({
            name: data.name,
            phone: data.phone || undefined,
            source: data.sourceDetail?.trim() || data.source || undefined,
            csName,
            estimatedValue: finalEstimated != null ? Number(finalEstimated) : undefined,
            level: data.level || undefined,
            needs: data.needs || undefined,
            deadline: data.deliveryDeadline ?? null,
            branchId: (lead as any).branchId ?? null,
        });

        return this.detail(ctx, lead.id);
    }

    async update(ctx: BranchContext, id: number, data: UpdateLeadDto, userId?: number) {
        const existing = await this.detail(ctx, id);
        // Catatan: lead terminal (CLOSED_WON/CLOSED_LOST) tetap bisa diedit & diubah
        // status-nya (mis. reopen ke FOLLOW_UP). Activity log mencatat perubahan
        // supaya history tetap rapih. Kalau reopen, closedAt di-reset null.
        const isReopen =
            (existing.status === 'CLOSED_WON' || existing.status === 'CLOSED_LOST' || existing.status === 'INVALID') &&
            data.status && data.status !== existing.status &&
            data.status !== 'CLOSED_WON' && data.status !== 'CLOSED_LOST' && data.status !== 'INVALID';

        const updateData: Prisma.LeadUpdateInput = {};
        if (data.name !== undefined) updateData.name = data.name;
        if (data.phone !== undefined) {
            updateData.phone = data.phone || null;
            updateData.phoneNormalized = normalizePhone(data.phone);
        }
        if (data.source !== undefined) updateData.source = data.source;
        if (data.sourceDetail !== undefined) updateData.sourceDetail = data.sourceDetail || null;
        if (data.level !== undefined) updateData.level = data.level;
        if (data.needs !== undefined) updateData.needs = data.needs || null;
        if (data.estimatedValue !== undefined) updateData.estimatedValue = data.estimatedValue;
        if (data.city !== undefined) updateData.city = data.city || null;
        if (data.assignedToId !== undefined) {
            updateData.assignedTo = data.assignedToId
                ? { connect: { id: data.assignedToId } }
                : { disconnect: true };
        }
        if (data.intakeAt !== undefined) {
            (updateData as any).intakeAt = data.intakeAt ? new Date(data.intakeAt) : null;
        }
        if (data.followUpDate !== undefined) {
            updateData.followUpDate = data.followUpDate ? new Date(data.followUpDate) : null;
        }
        if (data.deliveryDeadline !== undefined) {
            (updateData as any).deliveryDeadline = data.deliveryDeadline ? new Date(data.deliveryDeadline) : null;
        }
        // Manual override response time (set/reset). null = reset, ISO string = set.
        if (data.firstResponseAt !== undefined) {
            (updateData as any).firstResponseAt = data.firstResponseAt ? new Date(data.firstResponseAt) : null;
        }
        // Auto-set firstResponseAt saat status NEW → non-NEW (kalau belum di-set
        // & user tidak override manual di payload yang sama).
        if (
            data.firstResponseAt === undefined &&
            data.status &&
            data.status !== existing.status &&
            existing.status === 'NEW' &&
            !(existing as any).firstResponseAt
        ) {
            (updateData as any).firstResponseAt = new Date();
        }
        if (data.imageUrl !== undefined) {
            (updateData as any).imageUrl = data.imageUrl || null;
        }
        // Auto-recalc estimatedValue dari items kalau items di-update & estimatedValue tidak di-set manual
        if (data.items !== undefined && data.estimatedValue === undefined) {
            const total = this.sumItemsTotal(data.items);
            if (total > 0) updateData.estimatedValue = total;
        }
        if (data.status !== undefined && data.status !== existing.status) {
            updateData.status = data.status;
            // Reopen: kalau pindah dari terminal ke non-terminal, reset closedAt
            if (isReopen) {
                updateData.closedAt = null;
            }
            // Kalau pindah ke terminal, set closedAt
            if (data.status === 'CLOSED_WON' || data.status === 'CLOSED_LOST' || data.status === 'INVALID') {
                updateData.closedAt = new Date();
            }
        }

        const updated = await this.prisma.lead.update({ where: { id }, data: updateData });

        // Sync items kalau di-set (replace semua)
        if (data.items !== undefined) {
            await this._syncItems(id, data.items);
        }
        // Sync images kalau di-set (replace semua). Kalau cuma imageUrl single,
        // backward compat — replace dengan 1 gambar atau clear.
        if (data.imageUrls !== undefined) {
            await this._syncImages(id, data.imageUrls);
        } else if (data.imageUrl !== undefined) {
            await this._syncImages(id, data.imageUrl ? [data.imageUrl] : []);
        }

        // Sync FollowUp kalau followUpDate di-update (termasuk dihapus = null)
        if (data.followUpDate !== undefined) {
            const targetAssignee = data.assignedToId !== undefined
                ? data.assignedToId
                : existing.assignedToId;
            await this._syncLeadFollowUp({
                leadId: id,
                followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
                branchId: existing.branchId ?? (existing as any).branch?.id ?? 1,
                assignedToId: targetAssignee ?? null,
                leadName: data.name ?? existing.name,
            });
        }

        // Log activity untuk perubahan signifikan
        const changes: string[] = [];
        if (data.status && data.status !== existing.status) {
            changes.push(`status: ${existing.status} → ${data.status}`);
            await this.prisma.leadActivity.create({
                data: {
                    leadId: id,
                    kind: 'STATUS_CHANGE',
                    text: `Status berubah dari ${existing.status} ke ${data.status}`,
                    meta: { previousStatus: existing.status, newStatus: data.status },
                    createdById: userId ?? null,
                },
            });
        }
        if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
            await this.prisma.leadActivity.create({
                data: {
                    leadId: id,
                    kind: 'ASSIGNED',
                    text: data.assignedToId
                        ? `Lead di-assign ke user #${data.assignedToId}`
                        : `Assignment dilepas`,
                    meta: { previousAssignedToId: existing.assignedToId, newAssignedToId: data.assignedToId },
                    createdById: userId ?? null,
                },
            });
        }

        return this.detail(ctx, updated.id);
    }

    async addActivity(ctx: BranchContext, leadId: number, data: CreateActivityDto, userId?: number) {
        await this.detail(ctx, leadId); // assert exist + access
        const act = await this.prisma.leadActivity.create({
            data: {
                leadId,
                kind: data.kind,
                text: data.text || null,
                meta: (data.meta as any) ?? undefined,
                createdById: userId ?? null,
            },
        });
        // Auto-set firstResponseAt saat activity non-FIRST_CONTACT pertama dicatat,
        // kalau lead belum punya firstResponseAt. updateMany dipakai supaya idempotent
        // (filter firstResponseAt: null jadi update hanya kalau memang belum di-set).
        if (data.kind !== 'FIRST_CONTACT') {
            await (this.prisma as any).lead.updateMany({
                where: { id: leadId, firstResponseAt: null },
                data: { firstResponseAt: act.createdAt },
            });
        }
        return act;
    }

    /** Convert lead → Customer (existing/baru) + opsional SO draft. */
    async convert(ctx: BranchContext, leadId: number, data: ConvertLeadDto, userId?: number) {
        const lead = await this.detail(ctx, leadId);
        // Re-convert hanya boleh dilakukan oleh owner. Staff biasa hanya bisa convert sekali.
        if (lead.status === 'CLOSED_WON' && !ctx.isOwner) {
            throw new ForbiddenException('Lead ini sudah pernah di-convert. Hubungi owner untuk convert ulang.');
        }

        // Resolve customer
        let customerId = data.customerId ?? null;
        if (!customerId && data.createCustomer) {
            const customer = await this.prisma.customer.create({
                data: {
                    name: lead.name,
                    phone: lead.phone,
                    leadSource: lead.source,
                    assignedCsId: lead.assignedToId ?? null,
                },
            });
            customerId = customer.id;
        }
        if (!customerId) {
            throw new BadRequestException('Pilih customer existing atau set createCustomer=true.');
        }

        // Load customer untuk pakai datanya
        const customer = await this.prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new BadRequestException('Customer tidak ditemukan.');

        // Load lead items dengan productVariant — untuk include di SO/Invoice saat convert
        const hasLeadItemModel = !!(this.prisma as any).leadItem?.findMany;
        let leadItems: any[] = [];
        if (hasLeadItemModel) {
            leadItems = await (this.prisma as any).leadItem.findMany({
                where: { leadId },
                orderBy: { id: 'asc' },
                include: { productVariant: { include: { product: true } } },
            });
        } else {
            const rawItems: any[] = await this.prisma.$queryRawUnsafe(`
                SELECT li.*, pv.variant_name AS pv_variantName,
                       p.id AS p_id, p.name AS p_name, p.pricing_mode AS p_pricingMode
                FROM lead_items li
                LEFT JOIN product_variants pv ON pv.id = li.product_variant_id
                LEFT JOIN products p ON p.id = pv.product_id
                WHERE li.lead_id = ? ORDER BY li.id ASC
            `, leadId);
            leadItems = rawItems.map(r => ({
                id: Number(r.id),
                productVariantId: r.product_variant_id != null ? Number(r.product_variant_id) : null,
                description: r.description,
                quantity: Number(r.quantity),
                unitPrice: Number(r.unit_price),
                widthCm: r.width_cm != null ? Number(r.width_cm) : null,
                heightCm: r.height_cm != null ? Number(r.height_cm) : null,
                unitType: r.unit_type,
                note: r.note,
                productVariant: r.product_variant_id != null ? {
                    variantName: r.pv_variantName,
                    product: r.p_id != null ? { id: Number(r.p_id), name: r.p_name, pricingMode: r.p_pricingMode } : null,
                } : null,
            }));
        }

        // Auto-create Transaction (PENDING/saveOnly) → spawn production jobs otomatis
        // untuk items yang punya productVariantId. Hanya jalan kalau ada items valid.
        // Skip kalau user eksplisit set createProductionTransaction=false.
        let transactionId: number | null = null;
        let transactionItemsCreated = 0;
        let transactionItemsSkipped = 0;
        let transactionError: string | null = null;
        const wantProductionTx = data.createProductionTransaction !== false;
        // Semua item dikirim ke transaksi — custom item (tanpa productVariantId) ditangani
        // di transactions.service sebagai item custom tanpa stok.
        const txItems = wantProductionTx ? leadItems : [];
        if (wantProductionTx && txItems.length > 0) {
            try {
                const branchId = (lead as any).branchId ?? ctx.branchId ?? null;

                // Payment options. Default NONE = PENDING (saveOnly true, no DP).
                const paymentMode = data.paymentMode || 'NONE';
                const rawMethod = data.paymentMethod || 'CASH';
                const paymentMethod = (rawMethod === 'TRANSFER' ? 'BANK_TRANSFER' : rawMethod) as any;

                // Harga dasar + tier varian — dipakai untuk mendeteksi item yang harganya
                // belum disesuaikan CS (masih harga dasar): item itu JANGAN dikirim sebagai
                // customPrice supaya transactions.service yang me-resolve harga tier per qty.
                const variantIds = txItems
                    .map((it: any) => Number(it.productVariantId))
                    .filter((id: number) => Number.isFinite(id) && id > 0);
                const tierVariants: any[] = variantIds.length
                    ? await (this.prisma as any).productVariant.findMany({
                        where: { id: { in: variantIds } },
                        select: {
                            id: true, price: true,
                            priceTiers: { select: { minQty: true, maxQty: true, price: true } },
                        },
                    })
                    : [];
                const tierVariantById = new Map(tierVariants.map(v => [v.id, v]));
                const txPayload: any = {
                    items: txItems.map((it: any) => {
                        const w = Number(it.widthCm) || 0;
                        const h = Number(it.heightCm) || 0;
                        const isArea = w > 0 && h > 0;
                        const areaM2 = isArea ? (w * h) / 10000 : 0;
                        const qty = Number(it.quantity) || 1;
                        const uPrice = Number(it.unitPrice) || 0;

                        let customPrice: number | undefined;
                        if (uPrice > 0) {
                            if (it.productVariantId && isArea) {
                                // AREA_BASED catalog item: transactions service memakai customPrice
                                // sebagai FULL line total. Hitung qty × area × harga/m² di sini
                                // karena pcs tidak dikirim (default 1 di service).
                                customPrice = Math.round(qty * areaM2 * uPrice);
                            } else if (!it.productVariantId && isArea) {
                                // Custom item (free-text) dengan dimensi: service akan × qty otomatis.
                                customPrice = Math.round(areaM2 * uPrice);
                            } else {
                                // UNIT item (catalog/custom): service akan × qty otomatis.
                                customPrice = uPrice;
                                // Harga masih = harga dasar varian & varian punya tier →
                                // lepas override, biar transactions.service resolve tier-nya
                                const v = it.productVariantId ? tierVariantById.get(Number(it.productVariantId)) : null;
                                if (v && (v.priceTiers || []).length > 0 && Number(v.price) === uPrice) {
                                    customPrice = undefined;
                                }
                            }
                        }

                        return {
                            productVariantId: it.productVariantId ? Number(it.productVariantId) : null,
                            customName: it.productVariantId ? undefined : (it.description || undefined),
                            quantity: qty,
                            widthCm: it.widthCm ? Number(it.widthCm) : undefined,
                            heightCm: it.heightCm ? Number(it.heightCm) : undefined,
                            unitType: it.unitType || undefined,
                            note: it.note || undefined,
                            customPrice,
                        };
                    }),
                    paymentMethod,
                    bankAccountId: data.bankAccountId,
                    customerName: customer.name,
                    customerPhone: customer.phone || undefined,
                    customerAddress: customer.address || undefined,
                    productionNotes: data.notes || lead.needs || undefined,
                    productionDeadline: (lead as any).deliveryDeadline
                        ? new Date((lead as any).deliveryDeadline).toISOString()
                        : undefined,
                    branchId,
                };

                // Map paymentMode → transactions.service flags.
                // - NONE  : saveOnly=true, downPayment=0       → PENDING (tanpa cashflow)
                // - DP    : saveOnly=true, downPayment=<nom>   → PARTIAL (DP, cashflow INCOME)
                // - LUNAS : saveOnly=false (default downPayment = grandTotal) → PAID (cashflow INCOME)
                if (paymentMode === 'NONE') {
                    txPayload.saveOnly = true;
                    txPayload.downPayment = 0;
                } else if (paymentMode === 'DP') {
                    txPayload.saveOnly = true;
                    txPayload.downPayment = Math.max(0, Number(data.paymentAmount) || 0);
                } else if (paymentMode === 'LUNAS') {
                    txPayload.saveOnly = false;
                    // Don't set downPayment — service defaults to grandTotal
                    if (data.marketplaceFee && data.marketplaceFee > 0) {
                        txPayload.marketplaceFee = data.marketplaceFee;
                    }
                }

                const tx = await this.transactionsService.create(txPayload);
                transactionId = (tx as any).id ?? null;
                transactionItemsCreated = txItems.length;
                transactionItemsSkipped = 0;

                // BYPASS requiresProduction: ensure all transaction items have a production job.
                // transactions.service hanya bikin job untuk product.requiresProduction=true. CRM
                // convert flow override: semua item dengan productVariantId masuk pipeline produksi.
                if (transactionId) {
                    const allTxItems = await (this.prisma as any).transactionItem.findMany({
                        where: { transactionId },
                        select: { id: true },
                    });
                    const existingJobs = await (this.prisma as any).productionJob.findMany({
                        where: { transactionItemId: { in: allTxItems.map((i: any) => i.id) } },
                        select: { transactionItemId: true },
                    });
                    const jobbedSet = new Set(existingJobs.map((j: any) => j.transactionItemId));
                    const needJob = allTxItems.filter((i: any) => !jobbedSet.has(i.id));

                    if (needJob.length > 0) {
                        const jobDateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
                        const jobPrefix = `JOB-${jobDateStr}-`;
                        const lastJob = await (this.prisma as any).productionJob.findFirst({
                            where: { jobNumber: { startsWith: jobPrefix } },
                            orderBy: { jobNumber: 'desc' },
                            select: { jobNumber: true },
                        });
                        let jobSeq = lastJob
                            ? parseInt(lastJob.jobNumber.slice(jobPrefix.length), 10)
                            : 0;
                        const deadline = (lead as any).deliveryDeadline
                            ? new Date((lead as any).deliveryDeadline)
                            : null;
                        for (const item of needJob) {
                            jobSeq++;
                            await (this.prisma as any).productionJob.create({
                                data: {
                                    jobNumber: `${jobPrefix}${String(jobSeq).padStart(4, '0')}`,
                                    transactionId,
                                    transactionItemId: item.id,
                                    status: 'ANTRIAN',
                                    priority: 'NORMAL',
                                    notes: data.notes || lead.needs || null,
                                    branchId,
                                    pipelineStage: 'DESIGN',
                                    deadline,
                                    designerName: data.designerName || null,
                                    isExpress: data.isExpress === true,
                                },
                            });
                        }
                    }

                    // Set designerName + isExpress juga pada job yang sudah dibuat oleh transactionsService
                    const bulkJobUpdate: any = {};
                    if (data.designerName) bulkJobUpdate.designerName = data.designerName;
                    if (data.isExpress === true) bulkJobUpdate.isExpress = true;
                    if (Object.keys(bulkJobUpdate).length > 0) {
                        await (this.prisma as any).productionJob.updateMany({
                            where: { transactionId },
                            data: bulkJobUpdate,
                        });
                    }
                }
            } catch (err: any) {
                // Tx gagal jangan blok seluruh convert — log & lanjut. UI akan tampilkan warning.
                // eslint-disable-next-line no-console
                console.error('[convert] auto-create transaction failed:', err?.message);
                transactionItemsSkipped = leadItems.length;
                transactionError = err?.message || 'Unknown error';
            }
        } else if (wantProductionTx) {
            transactionItemsSkipped = leadItems.length;
        }

        // Resolve SO draft (opsional) — SPK production-bound
        let salesOrderId: number | null = null;
        let soItemsCreated = 0;
        let soItemsSkipped = 0;
        let soProofsCopied = 0;
        if (data.createSalesOrderDraft) {
            const designerName = (data.designerName || '').trim() || 'TBD';
            const soNumber = await this.generateSoNumber((lead as any).branchId ?? ctx.branchId ?? null);
            const so = await this.prisma.salesOrder.create({
                data: {
                    soNumber,
                    status: 'DRAFT',
                    customerId,
                    customerName: customer.name,
                    customerPhone: customer.phone,
                    customerAddress: customer.address,
                    designerName,
                    notes: data.notes || lead.needs || null,
                    branchName: (lead as any).branch?.name ?? null,
                },
            });
            salesOrderId = so.id;

            // Include items dari lead → SalesOrderItem. WAJIB productVariantId.
            for (const it of leadItems) {
                if (!it.productVariantId) {
                    soItemsSkipped++;
                    continue;
                }
                await this.prisma.salesOrderItem.create({
                    data: {
                        salesOrderId: so.id,
                        productVariantId: it.productVariantId,
                        quantity: it.quantity,
                        widthCm: it.widthCm ?? null,
                        heightCm: it.heightCm ?? null,
                        unitType: it.unitType ?? null,
                        customPrice: Number(it.unitPrice) || null,
                        note: it.note ?? null,
                    },
                });
                soItemsCreated++;
            }

            // Copy lead images → SalesOrderProof (supaya desainer langsung punya referensi)
            const leadImages = await this._loadImages(leadId);
            for (const img of leadImages) {
                await this.prisma.salesOrderProof.create({
                    data: {
                        salesOrderId: so.id,
                        filename: img.filename,
                        caption: img.caption || `Referensi dari lead #${leadId}`,
                    },
                });
                soProofsCopied++;
            }
        }

        // Resolve Invoice draft (opsional) — nota tagihan / quotation
        let invoiceId: number | null = null;
        let invoiceNumber: string | null = null;
        if (data.createInvoiceDraft) {
            const invType = data.invoiceType || 'INVOICE';
            const prefix = invType === 'QUOTATION' ? 'SPH' : 'INV';
            const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const startsWith = `${prefix}-${yyyymmdd}`;
            // Cari nomor terakhir hari ini supaya urutan rapi
            const last = await this.prisma.invoice.findFirst({
                where: { invoiceNumber: { startsWith } },
                orderBy: { invoiceNumber: 'desc' },
            });
            let seq = 1;
            if (last) {
                const tail = last.invoiceNumber.split('-').pop() || '0';
                seq = parseInt(tail, 10) + 1;
            }
            const newNumber = `${startsWith}-${String(seq).padStart(3, '0')}`;
            // Build invoice items dari lead items.
            // InvoiceItem hanya simpan qty × price (tidak ada area calc), jadi untuk
            // AREA_BASED kita compress jadi:
            //   - quantity = 1 (atau qty asli)
            //   - price = subtotal-per-qty hasil area calc
            // Supaya total invoice akurat tanpa perlu modify Invoice schema.
            const invItems = leadItems.map((it: any) => {
                const productName = it.productVariant?.product?.name || it.description;
                const variantName = it.productVariant?.variantName;
                const isArea = Number(it.widthCm) > 0 && Number(it.heightCm) > 0;
                const sizeNote = isArea ? ` (${it.widthCm}×${it.heightCm}cm = ${((Number(it.widthCm) * Number(it.heightCm)) / 10000).toFixed(2)}m²)` : '';
                const descParts = [productName, variantName].filter(Boolean).join(' - ');

                let invQty = Number(it.quantity) || 1;
                let invPrice = Number(it.unitPrice) || 0;
                let unit = it.unitType || 'pcs';
                if (isArea) {
                    // Compress: per-qty price = (w × h / 10000) × pricePerM2
                    const areaM2 = (Number(it.widthCm) * Number(it.heightCm)) / 10000;
                    invPrice = areaM2 * invPrice;
                    unit = 'pcs'; // invoice item per-pcs (sudah include area)
                }
                return {
                    description: `${descParts || it.description}${sizeNote}`,
                    unit,
                    quantity: invQty,
                    price: Math.round(invPrice), // round ke rupiah
                };
            });
            const subtotal = invItems.reduce((s: number, it: any) => s + (it.quantity * Number(it.price)), 0);
            const invoice = await this.prisma.invoice.create({
                data: {
                    invoiceNumber: newNumber,
                    type: invType as any,
                    status: 'DRAFT',
                    branchId: (lead as any).branchId ?? ctx.branchId ?? null, // ikut cabang lead
                    clientName: customer.name,
                    clientPhone: customer.phone,
                    clientAddress: customer.address,
                    date: new Date(),
                    notes: data.notes || lead.needs || null,
                    subtotal,
                    total: subtotal, // belum termasuk PPN/diskon — bisa diedit di /invoices
                    items: invItems.length ? { create: invItems } : undefined,
                } as any,
            });
            invoiceId = invoice.id;
            invoiceNumber = invoice.invoiceNumber;
        }

        // Update lead: CLOSED_WON + link conversion
        const updated = await this.prisma.lead.update({
            where: { id: leadId },
            data: {
                status: 'CLOSED_WON',
                convertedCustomerId: customerId,
                convertedSalesOrderId: salesOrderId,
                ...(transactionId ? { convertedTransactionId: transactionId } : {}),
                closedAt: new Date(),
            },
        });

        // Log activity di lead + customer
        await this.prisma.leadActivity.create({
            data: {
                leadId,
                customerId,
                kind: 'CONVERTED',
                text: [
                    `Lead converted → Customer #${customerId}`,
                    salesOrderId ? ` + SPK (SO) draft #${salesOrderId}` : null,
                    invoiceNumber ? ` + ${invoiceNumber}` : null,
                    transactionId ? ` + Transaction #${transactionId} (PENDING → produksi)` : null,
                ].filter(Boolean).join(''),
                meta: {
                    customerId, salesOrderId, invoiceId, invoiceNumber, transactionId,
                    designerName: data.designerName, invoiceType: data.invoiceType,
                },
                createdById: userId ?? null,
            },
        });

        // Notifikasi Discord: deal closing baru (channel #penjualan)
        this.discord.notifyDealClosing({
            csName: (lead as any).assignedTo?.name ?? undefined,
            customerName: customer.name ?? lead.name ?? undefined,
            value: Number(lead.estimatedValue) || 0,
            pcs: leadItems.reduce((s, it) => s + (Number(it.quantity) || 0), 0) || undefined,
            itemsCount: leadItems.length || undefined,
            invoiceNumber: invoiceNumber || undefined,
            source: (lead as any).sourceDetail?.trim() || lead.source || undefined,
            branchId: (lead as any).branchId ?? ctx.branchId ?? null,
        });

        // Return detail + sertakan info dokumen yang baru dibuat untuk UI
        const detail = await this.detail(ctx, updated.id);
        return {
            ...detail,
            _convertResult: {
                customerId,
                salesOrderId,
                soItemsCreated,
                soItemsSkipped,
                soProofsCopied,
                invoiceId,
                invoiceNumber,
                invoiceItemsCreated: invoiceId ? leadItems.length : 0,
                transactionId,
                transactionItemsCreated,
                transactionItemsSkipped,
                transactionError,
            },
        };
    }

    async closeLost(ctx: BranchContext, leadId: number, data: CloseLostDto, userId?: number) {
        await this.detail(ctx, leadId);
        const updated = await this.prisma.lead.update({
            where: { id: leadId },
            data: {
                status: 'CLOSED_LOST',
                closeLostReason: data.reason,
                closedAt: new Date(),
            },
        });
        await this.prisma.leadActivity.create({
            data: {
                leadId,
                kind: 'CLOSED_LOST',
                text: `Lead ditutup: ${data.reason}`,
                meta: { reason: data.reason },
                createdById: userId ?? null,
            },
        });
        return this.detail(ctx, updated.id);
    }

    async markInvalid(ctx: BranchContext, leadId: number, reason: string, userId?: number) {
        await this.detail(ctx, leadId);
        const updated = await (this.prisma as any).lead.update({
            where: { id: leadId },
            data: {
                status: 'INVALID',
                closeLostReason: reason || null,
                closedAt: new Date(),
            },
        });
        await this.prisma.leadActivity.create({
            data: {
                leadId,
                kind: 'NOTE',
                text: `Lead ditandai invalid${reason ? `: ${reason}` : ''}`,
                meta: { reason },
                createdById: userId ?? null,
            },
        });
        return this.detail(ctx, updated.id);
    }

    /**
     * Tautkan lead ke SO desainer yang sudah ada (Alur B). TIDAK membuat nota/convert —
     * hanya set `convertedSalesOrderId` & pindah status ke NEGOTIATION (kalau masih NEW/FU).
     * Saat SO di-checkout jadi nota, hook di transactions.service akan otomatis menutup
     * lead ini jadi CLOSED_WON menunjuk nota yang sama (cegah nota dobel).
     * Kirim salesOrderId = null untuk melepas tautan.
     */
    async linkToSalesOrder(ctx: BranchContext, leadId: number, salesOrderId: number | null) {
        await this.detail(ctx, leadId);
        if (salesOrderId != null) {
            const so = await (this.prisma as any).salesOrder.findUnique({
                where: { id: salesOrderId },
                select: { id: true, soNumber: true, status: true },
            });
            if (!so) throw new NotFoundException('Sales Order tidak ditemukan');
            if (so.status === 'CANCELLED') throw new BadRequestException('SO sudah dibatalkan, tidak bisa ditautkan');
        }
        const current: any = await (this.prisma as any).lead.findUnique({ where: { id: leadId }, select: { status: true } });
        const bumpStatus = salesOrderId != null && ['NEW', 'FOLLOW_UP'].includes(current?.status);
        const updated = await (this.prisma as any).lead.update({
            where: { id: leadId },
            data: {
                convertedSalesOrderId: salesOrderId,
                ...(bumpStatus ? { status: 'NEGOTIATION' } : {}),
            },
        });
        await this.prisma.leadActivity.create({
            data: {
                leadId,
                kind: 'NOTE',
                text: salesOrderId != null ? `Lead ditautkan ke Sales Order #${salesOrderId}` : 'Tautan Sales Order dilepas',
                meta: { salesOrderId } as any,
                createdById: null,
            },
        });
        return this.detail(ctx, updated.id);
    }

    async remove(ctx: BranchContext, id: number) {
        await this.detail(ctx, id);
        await this.prisma.lead.delete({ where: { id } });
        return { ok: true };
    }
}
