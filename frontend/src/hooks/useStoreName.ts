import { useQuery } from '@tanstack/react-query';
import { getPublicSettings } from '@/lib/api/settings';

/**
 * Nama toko dari Profil Toko (Pengaturan → Umum), untuk footer, papan kerja, PDF, dll.
 * Dulu merek satu toko tertanam di kode, sehingga setiap pemasangan baru ikut
 * menampilkan merek itu (T-34). Fallback netral "Toko".
 */
export function useStoreName(): string {
    const { data } = useQuery({
        queryKey: ['public-settings'],
        queryFn: getPublicSettings,
        staleTime: 10 * 60 * 1000,
        retry: false,
    });
    const nama = typeof data?.storeName === 'string' ? data.storeName.trim() : '';
    return nama || 'Toko';
}

/** Nama, alamat & telepon toko dari Profil Toko (untuk kop struk/PDF). */
export function useStoreProfile(): { name: string; address: string; phone: string } {
    const { data } = useQuery({
        queryKey: ['public-settings'],
        queryFn: getPublicSettings,
        staleTime: 10 * 60 * 1000,
        retry: false,
    });
    const s = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
    return { name: s(data?.storeName) || 'Toko', address: s(data?.storeAddress), phone: s(data?.storePhone) };
}
