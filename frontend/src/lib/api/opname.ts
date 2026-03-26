import api from './client';

// Stock Opname — Admin (JWT required)
export const startOpnameSession = async (data: { notes?: string; categoryId?: number; expiresHours?: number }) =>
    (await api.post('/stock-opname/sessions', data)).data;
export const getOpnameSessions = async () => (await api.get('/stock-opname/sessions')).data;
export const getOpnameSessionDetail = async (id: string) => (await api.get(`/stock-opname/sessions/${id}`)).data;
export const cancelOpnameSession = async (id: string) => (await api.patch(`/stock-opname/sessions/${id}/cancel`)).data;
export const finishOpnameSession = async (id: string, confirmedItems: { productVariantId: number; confirmedStock: number }[]) =>
    (await api.post(`/stock-opname/sessions/${id}/finish`, { confirmedItems })).data;

// Stock Opname — Public (operator, no JWT)
export const verifyOpnameToken = async (token: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/stock-opname/public/${token}/verify`);
    if (!res.ok) throw new Error((await res.json()).message || 'Link tidak valid');
    return res.json();
};
export const getOpnameProducts = async (token: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/stock-opname/public/${token}/products`);
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal memuat produk');
    return res.json();
};
export const submitOpnameItems = async (
    token: string,
    data: { operatorName: string; items: { productVariantId: number; actualStock: number }[] },
) => {
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const res = await fetch(`${base}/stock-opname/public/${token}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json()).message || 'Gagal menyimpan');
    return res.json();
};
