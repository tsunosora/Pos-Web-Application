import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface POSDB extends DBSchema {
    'offline-transactions': {
        key: number;
        value: {
            id?: number;
            payload: any;
            timestamp: number;
        };
        indexes: { 'by-timestamp': number };
    };
}

let dbPromise: Promise<IDBPDatabase<POSDB>> | null = null;

if (typeof window !== 'undefined') {
    dbPromise = openDB<POSDB>('pos-offline-db', 1, {
        upgrade(db) {
            const store = db.createObjectStore('offline-transactions', {
                keyPath: 'id',
                autoIncrement: true,
            });
            store.createIndex('by-timestamp', 'timestamp');
        },
    });
}

export async function saveOfflineTransaction(payload: any) {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.add('offline-transactions', {
        payload,
        timestamp: Date.now(),
    });
}

export async function getOfflineTransactions() {
    if (!dbPromise) return [];
    const db = await dbPromise;
    return await db.getAllFromIndex('offline-transactions', 'by-timestamp');
}

export async function clearOfflineTransaction(id: number) {
    if (!dbPromise) return;
    const db = await dbPromise;
    await db.delete('offline-transactions', id);
}
