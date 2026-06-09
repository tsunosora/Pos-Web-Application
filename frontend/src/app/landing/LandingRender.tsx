"use client";

import { useEffect, useState } from "react";
import { Render } from "@measured/puck";
import { config } from "@/components/landing/puck.config";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

export function LandingRender() {
    const [data, setData] = useState<any | null | undefined>(undefined);

    useEffect(() => {
        fetch(`${API}/landing/public`, { cache: "no-store" })
            .then((r) => r.json())
            .then((d) => setData(d?.data ?? null))
            .catch(() => setData(null));
    }, []);

    if (data === undefined) {
        return <div style={{ padding: 60, textAlign: "center", color: "#64748b" }}>Memuat…</div>;
    }
    if (!data) {
        return (
            <div style={{ minHeight: "60vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#64748b", textAlign: "center", padding: 24 }}>
                <h1 style={{ fontSize: 22, fontWeight: 700, color: "#334155" }}>Landing belum dipublikasikan</h1>
                <p>Atur & terbitkan halaman ini dari dashboard → Landing Builder.</p>
            </div>
        );
    }
    return <Render config={config} data={data} />;
}
