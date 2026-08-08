import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudApiService } from './cloud-api.service';

export interface CatalogProductInput {
    name?: string;
    description?: string | null;
    priceRupiah?: number; // harga rupiah (dikonversi ke minor unit ×100 utk Meta)
    currency?: string;
    imageUrl?: string;
    url?: string | null;
    availability?: string; // 'in stock' | 'out of stock'
    retailerId?: string;
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
    private async resolveCatalogId(channelId: number): Promise<string> {
        const channel = await this.prisma.waChannel.findUnique({ where: { id: channelId } });
        if (!channel) throw new NotFoundException('Channel tidak ditemukan');
        if (channel.catalogId) return channel.catalogId;
        const auto = await this.cloud.getWabaCatalogId(channel.wabaId);
        if (!auto) {
            throw new BadRequestException(
                'Katalog belum terhubung ke WABA ini. Hubungkan katalog di Meta Commerce Manager, ' +
                    'lalu coba lagi (atau isi Catalog ID di Pengaturan Channel). Pastikan token punya izin catalog_management.',
            );
        }
        await this.prisma.waChannel.update({ where: { id: channelId }, data: { catalogId: auto } });
        return auto;
    }

    async list(channelId: number) {
        const catalogId = await this.resolveCatalogId(channelId);
        const rows = await this.cloud.listCatalogProducts(catalogId);
        return rows.map((p) => ({
            id: p.id,
            retailerId: p.retailer_id ?? null,
            name: p.name ?? null,
            description: p.description ?? null,
            price: p.price ?? null, // string terformat dari Meta (mis. "Rp250.000,00")
            currency: p.currency ?? null,
            imageUrl: p.image_url ?? null,
            url: p.url ?? null,
            availability: p.availability ?? null,
        }));
    }

    async create(channelId: number, input: CatalogProductInput) {
        const catalogId = await this.resolveCatalogId(channelId);
        if (!input.name?.trim()) throw new BadRequestException('Nama produk wajib diisi');
        if (!input.imageUrl?.trim()) throw new BadRequestException('URL gambar wajib (harus dapat diakses publik oleh Meta)');
        const payload: Record<string, unknown> = {
            retailer_id: input.retailerId?.trim() || slugRetailerId(input.name),
            name: input.name.trim(),
            description: input.description?.trim() || input.name.trim(),
            price: Math.round((input.priceRupiah ?? 0) * 100),
            currency: input.currency || 'IDR',
            image_url: input.imageUrl.trim(),
            availability: input.availability || 'in stock',
            ...(input.url?.trim() ? { url: input.url.trim() } : {}),
        };
        return this.cloud.createCatalogProduct(catalogId, payload);
    }

    async update(channelId: number, productId: string, input: CatalogProductInput) {
        await this.resolveCatalogId(channelId); // validasi channel + katalog ada
        const payload: Record<string, unknown> = {};
        if (input.name !== undefined) payload.name = input.name.trim();
        if (input.description !== undefined) payload.description = input.description?.trim() || undefined;
        if (input.priceRupiah !== undefined) payload.price = Math.round(input.priceRupiah * 100);
        if (input.currency !== undefined) payload.currency = input.currency;
        if (input.imageUrl !== undefined) payload.image_url = input.imageUrl.trim();
        if (input.availability !== undefined) payload.availability = input.availability;
        if (input.url !== undefined) payload.url = input.url?.trim() || undefined;
        if (Object.keys(payload).length === 0) throw new BadRequestException('Tak ada perubahan');
        return this.cloud.updateCatalogProduct(productId, payload);
    }

    async remove(_channelId: number, productId: string) {
        return this.cloud.deleteCatalogProduct(productId);
    }
}
