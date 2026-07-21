"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
    X, Settings, FileText, Megaphone, Bot, BellRing, BarChart3, Inbox, ArrowRight, CheckCircle2,
} from "lucide-react";

const SETUP = [
    "Owner/Admin: buat Meta Business + App (WhatsApp), verifikasi nomor tiap cabang.",
    "Isi kredensial di .env server (token, app secret, verify token) → WA_CLOUD_ENABLED=true.",
    "Set Webhook di Meta ke /whatsapp/webhook (field: messages).",
    "Daftarkan nomor tiap cabang di Pengaturan Channel → tombol \"Cek koneksi\".",
];

const FEATURES: Array<{ icon: typeof Inbox; name: string; roles: string; desc: string }> = [
    { icon: Inbox, name: "Inbox Chat", roles: "CS · Marketing · Admin", desc: "Balas chat. Dalam 24 jam: teks bebas. Lewat 24 jam: pilih template." },
    { icon: FileText, name: "Template Meta", roles: "Owner · Admin · Marketing", desc: "Buat → submit ke Meta → sinkron status. Hanya APPROVED yang bisa dipakai." },
    { icon: Megaphone, name: "Broadcast", roles: "Owner · Admin · Marketing", desc: "Blast template ke segmen kontak. Opt-out otomatis dikecualikan." },
    { icon: Bot, name: "Balasan Otomatis", roles: "Owner · Admin · Marketing", desc: "Salam / kata kunci / default. STOP = opt-out. Skip bila agen aktif." },
    { icon: BellRing, name: "Reminder POS", roles: "Owner · Admin", desc: "Pesanan siap ambil, tagihan, follow-up — kirim template otomatis." },
    { icon: BarChart3, name: "Analitik", roles: "Owner · Admin", desc: "Metrik pesan, % dibaca, lead dari WA, performa broadcast." },
    { icon: Settings, name: "Pengaturan Channel", roles: "Owner · Admin", desc: "Daftarkan nomor per cabang + cek koneksi." },
];

export function WhatsappGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
    // Portal hanya di klien (hindari mismatch SSR).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        // Kunci scroll body selama modal terbuka.
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    if (!open || !mounted) return null;

    // Portal ke <body> agar tidak terpotong/terkurung oleh panel inbox yang
    // punya `overflow-hidden` + `backdrop-blur` (backdrop-filter membuat
    // containing block baru untuk elemen position:fixed).
    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in"
            onClick={onClose}
        >
            <div
                className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-card/95 backdrop-blur border-b border-border px-5 py-3 flex items-center justify-between">
                    <h2 className="font-semibold">Panduan WhatsApp CRM</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted"><X className="w-4 h-4" /></button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Setup */}
                    <section>
                        <h3 className="text-sm font-semibold mb-2 opacity-80">1. Setup awal (sekali — Owner/Admin)</h3>
                        <ol className="space-y-1.5">
                            {SETUP.map((s, i) => (
                                <li key={i} className="flex gap-2 text-sm">
                                    <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 grid place-items-center text-xs font-medium">{i + 1}</span>
                                    <span className="opacity-80">{s}</span>
                                </li>
                            ))}
                        </ol>
                    </section>

                    {/* Alur pesan masuk */}
                    <section>
                        <h3 className="text-sm font-semibold mb-2 opacity-80">2. Alur pesan masuk (otomatis)</h3>
                        <div className="flex items-center flex-wrap gap-1.5 text-xs">
                            {["Pelanggan chat", "Webhook (verifikasi)", "Route cabang", "Tautkan / Auto-create Lead", "Auto-reply", "Muncul di Inbox"].map((step, i, arr) => (
                                <span key={step} className="flex items-center gap-1.5">
                                    <span className="px-2 py-1 rounded-lg bg-muted/60">{step}</span>
                                    {i < arr.length - 1 && <ArrowRight className="w-3 h-3 opacity-40" />}
                                </span>
                            ))}
                        </div>
                    </section>

                    {/* Fitur & peran */}
                    <section>
                        <h3 className="text-sm font-semibold mb-2 opacity-80">3. Fitur &amp; peran</h3>
                        <div className="grid sm:grid-cols-2 gap-2">
                            {FEATURES.map((f) => (
                                <div key={f.name} className="rounded-xl border border-border bg-muted/20 p-3">
                                    <div className="flex items-center gap-2">
                                        <f.icon className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span className="text-sm font-medium">{f.name}</span>
                                    </div>
                                    <div className="text-[11px] text-emerald-600/80 mt-0.5">{f.roles}</div>
                                    <div className="text-xs opacity-60 mt-1">{f.desc}</div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* Tips */}
                    <section className="rounded-xl bg-emerald-500/5 border border-emerald-500/20 p-3 space-y-1.5">
                        <div className="text-sm font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Ingat</div>
                        <ul className="text-xs opacity-70 space-y-1 list-disc pl-5">
                            <li>Di luar <b>jendela 24 jam</b>, hanya bisa kirim pesan <b>template</b> yang sudah disetujui Meta.</li>
                            <li>Kontak yang <b>opt-out</b> (balas STOP) otomatis dilewati di semua fitur.</li>
                            <li>Broadcast & reminder butuh template ber-status <b>APPROVED</b>.</li>
                        </ul>
                    </section>

                    <p className="text-[11px] opacity-40">Panduan lengkap: backend/src/whatsapp-cloud/README.md</p>
                </div>
            </div>
        </div>,
        document.body,
    );
}
