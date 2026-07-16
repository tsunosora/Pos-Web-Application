import { getMeta, setMeta } from './repo';

// Cache respons API "apa adanya" ke IndexedDB agar halaman (mis. POS) tetap bisa
// baca data saat offline dengan BENTUK PERSIS sama seperti online (produk nested
// variants + priceTiers, dll). Beda dari mirror ref_* yang ternormalisasi/flat.
//
// Perilaku: online → ambil dari server + simpan cache; offline/fetch gagal →
// kembalikan cache terakhir. Kalau belum pernah ada cache → lempar error asli.
export async function offlineCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cacheKey = `cache:${key}`;
  try {
    const data = await fetcher();
    // Simpan cache tanpa memblokir hasil (best-effort).
    void setMeta(cacheKey, data);
    return data;
  } catch (err) {
    const cached = await getMeta<T>(cacheKey);
    if (cached != null) return cached;
    throw err;
  }
}
