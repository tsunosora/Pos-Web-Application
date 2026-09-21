/**
 * Bersihkan data sesi di browser saat logout / ganti akun. Perangkat toko dipakai bergantian:
 * dulu keranjang (termasuk harga manual & SO), notifikasi, cache kueri, cache offline produk/
 * pelanggan/pengaturan, dan cabang aktif milik akun sebelumnya ikut terbawa ke akun berikutnya.
 * Antrean nota offline (outbox) TIDAK dihapus — itu uang yang belum terkirim.
 */
import type { QueryClient } from '@tanstack/react-query';
import { openDB } from 'idb';
import { useCartStore } from '@/store/cart-store';
import { useBranchStore } from '@/store/branch-store';
import { useNotificationStore } from '@/store/notification-store';
import { setMeta, countOutbox } from '@/lib/offline/repo';

export async function clearSessionData(queryClient?: QueryClient): Promise<void> {
    try { queryClient?.clear(); } catch { /* abaikan */ }
    try { useCartStore.getState().clearCart(); } catch { /* abaikan */ }
    try { useBranchStore.getState().setActiveBranchId(null); } catch { /* abaikan */ }
    try { useNotificationStore.getState().clearAll(); } catch { /* abaikan */ }
    // Cache kueri yang tersimpan di IndexedDB (persister React Query).
    try {
        const db = await openDB('pos-query-cache', 1, { upgrade(d) { d.createObjectStore('cache'); } });
        await db.delete('cache', 'pos-query-cache');
        db.close();
    } catch { /* abaikan */ }
    // Cache offline referensi (bentuk respons API) — bukan outbox.
    for (const k of ['products', 'customers', 'settings']) {
        try { await setMeta(`cache:${k}`, null); } catch { /* abaikan */ }
    }
}

/** Jumlah nota/kas offline yang belum terkirim (untuk peringatan sebelum logout). */
export async function outboxBelumTerkirim(): Promise<number> {
    try { return await countOutbox(); } catch { return 0; }
}
