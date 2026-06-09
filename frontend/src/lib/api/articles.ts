// Articles / blog API
import api from './client';

export interface Article {
    id: number;
    title: string;
    slug: string;
    excerpt: string | null;
    content: string | null;
    coverImage: string | null;
    status: 'DRAFT' | 'PUBLISHED';
    publishedAt: string | null;
    authorName: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface ArticleListItem {
    id: number;
    title: string;
    slug: string;
    status: 'DRAFT' | 'PUBLISHED';
    publishedAt: string | null;
    coverImage: string | null;
    updatedAt: string;
}

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

// Admin
export const getArticles = async (): Promise<ArticleListItem[]> => (await api.get('/articles')).data;
export const getArticle = async (id: number): Promise<Article> => (await api.get(`/articles/${id}`)).data;
export const createArticle = async (data: ArticleInput): Promise<Article> => (await api.post('/articles', data)).data;
export const updateArticle = async (id: number, data: ArticleInput): Promise<Article> => (await api.put(`/articles/${id}`, data)).data;
export const deleteArticle = async (id: number): Promise<{ ok: boolean }> => (await api.delete(`/articles/${id}`)).data;

// Public
export interface PublicArticleCard {
    id: number; title: string; slug: string; excerpt: string | null;
    coverImage: string | null; publishedAt: string | null; authorName: string | null;
}
export const getPublicArticles = async (limit?: number): Promise<PublicArticleCard[]> =>
    (await api.get('/articles/public', { params: limit ? { limit } : {} })).data;
export const getPublicArticleBySlug = async (slug: string): Promise<Article> =>
    (await api.get(`/articles/public/${slug}`)).data;
