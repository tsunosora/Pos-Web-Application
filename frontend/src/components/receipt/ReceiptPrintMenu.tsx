"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Printer, FileText, ReceiptText, Check, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { ReceiptSnapshot } from "@/lib/receipt";
import { detectPrintTargets, type PrintTarget } from "@/lib/thermal/targets";

type Status = "TAGIHAN" | "LUNAS";
type Toast = { kind: "loading" | "ok" | "err"; text: string } | null;

/**
 * Tombol cetak nota dengan SATU menu berisi format + printer sekaligus:
 * "Faktur A5" (printer biasa) dan tiap printer thermal yang tersedia. Kasir
 * memilih desain + printer setiap kali cetak — tidak terkunci ke satu default.
 * Menu di-portal ke document.body agar tak terpotong overflow tabel.
 */
export default function ReceiptPrintMenu({
  snap,
  status,
  defaultFormat,
  bankAccounts,
  label,
  title = "Cetak nota",
  className,
  align = "right",
}: {
  /** Snapshot nota, atau fungsi yang menghasilkannya saat diklik (mis. draft POS). */
  snap: ReceiptSnapshot | (() => ReceiptSnapshot);
  status: Status;
  defaultFormat?: string;
  bankAccounts?: unknown[];
  /** Kalau diisi, tombol tampil dengan teks; kalau kosong, tombol ikon saja. */
  label?: string;
  title?: string;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    maxHeight: number;
  } | null>(null);
  const [targets, setTargets] = useState<PrintTarget[] | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const MENU_W = 268;

  // Deteksi tujuan cetak (printer) tiap kali menu dibuka — bisa berubah
  // (printer nyala/mati, relay online, dsb).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    setTargets(null);
    detectPrintTargets({ defaultFormat, bankAccounts })
      .then((t) => alive && setTargets(t))
      .catch(() => alive && setTargets([]));
    return () => {
      alive = false;
    };
  }, [open, defaultFormat, bankAccounts]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const M = 8; // jarak aman dari tepi layar
    const GAP = 6; // celah antara tombol dan menu
    const left = align === "right" ? r.right - MENU_W : r.left;

    // Ruang tersedia di bawah vs di atas tombol. Buka ke atas bila ruang bawah
    // sempit dan ruang atas lebih lega — supaya menu tak terpotong tepi bawah.
    const spaceBelow = window.innerHeight - r.bottom - GAP - M;
    const spaceAbove = r.top - GAP - M;
    const openUp = spaceBelow < 260 && spaceAbove > spaceBelow;
    const avail = openUp ? spaceAbove : spaceBelow;
    // Tinggi menu dibatasi ruang yang ada (min 160px agar tetap berguna),
    // dengan pagu 70vh; sisanya di-scroll internal.
    const maxHeight = Math.max(160, Math.min(avail, Math.round(window.innerHeight * 0.7)));

    setPos({
      top: openUp ? undefined : r.bottom + GAP,
      bottom: openUp ? window.innerHeight - r.top + GAP : undefined,
      left: Math.max(M, Math.min(left, window.innerWidth - MENU_W - M)),
      maxHeight,
    });
  }, [open, align, targets]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (
        !menuRef.current?.contains(e.target as Node) &&
        !btnRef.current?.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const showToast = (t: Toast, autoHide = false) => {
    setToast(t);
    if (autoHide) window.setTimeout(() => setToast(null), 3500);
  };

  const pick = async (t: PrintTarget) => {
    setOpen(false);
    const data = typeof snap === "function" ? (snap as () => ReceiptSnapshot)() : snap;
    // A5 lewat dialog browser (instan) → tak perlu toast "mencetak".
    const isInstant = t.format === "A5";
    if (!isInstant) showToast({ kind: "loading", text: `Mencetak ke ${t.label}…` });
    try {
      await t.run(data, status);
      if (!isInstant) showToast({ kind: "ok", text: `Tercetak · ${t.label}` }, true);
    } catch (e) {
      showToast(
        { kind: "err", text: e instanceof Error ? e.message : `Gagal mencetak ke ${t.label}` },
        true,
      );
    }
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={title}
        aria-haspopup="menu"
        aria-expanded={open}
        className={
          className ??
          (label
            ? "flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors outline-none"
            : "p-1.5 bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary rounded-lg transition-colors outline-none")
        }
      >
        <Printer className="w-4 h-4" />
        {label && <span>{label}</span>}
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            style={{
              position: "fixed",
              top: pos.top,
              bottom: pos.bottom,
              left: pos.left,
              width: MENU_W,
              maxHeight: pos.maxHeight,
            }}
            className="z-[600] rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-xl p-1.5 overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
          >
            <p className="px-2.5 pt-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Pilih format &amp; printer
            </p>

            {targets === null ? (
              <div className="flex items-center gap-2 px-2.5 py-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Mencari printer…
              </div>
            ) : (
              targets.map((t) => (
                <button
                  key={t.id}
                  role="menuitem"
                  onClick={() => pick(t)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-primary/10 transition-colors group"
                >
                  {t.format === "A5" ? (
                    <FileText className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  ) : (
                    <ReceiptText className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0" />
                  )}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold truncate">{t.label}</span>
                    {t.sub && <span className="block text-[11px] text-muted-foreground truncate">{t.sub}</span>}
                  </span>
                  {t.isDefault && (
                    <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-semibold text-primary bg-primary/10 rounded-full px-1.5 py-0.5">
                      <Check className="w-3 h-3" />
                      Default
                    </span>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body,
        )}

      {toast &&
        createPortal(
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[700] max-w-[92vw] animate-in fade-in slide-in-from-bottom-2">
            <div
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg border backdrop-blur-md ${
                toast.kind === "ok"
                  ? "bg-emerald-500/15 text-emerald-600 border-emerald-500/30"
                  : toast.kind === "err"
                    ? "bg-red-500/15 text-red-600 border-red-500/30"
                    : "bg-background/95 text-foreground border-border"
              }`}
            >
              {toast.kind === "loading" ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              ) : toast.kind === "ok" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span className="min-w-0">{toast.text}</span>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
