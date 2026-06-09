import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ArticleInput {
    title?: string;
    slug?: string;
    excerpt?: string | null;
    content?: string | null;
    coverImage?: string | null;
    status?: 'DRAFT' | 'PUBLISHED';
    authorName?: string | null;
    seoTitle?: string | null;
    seoDescription?: string | null;
}

@Injectable()
export class ArticlesService {
    constructor(private readonly prisma: PrismaService) {}

    private get model(): any { return (this.prisma as any).article; }

    private slugify(s: string): string {
        return (s || '')
            .toLowerCase().trim()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || 'artikel';
    }

    private async uniqueSlug(base: string, excludeId?: number): Promise<string> {
        let slug = base;
        let i = 2;
        // batasi loop wajar
        for (let n = 0; n < 100; n++) {
            const existing = await this.model.findUnique({ where: { slug } });
            if (!existing || existing.id === excludeId) return slug;
            slug = `${base}-${i++}`;
        }
        return `${base}-${Date.now()}`;
    }

    // ── Admin ───────────────────────────────────────────────────────────────
    async list() {
        return this.model.findMany({
            orderBy: [{ createdAt: 'desc' }],
            select: { id: true, title: true, slug: true, status: true, publishedAt: true, coverImage: true, updatedAt: true },
        });
    }

    async getOne(id: number) {
        const a = await this.model.findUnique({ where: { id } });
        if (!a) throw new NotFoundException('Artikel tidak ditemukan');
        return a;
    }

    async create(data: ArticleInput) {
        const base = this.slugify(data.slug || data.title || 'artikel');
        const slug = await this.uniqueSlug(base);
        const status = data.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
        return this.model.create({
            data: {
                title: data.title || 'Tanpa Judul',
                slug,
                excerpt: data.excerpt ?? null,
                content: data.content ?? null,
                coverImage: data.coverImage ?? null,
                status,
                publishedAt: status === 'PUBLISHED' ? new Date() : null,
                authorName: data.authorName ?? null,
                seoTitle: data.seoTitle ?? null,
                seoDescription: data.seoDescription ?? null,
            },
        });
    }

    async update(id: number, data: ArticleInput) {
        const cur = await this.getOne(id);
        const patch: any = {};
        if (data.title !== undefined) patch.title = data.title;
        if (data.slug !== undefined) patch.slug = await this.uniqueSlug(this.slugify(data.slug || data.title || cur.title), id);
        if (data.excerpt !== undefined) patch.excerpt = data.excerpt;
        if (data.content !== undefined) patch.content = data.content;
        if (data.coverImage !== undefined) patch.coverImage = data.coverImage;
        if (data.authorName !== undefined) patch.authorName = data.authorName;
        if (data.seoTitle !== undefined) patch.seoTitle = data.seoTitle;
        if (data.seoDescription !== undefined) patch.seoDescription = data.seoDescription;
        if (data.status !== undefined) {
            patch.status = data.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT';
            // set publishedAt saat pertama kali publish
            if (patch.status === 'PUBLISHED' && !cur.publishedAt) patch.publishedAt = new Date();
        }
        return this.model.update({ where: { id }, data: patch });
    }

    async remove(id: number) {
        await this.getOne(id);
        await this.model.delete({ where: { id } });
        return { ok: true };
    }

    // ── Publik ──────────────────────────────────────────────────────────────
    async listPublic(limit?: number) {
        return this.model.findMany({
            where: { status: 'PUBLISHED' },
            orderBy: [{ publishedAt: 'desc' }],
            take: limit && limit > 0 ? limit : undefined,
            select: { id: true, title: true, slug: true, excerpt: true, coverImage: true, publishedAt: true, authorName: true },
        });
    }

    async getBySlugPublic(slug: string) {
        const a = await this.model.findFirst({ where: { slug, status: 'PUBLISHED' } });
        if (!a) throw new NotFoundException('Artikel tidak ditemukan');
        return a;
    }
}
