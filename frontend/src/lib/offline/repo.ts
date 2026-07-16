import { withDB, type OutboxOp, type OutboxOpType, type OutboxStatus, type RefStore } from './db';

// ---------- Baca mirror referensi ----------
export const listProductsLocal = () => withDB((db) => db.getAll('ref_products'), [] as any[]);
export const listVariantsLocal = () => withDB((db) => db.getAll('ref_variants'), [] as any[]);
export const listCategoriesLocal = () => withDB((db) => db.getAll('ref_categories'), [] as any[]);
export const listCustomersLocal = () => withDB((db) => db.getAll('ref_customers'), [] as any[]);
export const listBranchStocksLocal = () => withDB((db) => db.getAll('ref_branchStocks'), [] as any[]);

/** Stok satu varian di satu cabang (dari mirror). null bila tak ada. */
export async function getBranchStockLocal(
  productVariantId: number,
  branchId: number,
): Promise<number | null> {
  return withDB(async (db) => {
    const rows = await db.getAll('ref_branchStocks');
    const hit = rows.find(
      (r: any) => r.productVariantId === productVariantId && r.branchId === branchId,
    );
    return hit ? (hit as any).stock ?? null : null;
  }, null);
}

// ---------- Tulis mirror (dipakai mesin sync) ----------
/** Upsert banyak baris ke satu store mirror (dari hasil pull). */
export async function upsertRef(store: RefStore, rows: unknown[]): Promise<void> {
  if (!rows.length) return;
  await withDB(async (db) => {
    const tx = db.transaction(store, 'readwrite');
    await Promise.all(rows.map((r) => tx.store.put(r as any)));
    await tx.done;
  }, undefined);
}

/** Ganti seluruh isi store mirror (dipakai saat pull penuh / snapshot). */
export async function replaceRef(store: RefStore, rows: unknown[]): Promise<void> {
  await withDB(async (db) => {
    const tx = db.transaction(store, 'readwrite');
    await tx.store.clear();
    await Promise.all(rows.map((r) => tx.store.put(r as any)));
    await tx.done;
  }, undefined);
}

// ---------- Outbox (mutasi offline menunggu push) ----------
/** Antre mutasi offline. Mengembalikan clientId (UUID) yang dibuat. */
export async function enqueueOp(
  type: OutboxOpType,
  payload: any,
  branchId: number | null,
): Promise<string> {
  const clientId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `op-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const op: OutboxOp = {
    clientId,
    type,
    payload,
    status: 'pending',
    branchId,
    createdAt: Date.now(),
  };
  await withDB((db) => db.put('outbox', op).then(() => undefined), undefined);
  return clientId;
}

export const getOutbox = (status?: OutboxStatus) =>
  withDB(
    (db) => (status ? db.getAllFromIndex('outbox', 'by-status', status) : db.getAll('outbox')),
    [] as OutboxOp[],
  );

export const countOutbox = (status?: OutboxStatus) =>
  withDB(
    (db) =>
      status
        ? db.countFromIndex('outbox', 'by-status', status)
        : db.count('outbox'),
    0,
  );

export async function updateOutboxOp(clientId: string, patch: Partial<OutboxOp>): Promise<void> {
  await withDB(async (db) => {
    const cur = await db.get('outbox', clientId);
    if (cur) await db.put('outbox', { ...cur, ...patch });
  }, undefined);
}

export const deleteOutboxOp = (clientId: string) =>
  withDB((db) => db.delete('outbox', clientId).then(() => undefined), undefined);

// ---------- Meta (cursor sync, dll) ----------
export async function getMeta<T = any>(key: string): Promise<T | null> {
  return withDB(async (db) => {
    const row = await db.get('meta', key);
    return (row?.value as T) ?? null;
  }, null);
}

export async function setMeta(key: string, value: any): Promise<void> {
  await withDB((db) => db.put('meta', { key, value }).then(() => undefined), undefined);
}
