"use client";

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { openDB, IDBPDatabase } from 'idb';
import { useState } from 'react';
import { ThemeProvider } from '@/components/ThemeProvider';

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
                refetchIntervalInBackground: false,
                // Jangan retry error 4xx (403/401/404/422) — percuma & bikin
                // query stuck di error state lama. Hanya retry error jaringan
                // atau 5xx (server down / transient).
                retry: (failureCount: number, error: any) => {
                    const status = error?.response?.status ?? error?.status;
                    if (status && status >= 400 && status < 500) return false;
                    return failureCount < 2;
                },
            },
        },
    }));

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister,
                maxAge: CACHE_MAX_AGE,
                buster: '3',
                // Hanya simpan query yang berhasil (status 'success') ke IDB.
                // Query error tidak dipersist — kalau token baru atau permission
                // berubah, query akan refetch fresh tanpa dibebani error lama.
                dehydrateOptions: {
                    shouldDehydrateQuery: (query) => query.state.status === 'success',
                },
            }}
        >
            <ThemeProvider>{children}</ThemeProvider>
        </PersistQueryClientProvider>
    );
}
