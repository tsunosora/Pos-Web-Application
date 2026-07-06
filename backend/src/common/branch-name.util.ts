/**
 * Util pencocokan NAMA CABANG (teks bebas) → CompanyBranch.id.
 *
 * Banyak entitas menyimpan cabang sebagai string snapshot (SalesOrder.branchName,
 * Designer.branchName) alih-alih FK. Fungsi ini menyatukan logika matching yang
 * sebelumnya terduplikasi di sales-orders.service (resolveBranchId) & kpi.service
 * (soMatchesBranch), supaya konsisten dan bisa dipakai backfill.
 *
 * Urutan match: exact name → exact code → partial contains (dua arah), case-insensitive.
 * Nama kosong / "pusat" → null (pusat = tanpa cabang spesifik, sesuai konvensi Designer).
 */
export type BranchRef = { id: number; name?: string | null; code?: string | null };

export function matchBranchId(
    branchName: string | null | undefined,
    branches: BranchRef[],
): number | null {
    const q = (branchName ?? '').toLowerCase().trim();
    if (!q) return null;
    const hit =
        branches.find(b => (b.name ?? '').toLowerCase().trim() === q) ||
        branches.find(b => (b.code ?? '').toLowerCase().trim() === q) ||
        branches.find(b => {
            const n = (b.name ?? '').toLowerCase().trim();
            return n && (n.includes(q) || q.includes(n));
        });
    return hit?.id ?? null;
}
