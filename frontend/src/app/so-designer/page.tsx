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
            sessionStorage.setItem(SESSION_KEY, JSON.stringify({ id: result.id, name: result.name, pin: pin.trim() }));
            router.replace("/so-designer/dashboard");
        } catch {
            setError("Gagal menghubungi server. Coba lagi.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-8">
                <div className="flex flex-col items-center mb-6">
                    <div className="bg-indigo-600 rounded-xl p-3 mb-3">
                        <FileSignature className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-xl font-bold text-slate-900">Portal Desainer</h1>
                    <p className="text-sm text-slate-500 text-center mt-1">Buat & kelola Surat Order tanpa perlu login akun</p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm mb-4">
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
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nama Desainer</label>
                            <select
                                value={selectedId}
                                onChange={e => { setSelectedId(Number(e.target.value)); setError(null); }}
                                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                            >
                                <option value="">-- Pilih nama kamu --</option>
                                {designers.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">PIN</label>
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    type="password"
                                    value={pin}
                                    onChange={e => { setPin(e.target.value); setError(null); }}
                                    onKeyDown={e => e.key === "Enter" && handleLogin()}
                                    placeholder="Masukkan PIN"
                                    className="w-full pl-9 pr-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 tracking-widest"
                                    maxLength={10}
                                />
                            </div>
                        </div>

                        <button
                            onClick={handleLogin}
                            disabled={loading || !selectedId || !pin.trim()}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Masuk
                        </button>
                    </div>
                )}

                <p className="text-xs text-slate-400 text-center mt-6">
                    Belum terdaftar? Hubungi admin untuk mendaftarkan nama & PIN kamu.
                </p>
            </div>
        </div>
    );
}
