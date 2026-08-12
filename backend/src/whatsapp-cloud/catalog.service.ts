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
    async setChannelCatalogId(channelId: number, catalogId: string | null | undefined) {
        const channel = await this.prisma.waChannel.findUnique({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel tidak ditemukan');
        const val = (catalogId || '').trim() || null;
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
        await this.resolveCatalogId(channelId); // validasi channel + katalog ada
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

    async remove(_channelId: number, productId: string) {
        return this.safeMeta(() => this.cloud.deleteCatalogProduct(productId), 'Gagal menghapus produk katalog');
    }
}
