"use client";

import { useEffect, useState } from "react";
import { Monitor, Printer, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  isDesktop,
  listPrintersDesktop,
  getPrinterConfigDesktop,
  setPrinterConfigDesktop,
  testPrintDesktop,
  bytesToBase64,
  type ElectronPrinterConfig,
} from "@/lib/thermal/desktop-bridge";

type Conn = "windows" | "usb" | "bluetooth";
type Msg = { kind: "ok" | "err"; text: string } | null;

// ESC/POS uji: init + teks + feed + potong. Printer thermal menerima ASCII langsung.
function testBytes(): Uint8Array {
  const enc = new TextEncoder();
  return new Uint8Array([
    0x1b, 0x40, // ESC @  (init)
    ...enc.encode("POS PRO\nUji cetak printer aplikasi\nBERHASIL\n\n\n\n"),
    0x1d, 0x56, 0x00, // GS V 0 (full cut)
  ]);
}

/**
 * Panel pengaturan printer untuk mode aplikasi desktop (Electron).
 * Hanya render bila web app berjalan di dalam Electron. Menggantikan alur agen
 * relay/.bat: user cukup pilih printer OS sekali, aplikasi cetak langsung.
 */
export default function DesktopPrinterPanel() {
  const [ready, setReady] = useState(false);
  const [printers, setPrinters] = useState<{ name: string }[]>([]);
  const [connection, setConnection] = useState<Conn>("windows");
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState<"load" | "save" | "test" | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  useEffect(() => {
    if (!isDesktop()) return;
    setReady(true);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reload() {
    setBusy("load");
    try {
      const [list, cfg] = await Promise.all([listPrintersDesktop(), getPrinterConfigDesktop()]);
      setPrinters(list);
      if (cfg) {
        setConnection(cfg.connection);
        setTarget(cfg.target ?? "");
      }
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal memuat daftar printer." });
    } finally {
      setBusy(null);
    }
  }

  const cfg = (): ElectronPrinterConfig => ({ connection, target: target.trim() || null });

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      await setPrinterConfigDesktop(cfg());
      setMsg({ kind: "ok", text: "Printer aplikasi tersimpan." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal menyimpan." });
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setMsg(null);
    try {
      await testPrintDesktop(bytesToBase64(testBytes()), cfg());
      setMsg({ kind: "ok", text: "Uji cetak terkirim ke printer." });
    } catch (e) {
      setMsg({ kind: "err", text: e instanceof Error ? e.message : "Gagal uji cetak." });
    } finally {
      setBusy(null);
    }
  }

  if (!ready) return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Monitor className="h-5 w-5 text-primary" />
        <div>
          <h2 className="font-semibold text-sm">Printer Aplikasi (Desktop)</h2>
          <p className="text-xs text-muted-foreground">
            Aplikasi ini mencetak <b>langsung</b> ke printer komputer — tanpa agen/.bat.
            Pilih printer sekali, selesai.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Jenis koneksi</Label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setConnection("windows")}
              className={
                "px-3 py-2 rounded-lg text-sm border transition-colors " +
                (connection === "windows"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted")
              }
            >
              Printer Windows
            </button>
            <button
              type="button"
              onClick={() => setConnection("usb")}
              className={
                "px-3 py-2 rounded-lg text-sm border transition-colors " +
                (connection === "usb"
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background border-border hover:bg-muted")
              }
            >
              USB (COM)
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label>{connection === "windows" ? "Nama printer" : "Port COM"}</Label>
            {connection === "windows" && (
              <button
                type="button"
                onClick={reload}
                disabled={busy === "load"}
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                {busy === "load" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                muat ulang
              </button>
            )}
          </div>
          {connection === "windows" ? (
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">— pilih printer —</option>
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="COM5"
            />
          )}
        </div>
      </div>

      {msg && (
        <div
          className={
            "rounded-lg px-3 py-2 text-sm " +
            (msg.kind === "ok"
              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
              : "bg-red-500/10 text-red-600 border border-red-500/20")
          }
        >
          {msg.text}
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={save} disabled={busy !== null || !target.trim()}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          Simpan
        </Button>
        <Button variant="outline" onClick={test} disabled={busy !== null || !target.trim()}>
          {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
          Uji cetak
        </Button>
      </div>
    </div>
  );
}
