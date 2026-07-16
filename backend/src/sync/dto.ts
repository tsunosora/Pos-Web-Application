// Kontrak delta-sync offline. App ini tak pakai class-validator (lihat modul lain),
// jadi cukup interface TypeScript + validasi manual ringan di service.

// ---- PULL: klien menarik perubahan data referensi sejak cursor ----
export interface PullResult {
  serverTime: string; // ISO — cursor untuk pull berikutnya (simpan di klien)
  full: boolean; // true bila ini snapshot penuh (since kosong) → klien ganti mirror
  changes: Record<string, unknown[]>; // { products: [...], customers: [...], ... }
}

// Registry entitas master yang bisa di-pull (server-authoritative, pull-only).
// URUTAN = urutan dependensi FK → dipakai apa adanya untuk seed DB lokal (parent dulu).
export interface EntitySpec {
  delegate: string; // nama delegate PrismaClient (this.prisma[delegate])
  hasUpdatedAt: boolean; // punya kolom updatedAt (untuk delta)? kalau tidak → selalu full
  branchField?: string; // kalau ter-scope cabang (mis. branchStocks.branchId)
}

export const ENTITY_REGISTRY: Record<string, EntitySpec> = {
  roles: { delegate: 'role', hasUpdatedAt: false },
  units: { delegate: 'unit', hasUpdatedAt: true },
  categories: { delegate: 'category', hasUpdatedAt: true },
  productionCategories: { delegate: 'productionCategory', hasUpdatedAt: true },
  companyBranches: { delegate: 'companyBranch', hasUpdatedAt: true },
  storeSettings: { delegate: 'storeSettings', hasUpdatedAt: true },
  branchSettings: { delegate: 'branchSettings', hasUpdatedAt: true },
  users: { delegate: 'user', hasUpdatedAt: true }, // termasuk passwordHash → login offline
  bankAccounts: { delegate: 'bankAccount', hasUpdatedAt: true },
  products: { delegate: 'product', hasUpdatedAt: true },
  productVariants: { delegate: 'productVariant', hasUpdatedAt: true },
  variantPriceTiers: { delegate: 'variantPriceTier', hasUpdatedAt: true },
  customers: { delegate: 'customer', hasUpdatedAt: true },
  branchStocks: { delegate: 'branchStock', hasUpdatedAt: true, branchField: 'branchId' },
};

export const PULLABLE_ENTITIES = Object.keys(ENTITY_REGISTRY);
export type PullableEntity = string;

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
