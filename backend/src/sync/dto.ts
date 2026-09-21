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
  omit?: string[]; // kolom rahasia — TIDAK PERNAH dikirim ke klien mana pun
  branchOrGlobal?: string; // kolom cabang: perangkat bercabang menarik baris cabangnya + yang tanpa cabang
}

export const ENTITY_REGISTRY: Record<string, EntitySpec> = {
  roles: { delegate: 'role', hasUpdatedAt: false },
  units: { delegate: 'unit', hasUpdatedAt: true },
  categories: { delegate: 'category', hasUpdatedAt: true },
  productionCategories: { delegate: 'productionCategory', hasUpdatedAt: true },
  companyBranches: { delegate: 'companyBranch', hasUpdatedAt: true },
  storeSettings: {
    delegate: 'storeSettings',
    hasUpdatedAt: true,
    // PIN papan tetap dikirim ke PERANGKAT (desktop offline membuka papan kerja tanpa internet);
    // entitas ini memang tidak bisa ditarik klien web (lihat WEB_PULLABLE_ENTITIES).
    omit: [
      'discordWebhookUrl',
      'githubWebhookSecret',
      'rcloneRemote',
      'rcloneLastStatus',
    ],
  },
  branchSettings: { delegate: 'branchSettings', hasUpdatedAt: true },
  // Hanya PERANGKAT (didaftarkan owner) yang menarik users — termasuk passwordHash untuk login
  // offline desktop (local-sync mewajibkannya). Perangkat bercabang: akun cabangnya + akun tanpa
  // cabang (owner). Klien web tidak bisa menarik entitas ini sama sekali.
  users: { delegate: 'user', hasUpdatedAt: true, branchOrGlobal: 'branchId' },
  bankAccounts: { delegate: 'bankAccount', hasUpdatedAt: true },
  products: { delegate: 'product', hasUpdatedAt: true },
  productVariants: { delegate: 'productVariant', hasUpdatedAt: true },
  variantPriceTiers: { delegate: 'variantPriceTier', hasUpdatedAt: true },
  customers: { delegate: 'customer', hasUpdatedAt: true },
  // Supplier & item-nya = referensi pembelian offline (global, tak ter-scope cabang).
  // Urutan: supplier dulu (parent) baru supplierItem (FK ke supplier + productVariant).
  suppliers: { delegate: 'supplier', hasUpdatedAt: true },
  supplierItems: { delegate: 'supplierItem', hasUpdatedAt: true },
  // Alur desainer: SalesOrder (dibuat di pusat, id stabil) → Lead → Nota. Ditarik ke
  // lokal agar kasir bisa buka & prefill SO/Lead lalu buat nota offline. Nota membawa
  // salesOrderId (id pusat) → saat push, pusat menandai SO=INVOICED & Lead=CLOSED_WON
  // otomatis (tak perlu remap FK). Item tak punya updatedAt → selalu pull penuh.
  // Urutan FK: SalesOrder → SalesOrderItem; Lead (FK convertedSalesOrderId) → LeadItem.
  salesOrders: { delegate: 'salesOrder', hasUpdatedAt: true },
  salesOrderItems: { delegate: 'salesOrderItem', hasUpdatedAt: true },
  leads: { delegate: 'lead', hasUpdatedAt: true },
  leadItems: { delegate: 'leadItem', hasUpdatedAt: true },
  branchStocks: { delegate: 'branchStock', hasUpdatedAt: true, branchField: 'branchId' },
};

export const PULLABLE_ENTITIES = Object.keys(ENTITY_REGISTRY);

// Klien JWT (web/PWA) hanya boleh menarik data referensi yang memang bisa dibaca staf.
// Entitas lain (users, pengaturan, rekening, SO/lead, …) khusus perangkat ber-token.
export const WEB_PULLABLE_ENTITIES = new Set<string>([
  'units',
  'categories',
  'productionCategories',
  'products',
  'productVariants',
  'variantPriceTiers',
  'customers',
  'branchStocks',
  'suppliers',
  'supplierItems',
]);
export type PullableEntity = string;

// ---- PUSH: klien mengirim mutasi transaksional yang dibuat saat offline ----
export type PushOpType =
  | 'transaction.create'
  | 'cashflow.create'
  | 'stockPurchase.create'
  | 'stockOpname.finish'
  | 'stockTransfer.create';

export interface PushOp {
  clientId: string; // UUID v4 dari device (kunci idempotensi)
  type: PushOpType;
  payload: any; // bentuk sesuai type (lihat sync.service)
  branchId?: number | null; // cabang tempat op DIBUAT (bukan cabang aktif saat sinkron)
  occurredAt?: string; // waktu op dibuat di perangkat (ISO)
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
