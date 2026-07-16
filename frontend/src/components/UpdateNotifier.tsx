"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw, Loader2, X, CheckCircle2 } from "lucide-react";
import { getElectron, type UpdaterEvent } from "@/lib/thermal/desktop-bridge";

type State =
  | { kind: "idle" }
  | { kind: "available"; version: string }
  | { kind: "downloading"; percent: number }
  | { kind: "ready"; version: string }
  | { kind: "error"; message: string };

/**
 * Notifikasi pembaruan aplikasi desktop (auto-update). Muncul sebagai banner
 * kiri-bawah saat ada versi baru → Unduh → progres → "Restart & pasang".
 * Hanya aktif di aplikasi desktop terpaket (window.electron.onUpdaterEvent ada).
 */
export default function UpdateNotifier() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const el = getElectron();
    if (!el?.onUpdaterEvent) return;
    const off = el.onUpdaterEvent((e: UpdaterEvent) => {
      if (e.type === "available") {
        setState({ kind: "available", version: e.version });
        setDismissed(false);
      } else if (e.type === "progress") {
        setState({ kind: "downloading", percent: e.percent });
      } else if (e.type === "ready") {
        setState({ kind: "ready", version: e.version });
        setDismissed(false);
      } else if (e.type === "error") {
        setState({ kind: "error", message: e.message });
      } else {
        setState({ kind: "idle" });
      }
    });
    return off;
  }, []);

  if (state.kind === "idle" || state.kind === "error" || dismissed) return null;

  const el = getElectron();

  return (
    <div className="fixed bottom-4 left-4 z-[600] w-[320px] rounded-xl border border-border bg-card shadow-xl p-4 animate-in slide-in-from-bottom-2">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {state.kind === "ready" ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : state.kind === "downloading" ? (
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          ) : (
            <Download className="h-5 w-5 text-primary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          {state.kind === "available" && (
            <>
              <p className="font-semibold text-sm text-foreground">Pembaruan tersedia</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Versi {state.version} siap diunduh.
              </p>
              <button
                onClick={() => {
                  setState({ kind: "downloading", percent: 0 });
                  void el?.downloadUpdate?.();
                }}
                className="mt-3 w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Unduh pembaruan
              </button>
            </>
          )}

          {state.kind === "downloading" && (
            <>
              <p className="font-semibold text-sm text-foreground">Mengunduh pembaruan…</p>
              <div className="mt-2 h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${state.percent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{state.percent}%</p>
            </>
          )}

          {state.kind === "ready" && (
            <>
              <p className="font-semibold text-sm text-foreground">Pembaruan siap dipasang</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Versi {state.version} akan terpasang setelah restart. Pastikan sinkron sudah 0.
              </p>
              <button
                onClick={() => void el?.installUpdate?.()}
                className="mt-3 w-full py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Restart & pasang sekarang
              </button>
            </>
          )}
        </div>
        {state.kind !== "downloading" && (
          <button
            onClick={() => setDismissed(true)}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
