import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SidebarSectionKey = 'sales' | 'inventory' | 'production' | 'customers' | 'others';

export type InventoryViewMode = 'table' | 'grid' | 'compact' | 'gallery';

interface UIState {
    isSidebarOpen: boolean;
    toggleSidebar: () => void;
    closeSidebar: () => void;
    openSidebar: () => void;
    // Collapsible sidebar groups — persisted ke localStorage
    collapsedSections: Record<SidebarSectionKey, boolean>;
    toggleSection: (key: SidebarSectionKey) => void;
    // Inventory view preference — persisted
    inventoryViewMode: InventoryViewMode;
    setInventoryViewMode: (mode: InventoryViewMode) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            isSidebarOpen: false,
            toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
            closeSidebar: () => set({ isSidebarOpen: false }),
            openSidebar: () => set({ isSidebarOpen: true }),
            collapsedSections: {
                sales: false,
                inventory: false,
                production: false,
                customers: false,
                others: false,
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
        }),
        {
            name: 'pospro-ui',
            // Hanya persist preferensi visual, bukan state runtime
            partialize: (state) => ({
                collapsedSections: state.collapsedSections,
                inventoryViewMode: state.inventoryViewMode,
            }),
        },
    ),
);
