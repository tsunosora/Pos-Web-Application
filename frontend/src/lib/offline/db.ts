import { openDB, DBSchema, IDBPDatabase } from 'idb';

// Satu-satunya pembuka `pos-offline-db`. v2 menambah mirror referensi + outbox + meta
// di atas store lama `offline-transactions` (dipertahankan agar SyncManager lama tetap
// jalan selama transisi ke outbox baru di Fase 5).

export type OutboxStatus = 'pending' | 'error' | 'done';
export type OutboxOpType = 'transaction.create' | 'cashflow.create';

export interface OutboxOp {
  clientId: string; // UUID v4 (keyPath) — kunci idempotensi, sama dg SyncedOp di server
  type: OutboxOpType;
  payload: any;
  status: OutboxStatus;
  branchId: number | null;
  createdAt: number;
  error?: string; // pesan bila status 'error'
  serverId?: number; // PK hasil buat di server (setelah applied/duplicate)
  invoiceNumber?: string; // untuk transaction.create
}

export interface MetaRow {
  key: string;
  value: any;
}

// Baris mirror = record referensi apa adanya dari server (punya `id`).
type RefRow = { id: number; [k: string]: unknown };

interface OfflineDB extends DBSchema {
  'offline-transactions': {
    key: number;
    value: { id?: number; payload: any; timestamp: number };
    indexes: { 'by-timestamp': number };
  };
  ref_products: { key: number; value: RefRow };
  ref_variants: { key: number; value: RefRow };
  ref_categories: { key: number; value: RefRow };
  ref_customers: { key: number; value: RefRow };
  ref_branchStocks: { key: number; value: RefRow };
  outbox: { key: string; value: OutboxOp; indexes: { 'by-status': string } };
  meta: { key: string; value: MetaRow };
}

export type RefStore =
  | 'ref_products'
  | 'ref_variants'
  | 'ref_categories'
  | 'ref_customers'
  | 'ref_branchStocks';

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

/** Buka DB (singleton). Null di server (SSR). */
export function getDB(): Promise<IDBPDatabase<OfflineDB>> | null {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const t = db.createObjectStore('offline-transactions', {
            keyPath: 'id',
            autoIncrement: true,
          });
          t.createIndex('by-timestamp', 'timestamp');
        }
        if (oldVersion < 2) {
          for (const s of [
            'ref_products',
            'ref_variants',
            'ref_categories',
            'ref_customers',
            'ref_branchStocks',
          ] as const) {
            db.createObjectStore(s, { keyPath: 'id' });
          }
          const ob = db.createObjectStore('outbox', { keyPath: 'clientId' });
          ob.createIndex('by-status', 'status');
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

/** Helper await DB dengan penanganan SSR. */
export async function withDB<T>(
  fn: (db: IDBPDatabase<OfflineDB>) => Promise<T>,
  fallback: T,
): Promise<T> {
  const p = getDB();
  if (!p) return fallback;
  return fn(await p);
}
