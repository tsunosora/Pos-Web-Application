"use client";

import { useCallback, useState } from "react";
import type { ReceiptSnapshot } from "@/lib/receipt";
import { handlePrintSnap } from "@/lib/receipt";
import ThermalReceiptModal from "@/components/receipt/ThermalReceiptModal";

type Status = "TAGIHAN" | "LUNAS";

/**
 * Hook cetak nota terpusat. `printReceipt` memilih A5 / Thermal 58mm
 * berdasarkan setelan Format Nota Default (settings.receiptDefaultFormat).
 * `printA5` / `printThermal` untuk override manual eksplisit.
 * Render `thermalModal` sekali di halaman agar modal thermal muncul.
 */
export function useReceiptPrinter(settings?: any, bankAccounts?: any[]) {
  const [thermal, setThermal] = useState<{ snap: ReceiptSnapshot; status: Status } | null>(null);

  const printThermal = useCallback((snap: ReceiptSnapshot, status: Status = "LUNAS") => {
    setThermal({ snap, status });
  }, []);

  const printA5 = useCallback(
    (snap: ReceiptSnapshot, status: Status = "LUNAS") => {
      handlePrintSnap(snap, status, bankAccounts);
    },
    [bankAccounts],
  );

  const printReceipt = useCallback(
    (snap: ReceiptSnapshot, status: Status = "LUNAS") => {
      if (settings?.receiptDefaultFormat === "THERMAL_58") printThermal(snap, status);
      else printA5(snap, status);
    },
    [settings?.receiptDefaultFormat, printThermal, printA5],
  );

  const thermalModal = (
    <ThermalReceiptModal
      open={thermal !== null}
      onClose={() => setThermal(null)}
      snap={thermal?.snap ?? ({} as ReceiptSnapshot)}
      status={thermal?.status ?? "LUNAS"}
    />
  );

  return { printReceipt, printA5, printThermal, thermalModal };
}
