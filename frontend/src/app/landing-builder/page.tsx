"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { config } from "@/components/landing/puck.config";
import { getLandingAdmin, updateLanding, publishLanding } from "@/lib/api/landing";

const EMPTY = { content: [], root: {} } as any;

export default function LandingBuilderPage() {
    const [initial, setInitial] = useState<any | null>(null);
    const dataRef = useRef<any>(EMPTY);
    const [msg, setMsg] = useState<string>("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getLandingAdmin()
            .then((cfg) => {
                const d = cfg.draftData || cfg.data || EMPTY;
                dataRef.current = d;
                setInitial(d);
            })
            .catch(() => setInitial(EMPTY));
    }, []);

    const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

    const saveDraft = async () => {
        setBusy(true);
        try { await updateLanding({ draftData: dataRef.current }); flash("✅ Draft tersimpan"); }
        catch (e: any) { flash("❌ Gagal simpan: " + (e?.response?.data?.message || e?.message || e)); }
        finally { setBusy(false); }
    };

    const publish = async (data?: any) => {
        const d = data || dataRef.current;
        setBusy(true);
        try {
            await updateLanding({ draftData: d });
            await publishLanding();
            flash("🚀 Landing diterbitkan");
        } catch (e: any) {
            flash("❌ Gagal terbit: " + (e?.response?.data?.message || e?.message || e));
        } finally { setBusy(false); }
    };

    if (!initial) {
        return <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>Memuat builder…</div>;
    }

    const btn: React.CSSProperties = { fontSize: 13, padding: "6px 12px", borderRadius: 8, cursor: "pointer", border: "1px solid #cbd5e1", background: "#fff", color: "#334155" };

    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
            {/* Bar atas custom — selalu tampil */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 14px", borderBottom: "1px solid #e5e7eb", background: "#fff", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Link href="/landing-page" style={{ fontSize: 13, color: "#64748b", textDecoration: "none", fontWeight: 600 }}>← Landing Page</Link>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>Landing Builder</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {msg && <span style={{ fontSize: 12, color: "#334155" }}>{msg}</span>}
                    <a href="/landing" target="_blank" rel="noreferrer" style={{ ...btn, textDecoration: "none" }}>Pratinjau</a>
                    <button onClick={saveDraft} disabled={busy} style={btn}>Simpan Draft</button>
                    <button onClick={() => publish()} disabled={busy} style={{ ...btn, background: "#4f46e5", color: "#fff", border: "none", fontWeight: 700 }}>Terbitkan</button>
                </div>
            </div>

            {/* Editor Puck mengisi sisa ruang */}
            <div style={{ flex: 1, minHeight: 0 }}>
                <Puck
                    config={config}
                    data={initial}
                    onChange={(d: any) => { dataRef.current = d; }}
                    onPublish={(d: any) => publish(d)}
                />
            </div>
        </div>
    );
}
