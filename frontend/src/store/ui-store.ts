import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarSectionKey = 'sales' | 'inventory' | 'production' | 'customers' | 'whatsapp' | 'landing' | 'others' | 'team';

export type InventoryViewMode = 'table' | 'grid' | 'compact' | 'gallery';

interface UIState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    closeSidebar: () => void;
    openSidebar: () => void;
    // Desktop: sidebar ciut ke mode ikon (rail) — persisted
    sidebarCollapsed: boolean;
    toggleSidebarCollapsed: () => void;
    // Collapsible sidebar groups — persisted ke localStorage
    collapsedSections: Record<SidebarSectionKey, boolean>;
    toggleSection: (key: SidebarSectionKey) => void;
    // Inventory view preference — persisted
    inventoryViewMode: InventoryViewMode;
    setInventoryViewMode: (mode: InventoryViewMode) => void;
    // Runtime: SubNav inline di header kehabisan ruang (terpotong) → pindah ke
    // dock mengambang di bawah, tanpa slide di header.
    subnavOverflow: boolean;
    setSubnavOverflow: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isSidebarOpen: false,
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            closeSidebar: () => set({ isSidebarOpen: false }),
            openSidebar: () => set({ isSidebarOpen: true }),
            sidebarCollapsed: false,
            toggleSidebarCollapsed: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
            collapsedSections: {
                sales: false,
                inventory: false,
                production: false,
                customers: false,
                whatsapp: false,
                landing: false,
                others: false,
                team: false,
            },
            toggleSection: (key) =>
                set((state) => ({
                    collapsedSections: {
                        ...state.collapsedSections,
                        [key]: !state.collapsedSections[key],
                    },
                })),
            inventoryViewMode: 'table',
            setInventoryViewMode: (mode) => set({ inventoryViewMode: mode }),
            subnavOverflow: false,
            setSubnavOverflow: (v) => set((state) => (state.subnavOverflow === v ? state : { subnavOverflow: v })),
        }),
        {
            name: 'pospro-ui',
            // Hanya persist preferensi visual, bukan state runtime
            partialize: (state) => ({
                collapsedSections: state.collapsedSections,
                inventoryViewMode: state.inventoryViewMode,
                sidebarCollapsed: state.sidebarCollapsed,
            }),
        },
    ),
);
