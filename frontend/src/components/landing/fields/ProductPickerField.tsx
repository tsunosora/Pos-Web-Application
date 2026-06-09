"use client";

import { useEffect, useMemo, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** Pemilih produk (multi) — simpan array id produk. Untuk mode "pilih manual/unggulan". */
export function ProductPickerField({ value, onChange }: { value?: number[]; onChange: (v: number[]) => void }) {
    const [items, setItems] = useState<{ id: number; name: string }[]>([]);
    const [q, setQ] = useState("");
    const selected = Array.isArray(value) ? value : [];

    useEffect(() => {
        fetch(`${API}/products/public`, { cache: "no-store" })
            .then((r) => r.json())
            .then((list) => setItems((Array.isArray(list) ? list : []).map((p: any) => ({ id: p.id, name: p.name }))))
            .catch(() => setItems([]));
    }, []);

    const filtered = useMemo(
        () => (q ? items.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : items),
        [items, q],
    );

    const toggle = (id: number) =>
        onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

    return (
        <div>
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari produk…"
                style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", fontSize: 12, marginBottom: 6 }}
            />
            <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{selected.length} dipilih</div>
            <div style={{ maxHeight: 200, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 6, padding: 6 }}>
                {filtered.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>Tidak ada produk.</div>}
                {filtered.map((p) => (
                    <label key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, padding: "2px 0", cursor: "pointer" }}>
                        <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
                        {p.name}
                    </label>
                ))}
            </div>
        </div>
    );
}
