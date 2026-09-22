import { BadRequestException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';

export interface CatalogProductInput {
    name?: string;
    description?: string | null;
    priceRupiah?: number; // harga rupiah (dikonversi ke minor unit ×100 utk Meta)
    currency?: string;
    imageUrl?: string;
    additionalImageUrls?: string[]; // galeri tambahan (Meta: additional_image_urls, maks 10)
    url?: string | null;
    availability?: string; // 'in stock' | 'out of stock'
    retailerId?: string;
}

/** Bersihkan array URL gambar tambahan: trim, buang kosong/duplikat, batasi 10 (limit Meta). */
function cleanImageUrls(urls: unknown): string[] {
    if (!Array.isArray(urls)) return [];
    const seen = new Set<string>();
    for (const u of urls) {
        const s = typeof u === 'string' ? u.trim() : '';
        if (s) seen.add(s);
    }
    return [...seen].slice(0, 10);
}

/** SKU aman: huruf kecil/angka/underscore + suffix unik. */
function slugRetailerId(name: string): string {
    const base = (name || 'produk').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'produk';
    return `${base}_${Date.now().toString(36)}`;
}

/** retailer_id stabil utk item katalog yang berasal dari varian produk POS. */
export const posRetailerId = (variantId: number) => `pos-v${variantId}`;
const POS_RETAILER_RE = /^pos-v(\d+)$/;

/** URL absolut publik utk path upload ("/uploads/..") — Meta wajib bisa mengunduh gambarnya. */
export function absolutePublicUrl(path: string | null | undefined, base: string): string | null {
    const p = (path || '').trim();
    if (!p) return null;
    if (/^https?:\/\//i.test(p)) return p;
    return `${base.replace(/\/+$/, '')}/${p.replace(/^\/+/, '')}`;
}

function parseImageList(raw: string | null | undefined): string[] {
    try {
        const arr = JSON.parse(raw || '[]');
        return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
    } catch {
        return [];
    }
}

export interface PosCatalogPlan {
    variantId: number;
    action: 'create' | 'update' | 'skip';
    catalogProductId?: string | null;
    error?: string;
    payload?: { name: string; description: string; price: number; currency: string; image_url: string; additional_image_urls?: string[]; availability: string };
}

/**
 * Susun item katalog dari produk POS (tanpa input ulang): tiap varian = 1 item. Nama = nama produk
 * (+ nama varian bila varian > 1), harga = harga varian, deskripsi & gambar dari produk.
 */
export function buildPosCatalogPlan(
    product: { name: string; description?: string | null; imageUrl?: string | null; imageUrls?: string | null; pricingMode?: string | null; areaUnit?: string | null; variants: { id: number; variantName?: string | null; price: unknown; variantImageUrl?: string | null }[] },
    publicBase: string,
    links: Record<number, { catalogProductId: string }>,
    variantIds?: number[],
): PosCatalogPlan[] {
    const productImages = [product.imageUrl, ...parseImageList(product.imageUrls)]
        .map((u) => absolutePublicUrl(u, publicBase))
        .filter((u): u is string => !!u);
    const multi = product.variants.length > 1;
    const wanted = variantIds?.length ? product.variants.filter((v) => variantIds.includes(v.id)) : product.variants;
    return wanted.map((v) => {
        const link = links[v.id];
        const main = absolutePublicUrl(v.variantImageUrl, publicBase) || productImages[0];
        if (!main) {
            return { variantId: v.id, action: 'skip' as const, catalogProductId: link?.catalogProductId ?? null, error: 'Produk belum punya gambar (wajib untuk katalog WhatsApp). Tambahkan gambar di Edit Produk.' };
        }
        const name = (multi && v.variantName?.trim() ? `${product.name} — ${v.variantName.trim()}` : product.name).trim().slice(0, 150);
        let description = (product.description || '').trim() || name;
        if (product.pricingMode === 'AREA_BASED' && !/m²|m2|cm²|cm2|per meter/i.test(description)) {
            description += `\n\nHarga per ${product.areaUnit === 'CM2' ? 'cm²' : 'm²'}.`;
        }
        const extra = cleanImageUrls(productImages.filter((u) => u !== main));
        return {
            variantId: v.id,
            action: link ? ('update' as const) : ('create' as const),
            catalogProductId: link?.catalogProductId ?? null,
            payload: {
                name,
                description: description.slice(0, 9999),
                price: Math.round(Number(v.price ?? 0) * 100), // minor unit, sama dgn create()
                currency: 'IDR',
                image_url: main,
                ...(extra.length ? { additional_image_urls: extra } : {}),
                availability: 'in stock',
            },
        };
    });
}

@Injectable()
export class CatalogService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cloud: CloudApiService,
    ) {}

    /** Resolusi catalog_id channel (manual di WaChannel, atau auto dari WABA lalu di-cache). */
    /** Jalankan panggilan Graph; error Meta jadi 400 terbaca (bukan 500 "internal error"). */
    private async safeMeta<T>(fn: () => Promise<T>, prefix: string): Promise<T> {
        try {
            return await fn();
        } catch (e) {
            if (e instanceof HttpException) throw e;
            throw new BadRequestException(`${prefix}: ${(e as Error)?.message || 'gagal menghubungi Meta'}`);
        }
    }

    private async resolveCatalogId(channelId: number): Promise<string> {
        const channel = await this.prisma.waChannel.findUnique({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel tidak ditemukan');
        if (channel.catalogId) return channel.catalogId;
        const auto = await this.safeMeta(
            () => this.cloud.getWabaCatalogId(channel.wabaId),
            'Gagal membaca katalog terhubung dari Meta (cek izin token: catalog_management & whatsapp_business_management)',
        );
        if (!auto) {
            throw new BadRequestException(
                'Katalog belum terhubung ke WABA ini. Hubungkan katalog di Meta Commerce Manager, ' +
                    'lalu coba lagi (atau isi Catalog ID di Pengaturan Channel). Pastikan token punya izin catalog_management.',
            );
        }
        await this.prisma.waChannel.update({ where: { id: channelId }, data: { catalogId: auto } });
        return auto;
    }

    /** Set Catalog ID manual pada channel (lewati auto-deteksi WABA yang bisa kena #100). */
    /**
     * ID produk katalog dari URL harus angka & memang milik katalog kanal ini. Dulu diteruskan
     * mentah ke Graph (`DELETE /{id}`) dengan token toko: `%2F`/`%3F` di URL bisa menghapus
     * template WA, katalog, atau iklan.
     */
    private async cekProdukKatalog(channelId: number, productId: string) {
        if (!/^\d{1,30}$/.test(String(productId ?? ''))) throw new BadRequestException('ID produk katalog tidak valid.');
        const rows = await this.list(channelId);
        if (!rows.some((r: any) => String(r.id) === String(productId))) throw new NotFoundException('Produk tidak ada di katalog kanal ini.');
    }

    async setChannelCatalogId(channelId: number, catalogId: string | null | undefined) {
        const channel = await this.prisma.waChannel.findUnique({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel tidak ditemukan');
        const val = (catalogId || '').trim() || null;
        if (val && !/^\d{1,30}$/.test(val)) throw new BadRequestException('ID katalog harus berupa angka (lihat Commerce Manager).');
        await this.prisma.waChannel.update({ where: { id: channelId }, data: { catalogId: val } });
        return { catalogId: val };
    }

    /** Catalog ID tersimpan pada channel (null bila belum diset). */
    async getChannelCatalogId(channelId: number) {
        const channel = await this.prisma.waChannel.findUnique({ where: { id: channelId }, select: { catalogId: true } });
        if (!channel) throw new NotFoundException('Channel tidak ditemukan');
        return { catalogId: channel.catalogId ?? null };
    }

    async list(channelId: number) {
        const catalogId = await this.resolveCatalogId(channelId);
        const rows = await this.safeMeta(() => this.cloud.listCatalogProducts(catalogId), 'Gagal memuat produk katalog');
        return rows.map((p) => {
            // review_status: umumnya string enum ("approved"/"pending"/"rejected"/
            // "outdated"/"no_review"); sebagian versi API balas objek {status}.
            const rs = p.review_status;
            const reviewStatus = typeof rs === 'string' ? rs : (rs?.status ?? null);
            return {
                id: p.id,
                retailerId: p.retailer_id ?? null,
                name: p.name ?? null,
                description: p.description ?? null,
                price: p.price ?? null, // string terformat dari Meta (mis. "Rp250.000,00")
                currency: p.currency ?? null,
                imageUrl: p.image_url ?? null,
                additionalImageUrls: Array.isArray(p.additional_image_urls) ? p.additional_image_urls : [],
                url: p.url ?? null,
                availability: p.availability ?? null,
                reviewStatus, // status approval Meta (utk badge "Menunggu review Meta", dll)
                visibility: p.visibility ?? null,
            };
        });
    }

    async create(channelId: number, input: CatalogProductInput) {
        const catalogId = await this.resolveCatalogId(channelId);
        if (!input.name?.trim()) throw new BadRequestException('Nama produk wajib diisi');
        if (!input.imageUrl?.trim()) throw new BadRequestException('URL gambar wajib (harus dapat diakses publik oleh Meta)');
        const extraImages = cleanImageUrls(input.additionalImageUrls);
        const payload: Record<string, unknown> = {
            retailer_id: input.retailerId?.trim() || slugRetailerId(input.name),
            name: input.name.trim(),
            description: input.description?.trim() || input.name.trim(),
            price: Math.round((input.priceRupiah ?? 0) * 100),
            currency: input.currency || 'IDR',
            image_url: input.imageUrl.trim(),
            availability: input.availability || 'in stock',
            ...(extraImages.length ? { additional_image_urls: extraImages } : {}),
            ...(input.url?.trim() ? { url: input.url.trim() } : {}),
        };
        return this.safeMeta(() => this.cloud.createCatalogProduct(catalogId, payload), 'Gagal menambah produk ke katalog');
    }

    async update(channelId: number, productId: string, input: CatalogProductInput) {
        await this.cekProdukKatalog(channelId, productId); // validasi channel, katalog & kepemilikan produk
        const payload: Record<string, unknown> = {};
        if (input.name !== undefined) payload.name = input.name.trim();
        if (input.description !== undefined) payload.description = input.description?.trim() || undefined;
        if (input.priceRupiah !== undefined) payload.price = Math.round(input.priceRupiah * 100);
        if (input.currency !== undefined) payload.currency = input.currency;
        if (input.imageUrl !== undefined) payload.image_url = input.imageUrl.trim();
        if (input.additionalImageUrls !== undefined) payload.additional_image_urls = cleanImageUrls(input.additionalImageUrls);
        if (input.availability !== undefined) payload.availability = input.availability;
        if (input.url !== undefined) payload.url = input.url?.trim() || undefined;
        if (Object.keys(payload).length === 0) throw new BadRequestException('Tak ada perubahan');
        return this.safeMeta(() => this.cloud.updateCatalogProduct(productId, payload), 'Gagal mengubah produk katalog');
    }

    /** Varian POS yang sudah ada di katalog (retailer_id pos-v<id>) → info item katalognya. */
    async posLinks(channelId: number) {
        const rows = await this.list(channelId);
        const links: Record<number, { catalogProductId: string; name: string | null; price: string | null; reviewStatus: string | null; visibility: string | null }> = {};
        for (const r of rows) {
            const m = POS_RETAILER_RE.exec(r.retailerId || '');
            if (m) links[Number(m[1])] = { catalogProductId: r.id, name: r.name, price: r.price, reviewStatus: r.reviewStatus, visibility: r.visibility };
        }
        return links;
    }

    /**
     * "Jadikan Katalog WA" dari produk POS. dryRun = hanya rencana (pratinjau) tanpa menulis ke Meta.
     * Varian yang sudah ada di katalog diperbarui (bukan dobel).
     */
    async upsertFromProduct(channelId: number, productId: number, publicBase: string, opts: { variantIds?: number[]; dryRun?: boolean } = {}) {
        const product = await (this.prisma as any).product.findUnique({
            where: { id: productId },
            include: { variants: { orderBy: { id: 'asc' } } },
        });
        if (!product) throw new NotFoundException('Produk tidak ditemukan');
        if (!product.variants?.length) throw new BadRequestException('Produk tidak punya varian untuk dijadikan katalog');
        const catalogId = await this.resolveCatalogId(channelId);
        const links = await this.posLinks(channelId);
        const plan = buildPosCatalogPlan(product, publicBase, links, opts.variantIds);
        if (opts.dryRun) return { productId, dryRun: true, plan };

        const results: { variantId: number; ok: boolean; action: string; catalogProductId?: string | null; name?: string; error?: string }[] = [];
        for (const item of plan) {
            if (item.action === 'skip' || !item.payload) {
                results.push({ variantId: item.variantId, ok: false, action: 'skip', error: item.error });
                continue;
            }
            try {
                if (item.action === 'update' && item.catalogProductId) {
                    await this.cloud.updateCatalogProduct(item.catalogProductId, item.payload);
                    results.push({ variantId: item.variantId, ok: true, action: 'update', catalogProductId: item.catalogProductId, name: item.payload.name });
                } else {
                    const created = await this.cloud.createCatalogProduct(catalogId, { retailer_id: posRetailerId(item.variantId), ...item.payload });
                    results.push({ variantId: item.variantId, ok: true, action: 'create', catalogProductId: created?.id ?? null, name: item.payload.name });
                }
            } catch (e) {
                results.push({ variantId: item.variantId, ok: false, action: item.action, name: item.payload.name, error: (e as Error)?.message || 'Gagal menghubungi Meta' });
            }
        }
        return { productId, dryRun: false, results };
    }

    async remove(channelId: number, productId: string) {
        await this.cekProdukKatalog(channelId, productId);
        return this.safeMeta(() => this.cloud.deleteCatalogProduct(productId), 'Gagal menghapus produk katalog');
    }
}
