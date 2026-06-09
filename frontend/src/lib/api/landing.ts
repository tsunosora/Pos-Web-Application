// Landing page builder API
import api from './client';

// Puck data shape (longgar — struktur internal Puck)
export interface PuckData {
    content: any[];
    root: any;
    zones?: Record<string, any[]>;
}

export interface LandingAdmin {
    id: number;
    data: PuckData | null;
    draftData: PuckData | null;
    published: boolean;
    customDomain: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    faviconUrl: string | null;
}

export interface LandingPublic {
    data: PuckData | null;
    published: boolean;
    customDomain: string | null;
    seoTitle: string | null;
    seoDescription: string | null;
    faviconUrl: string | null;
}

export const getLandingAdmin = async (): Promise<LandingAdmin> =>
    (await api.get('/landing')).data;

export const updateLanding = async (data: Partial<LandingAdmin>): Promise<LandingAdmin> =>
    (await api.put('/landing', data)).data;

export const publishLanding = async (): Promise<LandingAdmin> =>
    (await api.post('/landing/publish')).data;

export const unpublishLanding = async (): Promise<LandingAdmin> =>
    (await api.post('/landing/unpublish')).data;

export const getLandingPublic = async (): Promise<LandingPublic> =>
    (await api.get('/landing/public')).data;
