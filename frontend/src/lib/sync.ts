import { withDB } from './offline/db';

// Store lama `offline-transactions` — dipertahankan untuk kompatibilitas. DB dibuka
// terpusat di ./offline/db.ts (v2) yang juga punya mirror referensi + outbox baru.
// Fase 5 akan menyatukan jalur ini ke outbox; untuk sekarang API lama tetap bekerja.

export async function saveOfflineTransaction(payload: any) {
  await withDB(
    (db) => db.add('offline-transactions', { payload, timestamp: Date.now() }).then(() => undefined),
    undefined,
  );
}

export async function getOfflineTransactions() {
  return withDB((db) => db.getAllFromIndex('offline-transactions', 'by-timestamp'), []);
}

export async function clearOfflineTransaction(id: number) {
  await withDB((db) => db.delete('offline-transactions', id).then(() => undefined), undefined);
}
