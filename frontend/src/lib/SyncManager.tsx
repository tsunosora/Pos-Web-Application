"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getOfflineTransactions, clearOfflineTransaction } from "./sync";
import { enqueueOp, countOutbox } from "./offline/repo";
import { startAutoSync, syncNow } from "./offline/sync-engine";
import { getActiveBranchId } from "@/store/branch-store";
import { WifiOff, RefreshCw } from "lucide-react";

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
    const poll = window.setInterval(() => {
      countOutbox().then(setPending).catch(() => {});
    }, 5000);
    countOutbox().then(setPending).catch(() => {});

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(poll);
      stop?.();
    };
  }, [disabled]);

  if (disabled) return null;

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
