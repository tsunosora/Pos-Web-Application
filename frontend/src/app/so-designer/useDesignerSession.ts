"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export const SESSION_KEY = "designer_session";

export interface DesignerSession {
    id: number;
    name: string;
    pin: string;
}

export function useDesignerSession(redirectIfNone = true): DesignerSession | null {
    const router = useRouter();
    const [session, setSession] = useState<DesignerSession | null>(null);

    useEffect(() => {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) {
            if (redirectIfNone) router.replace("/so-designer");
            return;
        }
        try {
            setSession(JSON.parse(raw));
        } catch {
            sessionStorage.removeItem(SESSION_KEY);
            if (redirectIfNone) router.replace("/so-designer");
        }
    }, [router, redirectIfNone]);

    return session;
}

export function clearDesignerSession() {
    sessionStorage.removeItem(SESSION_KEY);
}
