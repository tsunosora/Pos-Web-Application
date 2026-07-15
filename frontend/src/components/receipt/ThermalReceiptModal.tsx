"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Printer, Bluetooth, Loader2, Globe, Usb, Store } from "lucide-react";
import type { ReceiptSnapshot } from "@/lib/receipt";
import {
  buildThermalReceiptHTML,
  connectPrinter,
  getLastPrinterName,
  isBridgeAvailable,
  isPrinterConnected,
  isRelayAvailable,
  isWebBluetoothAvailable,
  printThermalBluetoothAuto,
  printThermalViaBridge,
  printThermalViaBrowser,
  printThermalViaRelay,
} from "@/lib/thermal";

type Status = "TAGIHAN" | "LUNAS";
type Msg = { kind: "ok" | "err"; text: string } | null;

export default function ThermalReceiptModal({
  open,
  onClose,
  snap,
  status,
}: {
  open: boolean;
  onClose: () => void;
  snap: ReceiptSnapshot;
  status: Status;
}) {
  const btSupported = isWebBluetoothAvailable();
  const [connected, setConnected] = useState(isPrinterConnected());
  const [printerName, setPrinterName] = useState<string | null>(getLastPrinterName());
  const [busy, setBusy] = useState<"connect" | "bt" | "bridge" | "relay" | null>(null);
  const [bridgeReady, setBridgeReady] = useState(false);
  const [relayReady, setRelayReady] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  const previewHtml = useMemo(
    () => (open ? buildThermalReceiptHTML(snap, status) : ""),
    [open, snap, status],
  );

  // Deteksi jalur cetak yang tersedia tiap kali modal dibuka:
  // - relay (printer server cabang via backend) → paling andal utk https+multi-device,
  // - bridge lokal (localhost) → desktop yg jalankan bridge sendiri.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    isRelayAvailable().then((ok) => {
      if (alive) setRelayReady(ok);
    });
    isBridgeAvailable().then((ok) => {
      if (alive) setBridgeReady(ok);
    });
    return () => {
      alive = false;
    };
  }, [open]);

  // 1-tap: kirim struk ke printer server cabang (backend → agen → printer).
  const handlePrintRelay = async () => {
    setBusy("relay");
    setMsg(null);
    try {
      await printThermalViaRelay(snap, status);
      setMsg({ kind: "ok", text: "Struk terkirim ke printer toko." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal mencetak via printer toko." });
    } finally {
      setBusy(null);
    }
  };

  // 1-tap: kirim struk ke printer via bridge lokal (HTTP -> Bluetooth SPP).
  const handlePrintBridge = async () => {
    setBusy("bridge");
    setMsg(null);
    try {
      await printThermalViaBridge(snap, status);
      setMsg({ kind: "ok", text: "Struk terkirim ke printer (bridge)." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal mencetak via bridge." });
    } finally {
      setBusy(null);
    }
  };

  if (!open) return null;

  // Pilih/ganti printer secara eksplisit (dialog pemilihan Bluetooth).
  const handleConnect = async () => {
    setBusy("connect");
    setMsg(null);
    try {
      const name = await connectPrinter();
      setConnected(true);
      setPrinterName(name);
      setMsg({ kind: "ok", text: `Terhubung ke ${name}` });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal menghubungkan printer." });
    } finally {
      setBusy(null);
    }
  };

  // 1-tap: auto-sambung ke printer tersimpan (tanpa dialog) lalu cetak.
  const handlePrintBt = async () => {
    setBusy("bt");
    setMsg(null);
    try {
      const name = await printThermalBluetoothAuto(snap, status);
      // Koneksi dilepas setelah cetak → sinkronkan status (bukan "paired terus").
      setConnected(isPrinterConnected());
      setPrinterName(name);
      setMsg({ kind: "ok", text: `Struk terkirim ke ${name}.` });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal mencetak." });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/88 backdrop-blur-3xl z-[600] flex items-center justify-center p-4">
      <div className="glass-strong w-full max-w-md rounded-xl border border-border shadow-lg flex flex-col max-h-[95vh]">
        <div className="px-5 py-4 border-b border-border flex justify-between items-center shrink-0">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Printer className="h-4 w-4 text-muted-foreground" /> Struk Thermal 58mm
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-2">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Preview (iframe isolasi penuh) */}
        <div className="overflow-y-auto grow p-4 flex justify-center bg-muted/30">
          <iframe
            title="Preview struk thermal"
            srcDoc={previewHtml}
            className="bg-white rounded-md shadow-sm"
            style={{ width: 376, height: "58vh", border: 0 }}
          />
        </div>

        {/* Pesan status */}
        {msg && (
          <div
            className={`mx-4 mt-3 rounded-lg px-3 py-2 text-sm ${
              msg.kind === "ok"
                ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                : "bg-red-500/10 text-red-600 border border-red-500/20"
            }`}
          >
            {msg.text}
          </div>
        )}

        {/* Aksi */}
        <div className="p-4 border-t border-border space-y-3 shrink-0">
          {/* Jalur paling andal (https + banyak device): printer server cabang via backend. */}
          {relayReady && (
            <button
              onClick={handlePrintRelay}
              disabled={busy !== null}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base transition-all disabled:opacity-40"
            >
              {busy === "relay" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Store className="w-5 h-5" />
              )}
              Cetak (Printer Toko)
            </button>
          )}

          {/* Jalur bridge lokal (desktop yg jalankan bridge sendiri di localhost). */}
          {bridgeReady && (
            <button
              onClick={handlePrintBridge}
              disabled={busy !== null}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base transition-all disabled:opacity-40"
            >
              {busy === "bridge" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Usb className="w-5 h-5" />
              )}
              Cetak (Printer Server)
            </button>
          )}

          {/* Web Bluetooth disembunyikan bila ada printer server (relay/bridge) —
              lebih andal & menghindari status "paired" yang membingungkan. */}
          {!relayReady && !bridgeReady && (btSupported ? (
            <>
              {/* Tombol utama 1-tap: auto-sambung printer tersimpan lalu cetak */}
              <button
                onClick={handlePrintBt}
                disabled={busy !== null}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-bold text-base transition-all disabled:opacity-40"
              >
                {busy === "bt" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Bluetooth className="w-5 h-5" />
                )}
                Cetak Bluetooth
              </button>
              <button
                onClick={handleConnect}
                disabled={busy !== null}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {busy === "connect" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Bluetooth className="w-3.5 h-3.5" />
                )}
                {connected && printerName ? `Printer: ${printerName} · ganti` : "Pilih printer manual"}
              </button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center">
              Perangkat ini tidak mendukung Bluetooth web (iPhone/Safari). Gunakan Cetak Browser di bawah.
            </p>
          ))}

          <button
            onClick={() => printThermalViaBrowser(snap, status)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-border bg-background hover:bg-muted hover:border-primary/30 font-semibold text-sm transition-all"
          >
            <Globe className="w-4 h-4 text-muted-foreground" />
            Cetak Browser / PDF
          </button>
        </div>
      </div>
    </div>
  );
}
