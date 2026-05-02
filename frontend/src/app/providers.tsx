"use client";

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { openDB, IDBPDatabase } from 'idb';
import { useState } from 'react';

const CACHE_MAX_AGE = 1000 * 60 * 60 * 24; // 24 jam

// IDB-backed async storage untuk persister
let cacheDbPromise: Promise<IDBPDatabase> | null = null;

function getCacheDB() {
    if (typeof window === 'undefined') return null;
    if (!cacheDbPromise) {
        cacheDbPromise = openDB('pos-query-cache', 1, {
            upgrade(db) {
                db.createObjectStore('cache');
            },
        });
    }
    return cacheDbPromise;
}

const idbStorage = {
    getItem: async (key: string): Promise<string | null> => {
        const db = await getCacheDB();
        if (!db) return null;
        return (await db.get('cache', key)) ?? null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
        const db = await getCacheDB();
        if (!db) return;
        await db.put('cache', value, key);
    },
    removeItem: async (key: string): Promise<void> => {
        const db = await getCacheDB();
        if (!db) return;
        await db.delete('cache', key);
    },
};

const persister = createAsyncStoragePersister({
    storage: idbStorage,
    key: 'pos-query-cache',
    throttleTime: 1000,
});

export default function Providers({ children }: { children: React.ReactNode }) {
    const [queryClient] = useState(() => new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 60 * 1000,       // data fresh selama 1 menit
                gcTime: CACHE_MAX_AGE,       // simpan di memory/cache 24 jam
                refetchOnWindowFocus: false,
                refetchOnReconnect: true,    // auto-refresh saat internet kembali
                // STOP polling saat tab tidak aktif (alt-tab / minimize) — hemat
                // CPU/battery/network besar-besaran. Saat user balik ke tab,
                // refetch otomatis kalau data sudah stale.
                refetchIntervalInBackground: false,
            },
        },
    }));

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge: CACHE_MAX_AGE,
                buster: '1',
            }}
        >
            {children}
        </PersistQueryClientProvider>
    );
}
