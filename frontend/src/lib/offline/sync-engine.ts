import { pullSync, pushSync } from '../api/sync';
import {
  replaceRef,
  upsertRef,
  getMeta,
  setMeta,
  getOutbox,
  updateOutboxOp,
  deleteOutboxOp,
} from './repo';
import type { RefStore } from './db';

// Mesin delta-sync dua arah. Referensi = pull-only (server-authoritative); mutasi
// offline (transaksi/cashflow) di outbox = push idempoten (server dedup via clientId).

const CURSOR_KEY = 'syncCursor';
const LAST_PULL_KEY = 'lastPullAt';

// Peta nama entitas server → store mirror lokal.
const ENTITY_STORE: Record<string, RefStore> = {
  products: 'ref_products',
  productVariants: 'ref_variants',
  categories: 'ref_categories',
  customers: 'ref_customers',
  branchStocks: 'ref_branchStocks',
};

function isAuthed(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(localStorage.getItem('token') || sessionStorage.getItem('token'));
}

/** Tarik perubahan referensi sejak cursor → tulis mirror → simpan cursor baru. */
export async function pullNow(): Promise<void> {
  const since = await getMeta<string>(CURSOR_KEY);
  const res = await pullSync(since ?? undefined);
  for (const [entity, rows] of Object.entries(res.changes)) {
    const store = ENTITY_STORE[entity];
    if (!store || !Array.isArray(rows)) continue;
    // Pull penuh (snapshot) → ganti seluruh mirror. Delta → upsert baris berubah.
    if (res.full) await replaceRef(store, rows);
    else await upsertRef(store, rows);
  }
  await setMeta(CURSOR_KEY, res.serverTime);
  await setMeta(LAST_PULL_KEY, Date.now());
}

/** Dorong semua op di outbox ke server. Push idempoten → aman di-retry. */
export async function pushNow(): Promise<{ pushed: number; errors: number }> {
  // Semua yang tersisa di outbox belum tersinkron (yang sukses sudah dihapus).
  // Sertakan op status 'error' agar kegagalan transien pulih otomatis (idempoten).
  const outbox = await getOutbox();
  if (!outbox.length) return { pushed: 0, errors: 0 };

  const res = await pushSync(
    outbox.map((o) => ({ clientId: o.clientId, type: o.type, payload: o.payload })),
  );

  let pushed = 0;
  let errors = 0;
  for (const r of res.results) {
    if (r.status === 'applied' || r.status === 'duplicate') {
      await deleteOutboxOp(r.clientId);
      pushed++;
    } else {
      await updateOutboxOp(r.clientId, { status: 'error', error: r.message });
      errors++;
    }
  }
  return { pushed, errors };
}

let running = false;

/** Satu siklus sync: push dulu (kirim mutasi lokal) lalu pull (tarik referensi). */
export async function syncNow(): Promise<void> {
  if (running || !isAuthed()) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;
  running = true;
  try {
    await pushNow();
    await pullNow();
  } catch {
    // Diamkan — siklus berikutnya (interval / event online) mencoba lagi.
  } finally {
    running = false;
  }
}

let stopFn: (() => void) | null = null;

/**
 * Mulai auto-sync: sync awal + saat kembali online + interval berkala.
 * Idempoten: panggilan kedua tak menggandakan listener. Mengembalikan fungsi stop.
 */
export function startAutoSync(intervalMs = 60_000): () => void {
  if (typeof window === 'undefined') return () => {};
  if (stopFn) return stopFn;

  void syncNow();
  const onOnline = () => void syncNow();
  window.addEventListener('online', onOnline);
  const timer = window.setInterval(() => void syncNow(), intervalMs);

  stopFn = () => {
    window.removeEventListener('online', onOnline);
    window.clearInterval(timer);
    stopFn = null;
  };
  return stopFn;
}
