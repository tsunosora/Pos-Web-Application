"use client";

import { useEffect, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** Dropdown kategori — opsi diambil dari kategori produk di katalog. Simpan id (string). */
export function CategorySelectField({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
    const [cats, setCats] = useState<{ id: number; name: string }[]>([]);

    useEffect(() => {
        fetch(`${API}/products/public`, { cache: "no-store" })
            .then((r) => r.json())
            .then((list) => {
                const map = new Map<number, string>();
                (Array.isArray(list) ? list : []).forEach((p: any) => {
                    const c = p.category;
                    if (c?.id && !map.has(c.id)) map.set(c.id, c.name);
                });
                setCats(Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)));
            })
            .catch(() => setCats([]));
    }, []);

    return (
        <select
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 8px", fontSize: 13 }}
        >
            <option value="">— pilih kategori —</option>
            {cats.map((c) => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
            ))}
        </select>
    );
}
