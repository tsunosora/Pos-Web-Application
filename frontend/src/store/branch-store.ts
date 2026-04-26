import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Branch store — menyimpan pilihan cabang aktif untuk user Owner/SuperAdmin.
 *
 * - `activeBranchId`:
 *    - number → Owner sedang view cabang tertentu.
 *    - null   → Owner mode "Semua Cabang" (agregat).
 *
 * Staff (non-owner) tidak pakai store ini — branchId mereka otomatis di-lock di JWT.
 *
 * Dipersist di localStorage supaya pilihan tetap setelah reload.
 */
interface BranchState {
    activeBranchId: number | null;
    setActiveBranchId: (id: number | null) => void;
    clear: () => void;
}

export const useBranchStore = create<BranchState>()(
    persist(
        (set) => ({
            activeBranchId: null,
            setActiveBranchId: (id) => set({ activeBranchId: id }),
            clear: () => set({ activeBranchId: null }),
        }),
        {
            name: 'pospro-active-branch',
        },
    ),
);

/**
 * Helper getter — dipanggil di axios interceptor (non-React scope).
 * Pakai getState supaya tidak perlu hook.
 */
export const getActiveBranchId = (): number | null =>
    useBranchStore.getState().activeBranchId;
