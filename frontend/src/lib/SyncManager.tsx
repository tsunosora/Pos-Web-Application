"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getOfflineTransactions, clearOfflineTransaction } from "./sync";
import { enqueueOp, countOutbox, getOutbox, deleteOutboxOp } from "./offline/repo";
import type { OutboxOp } from "./offline/db";
import { startAutoSync, syncNow } from "./offline/sync-engine";
import { getActiveBranchId } from "@/store/branch-store";
import { WifiOff, RefreshCw, AlertTriangle, X } from "lucide-react";

// Migrasi sekali-jalan: entri store lama `offline-transactions` → outbox baru sebagai
// op `transaction.create`, lalu bersihkan. Menyatukan dua jalur offline jadi satu.
async function migrateLegacyOffline(): Promise<number> {
  const legacy = await getOfflineTransactions();
  let moved = 0;
  for (const tx of legacy) {
    await enqueueOp("transaction.create", tx.payload, getActiveBranchId());
    if (tx.id != null) await clearOfflineTransaction(tx.id);
    moved++;
  }
  return moved;
}

export function SyncManager() {
  const [isOnline, setIsOnline] = useState(true);
  const [pending, setPending] = useState(0);
  // Op yang DITOLAK server (mis. stok/validasi) dulu hanya tampil sebagai "Menyinkronkan N…"
  // selamanya — kasir tak tahu ada nota offline yang tak pernah masuk.
  const [gagal, setGagal] = useState<OutboxOp[]>([]);
  const [bukaGagal, setBukaGagal] = useState(false);
  const pathname = usePathname();
  // Studio Desain (/desainer) = halaman mandiri (login sendiri, bukan sesi POS).
  // Jangan jalankan sync offline POS di sini → cegah 401 background (yg melempar
  // ke /login) + hilangkan beban loading.
  const disabled = !!pathname && pathname.startsWith("/desainer");

  useEffect(() => {
    if (disabled) return;
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    let stop: (() => void) | null = null;
    (async () => {
      await migrateLegacyOffline();
      await syncNow();
      stop = startAutoSync();
    })().catch(() => {});

    // Pantau jumlah mutasi belum tersinkron (indikator kecil).
    const cekAntrean = () => {
      countOutbox().then(setPending).catch(() => {});
      getOutbox("error").then(setGagal).catch(() => {});
    };
    const poll = window.setInterval(cekAntrean, 5000);
    cekAntrean();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(poll);
      stop?.();
    };
  }, [disabled]);

  if (disabled) return null;

  const coba = async () => {
    await syncNow().catch(() => {});
    countOutbox().then(setPending).catch(() => {});
    getOutbox("error").then(setGagal).catch(() => {});
  };
  const buang = async (op: OutboxOp) => {
    const jenis = op.type === "transaction.create" ? "nota" : "catatan kas";
    if (!confirm(`Buang ${jenis} offline ini? Data ini TIDAK akan masuk ke server dan tidak bisa dikembalikan.\n\nAlasan ditolak: ${op.error ?? "-"}`)) return;
    await deleteOutboxOp(op.clientId);
    getOutbox("error").then(setGagal).catch(() => {});
    countOutbox().then(setPending).catch(() => {});
  };

  if (gagal.length > 0 && isOnline) {
    return (
      <div className="fixed bottom-4 right-4 z-50 text-sm">
        {bukaGagal ? (
          <div className="w-[min(92vw,380px)] max-h-[60vh] overflow-auto bg-card text-card-foreground border border-destructive/40 rounded-xl shadow-xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-destructive flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> {gagal.length} data offline ditolak server</span>
              <button onClick={() => setBukaGagal(false)} className="p-1 rounded hover:bg-muted" aria-label="Tutup"><X className="w-4 h-4" /></button>
            </div>
            {gagal.map((op) => {
              const p = op.payload ?? {};
              return (
                <div key={op.clientId} className="border border-border rounded-lg p-2 space-y-1">
                  <div className="text-xs text-muted-foreground">
                    {op.type === "transaction.create" ? "Nota" : "Kas"} · {new Date(op.createdAt).toLocaleString("id-ID")}
                    {p.customerName ? ` · ${p.customerName}` : ""}{p.amount ? ` · Rp ${Number(p.amount).toLocaleString("id-ID")}` : ""}
                    {Array.isArray(p.items) ? ` · ${p.items.length} item` : ""}
                  </div>
                  <div className="text-xs text-destructive break-words">{op.error || "Ditolak server"}</div>
                  <button onClick={() => buang(op)} className="text-xs px-2 py-1 rounded border border-destructive/40 text-destructive hover:bg-destructive/10">Buang</button>
                </div>
              );
            })}
            <button onClick={coba} className="w-full text-xs px-2 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium">Coba kirim ulang</button>
          </div>
        ) : (
          <button onClick={() => setBukaGagal(true)} className="bg-destructive text-destructive-foreground px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-xs font-medium">
            <AlertTriangle className="w-3.5 h-3.5" /> {gagal.length} data offline gagal terkirim — lihat
          </button>
        )}
      </div>
    );
  }

  if (!isOnline) {
    return (
      <div className="fixed bottom-4 right-4 bg-destructive text-destructive-foreground px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 z-50 text-sm font-medium animate-pulse">
        <WifiOff className="w-4 h-4" />
        Mode Offline{pending > 0 ? ` · ${pending} menunggu` : ""}
      </div>
    );
  }

  // Online tapi masih ada antrean → indikator sinkronisasi.
  if (pending > 0) {
    return (
      <div className="fixed bottom-4 right-4 bg-amber-500/90 text-white px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-2 z-50 text-xs font-medium">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        Menyinkronkan {pending}…
      </div>
    );
  }

  return null;
}
