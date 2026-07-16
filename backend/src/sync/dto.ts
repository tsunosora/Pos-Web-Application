// Kontrak delta-sync offline. App ini tak pakai class-validator (lihat modul lain),
// jadi cukup interface TypeScript + validasi manual ringan di service.

// ---- PULL: klien menarik perubahan data referensi sejak cursor ----
export interface PullResult {
  serverTime: string; // ISO — cursor untuk pull berikutnya (simpan di klien)
  full: boolean; // true bila ini snapshot penuh (since kosong) → klien ganti mirror
  changes: Record<string, unknown[]>; // { products: [...], customers: [...], ... }
}

// Entitas referensi yang boleh di-pull (server-authoritative, pull-only).
export const PULLABLE_ENTITIES = [
  'products',
  'productVariants',
  'categories',
  'customers',
  'branchStocks',
] as const;
export type PullableEntity = (typeof PULLABLE_ENTITIES)[number];

// ---- PUSH: klien mengirim mutasi transaksional yang dibuat saat offline ----
export type PushOpType = 'transaction.create' | 'cashflow.create';

export interface PushOp {
  clientId: string; // UUID v4 dari device (kunci idempotensi)
  type: PushOpType;
  payload: any; // bentuk sesuai type (lihat sync.service)
}

export interface PushBody {
  ops: PushOp[];
}

export interface PushOpResult {
  clientId: string;
  status: 'applied' | 'duplicate' | 'error';
  serverId?: number; // PK record hasil buat di server
  invoiceNumber?: string; // untuk transaction.create
  message?: string; // untuk status 'error'
}

export interface PushResult {
  serverTime: string;
  results: PushOpResult[];
}
