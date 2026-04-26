"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileSignature, Loader2, KeyRound } from "lucide-react";
import { getPublicDesigners, verifyDesignerPin, type DesignerPublic } from "@/lib/api/designers";

const SESSION_KEY = "designer_session";

export default function DesignerGatePage() {
    const router = useRouter();
    const [designers, setDesigners] = useState<DesignerPublic[]>([]);
    const [selectedId, setSelectedId] = useState<number | "">("");
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        // Jika sudah ada sesi, langsung ke dashboard desainer
        const existing = sessionStorage.getItem(SESSION_KEY);
        if (existing) {
            router.replace("/so-designer/dashboard");
            return;
        }
        getPublicDesigners()
            .then(list => setDesigners(list))
            .catch(() => setError("Gagal memuat daftar desainer. Cek koneksi server."))
            .finally(() => setFetching(false));
    }, [router]);

    async function handleLogin() {
        if (!selectedId || !pin.trim()) {
            setError("Pilih nama desainer dan masukkan PIN");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const result = await verifyDesignerPin(Number(selectedId), pin.trim());
            if (!result.valid) {
                setError("PIN salah. Coba lagi.");
                return;
            }
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: result.id, name: result.name, pin: pin.trim(), branchName: result.branchName ?? null }));
            router.replace("/so-designer/dashboard");
        } catch {
            setError("Gagal menghubungi server. Coba lagi.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Decorative blobs */}
            <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl" />

            <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-white/95 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl p-8">
                <div className="flex flex-col items-center mb-6">
                    <div className="rounded-xl p-3 mb-3 bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30">
                        <FileSignature className="h-7 w-7 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Portal Desainer</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 text-center mt-1">Buat & kelola Surat Order tanpa perlu login akun</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm mb-4 animate-in fade-in">
                        {error}
                    </div>
                )}

                {fetching ? (
                    <div className="flex justify-center py-6 text-slate-400">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Nama Desainer</label>
                            <select
                                value={selectedId}
                                onChange={e => { setSelectedId(Number(e.target.value)); setError(null); }}
                                className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2.5 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors"
                            >
                                <option value="">-- Pilih nama kamu --</option>
                                {designers.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">PIN</label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="password"
                                    value={pin}
                                    onChange={e => { setPin(e.target.value); setError(null); }}
                                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                                    placeholder="Masukkan PIN"
                                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 tracking-widest transition-colors"
                                    maxLength={10}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleLogin}
                            disabled={loading || !selectedId || !pin.trim()}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Masuk
                        </button>
                    </div>
                )}

                <p className="text-xs text-slate-400 dark:text-slate-500 text-center mt-6">
                    Belum terdaftar? Hubungi admin untuk daftarkan nama & PIN kamu.
                </p>
            </div>
        </div>
    );
}
