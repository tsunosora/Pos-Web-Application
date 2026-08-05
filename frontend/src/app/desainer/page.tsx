"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Loader2, Eye, EyeOff, LogIn } from "lucide-react";

// Halaman Studio Desain — MANDIRI dengan login sendiri.
// Autentikasi memakai akun yang terdaftar di aplikasi kasir (POS) via
// /auth/login. Semua akun POS yang AKTIF boleh masuk (user non-aktif ditolak
// backend). Bila user sudah login di POS (token ada & valid), langsung masuk
// tanpa login ulang. Sengaja TIDAK memakai api client bersama supaya interceptor
// 401 global tidak melempar ke /login POS.

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type Status = "checking" | "needLogin" | "authed";

function setTokenEverywhere(t: string) {
    localStorage.setItem("token", t);
    const exp = new Date();
    exp.setTime(exp.getTime() + 24 * 60 * 60 * 1000);
    document.cookie = `token=${t};expires=${exp.toUTCString()};path=/`;
}
function clearTokenEverywhere() {
    localStorage.removeItem("token");
    document.cookie = "token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

export default function DesainerPage() {
    const [status, setStatus] = useState<Status>("checking");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPw, setShowPw] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Validasi sesi yang ada (plain fetch — hindari interceptor 401 global).
    const validate = useCallback(async () => {
        const t = typeof window !== "undefined" ? localStorage.getItem("token") : null;
        if (!t) { setStatus("needLogin"); return; }
        try {
            const res = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${t}` } });
            if (!res.ok) { clearTokenEverywhere(); setStatus("needLogin"); return; }
            // Sinkronkan cookie (iframe /studio-desain butuh cookie token utk lolos middleware).
            setTokenEverywhere(t);
            setStatus("authed");
        } catch {
            setStatus("needLogin");
        }
    }, []);

    useEffect(() => { validate(); }, [validate]);

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        setError(null);
        try {
            const res = await fetch(`${API}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim(), password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.access_token) {
                throw new Error(data.message || "Email atau password salah.");
            }
            setTokenEverywhere(data.access_token);
            setStatus("authed");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login gagal.");
        } finally {
            setSubmitting(false);
        }
    };

    // ── Studio siap ────────────────────────────────────────────────
    if (status === "authed") {
        return (
            <div className="h-screen w-screen overflow-hidden bg-black">
                <iframe
                    src="/studio-desain/index.html"
                    title="Studio Desain"
                    className="h-full w-full border-0"
                    allow="clipboard-write; clipboard-read"
                />
            </div>
        );
    }

    // ── Cek sesi ───────────────────────────────────────────────────
    if (status === "checking") {
        return (
            <div className="flex h-screen items-center justify-center" style={{ background: "#0B1120" }}>
                <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
        );
    }

    // ── Layar login Studio ─────────────────────────────────────────
    return (
        <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10" style={{ background: "radial-gradient(1200px circle at 50% -10%, #131C2E, #0B1120 60%)" }}>
            <div className="w-full max-w-sm rounded-2xl border border-blue-500/20 bg-white/[0.03] p-7 shadow-2xl backdrop-blur-xl">
                <div className="mb-6 flex flex-col items-center text-center">
                    <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 p-2 ring-1 ring-blue-500/30 shadow-[0_0_20px_rgba(37,99,235,0.35)]">
                        {/* Logo faicando di-INLINE (bukan <img src=/studio-desain/...>) karena
                            path /studio-desain diproteksi middleware → 404/redirect saat belum login. */}
                        <svg viewBox="1163 0 6817 9145" fill="#fff" aria-label="faicando" className="h-full w-full">
                            <path d="M1475.21 27.35l2994.74 1672.99c65.26,36.46 138.83,36.46 204.09,0l2994.73 -1672.99c66.62,-37.22 142.13,-36.42 207.95,2.21 65.81,38.62 103.33,104.15 103.33,180.46l0 1423.35c0,78.49 -39.91,145.83 -108.75,183.52l-6397.65 3502.89c-66.66,36.49 -141.76,35.22 -207.15,-3.53 -65.38,-38.73 -102.57,-104 -102.57,-180l0 -4926.24c0,-76.31 37.53,-141.83 103.35,-180.46 65.81,-38.62 141.31,-39.42 207.93,-2.2z" />
                            <path d="M3473.38 5057.58l-2199.94 1192.68c-69.27,37.55 -109.51,105.14 -109.51,183.94l0 2499.77c0,76.08 37.28,141.41 102.77,180.12 65.5,38.71 140.71,39.86 207.36,3.18l2199.94 -1210.97c68.62,-37.78 108.34,-104.98 108.34,-183.3l0 -2481.49c0,-75.84 -37.03,-140.98 -102.2,-179.78 -65.17,-38.8 -140.08,-40.3 -206.76,-4.15z" />
                            <path d="M4881.72 6458.62l1849.93 -1012.89c68.85,-37.7 108.75,-105.04 108.75,-183.53l0 -1791.31c0,-76 -37.2,-141.27 -102.58,-180 -65.38,-38.75 -140.49,-40.02 -207.15,-3.53l-1849.93 1012.9c-68.84,37.69 -108.74,105.03 -108.74,183.52l0 1791.31c0,76 37.19,141.27 102.57,180.01 65.39,38.74 140.5,40.02 207.15,3.52z" />
                        </svg>
                    </div>
                    <h1 className="text-lg font-bold text-white">Studio Desain</h1>
                    <p className="mt-1 text-xs text-slate-400">Masuk dengan akun kasir (POS) Anda</p>
                </div>

                <form onSubmit={onSubmit} className="grid gap-3">
                    <input
                        name="email"
                        type="text"
                        autoComplete="username"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email / Username"
                        disabled={submitting}
                        className="w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30"
                    />
                    <div className="relative">
                        <input
                            name="password"
                            type={showPw ? "text" : "password"}
                            autoComplete="current-password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Password"
                            disabled={submitting}
                            className="w-full rounded-lg border border-white/15 bg-white/5 px-3.5 py-2.5 pr-10 text-sm text-white placeholder:text-slate-500 outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPw((v) => !v)}
                            tabIndex={-1}
                            aria-label={showPw ? "Sembunyikan password" : "Tampilkan password"}
                            className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-white"
                        >
                            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>

                    {error && <div className="text-center text-sm font-medium text-red-400">{error}</div>}

                    <button
                        type="submit"
                        disabled={submitting}
                        className="mt-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-60"
                    >
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
                        Masuk
                    </button>
                </form>

                <p className="mt-4 text-center text-[11px] text-slate-500">
                    Gunakan akun yang sudah terdaftar di aplikasi kasir.
                </p>
            </div>

            <a
                href="https://app.faicando.com"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 text-[11px] text-slate-500 hover:text-blue-400 transition-colors"
            >
                Dibuat oleh <span className="font-semibold text-blue-400">faicando</span> · app.faicando.com
            </a>
        </div>
    );
}
