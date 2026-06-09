import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface LandingConfigPatch {
    data?: any;
    draftData?: any;
    published?: boolean;
    customDomain?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
    faviconUrl?: string | null;
}

@Injectable()
export class LandingService {
    constructor(private readonly prisma: PrismaService) {}

    private get model(): any { return (this.prisma as any).landingConfig; }

    /** Singleton row (buat default kalau belum ada). */
    private async row() {
        let r = await this.model.findFirst({ orderBy: { id: 'asc' } });
        if (!r) r = await this.model.create({ data: { published: false } });
        return r;
    }

    /** Admin: seluruh config (termasuk draft). */
    async getAdmin() {
        return this.row();
    }

    /** Publik: hanya versi terpublikasi. data null kalau belum publish. */
    async getPublic() {
        const r = await this.model.findFirst({ orderBy: { id: 'asc' } });
        return {
            data: r?.published ? r.data : null,
            published: !!r?.published,
            customDomain: r?.customDomain ?? null,
            seoTitle: r?.seoTitle ?? null,
            seoDescription: r?.seoDescription ?? null,
            faviconUrl: r?.faviconUrl ?? null,
        };
    }

    async update(patch: LandingConfigPatch) {
        const r = await this.row();
        const data: any = {};
        const keys: (keyof LandingConfigPatch)[] = [
            'data', 'draftData', 'published', 'customDomain', 'seoTitle', 'seoDescription', 'faviconUrl',
        ];
        for (const k of keys) if (patch[k] !== undefined) data[k] = patch[k];
        return this.model.update({ where: { id: r.id }, data });
    }

    /** Publish: salin draftData → data, tandai published. */
    async publish() {
        const r = await this.row();
        return this.model.update({
            where: { id: r.id },
            data: { data: r.draftData ?? r.data, published: true },
        });
    }

    /** Unpublish: sembunyikan landing dari publik (data tetap tersimpan). */
    async unpublish() {
        const r = await this.row();
        return this.model.update({ where: { id: r.id }, data: { published: false } });
    }
}
