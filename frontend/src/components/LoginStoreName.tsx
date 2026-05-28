'use client';

import { useEffect, useLayoutEffect, useState } from 'react';
import { getPublicSettings } from '@/lib/api';

const CACHE_KEY = '__vl_login_cfg';

export function LoginStoreName() {
    const [storeName, setStoreName] = useState('PosPro');

    useLayoutEffect(() => {
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                const cached = JSON.parse(raw);
                if (cached?.storeName) setStoreName(cached.storeName);
            }
        } catch {}
    }, []);

    useEffect(() => {
        getPublicSettings()
            .then(s => { if (s?.storeName) setStoreName(s.storeName); })
            .catch(() => {});
    }, []);

    return <>{storeName}</>;
}
