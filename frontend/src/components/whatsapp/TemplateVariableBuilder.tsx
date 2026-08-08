"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";

/** Jumlah variabel = indeks {{n}} tertinggi di body (Meta wajib berurutan 1..N). */
export function detectVarCount(body: string): number {
    const matches = body.match(/\{\{\s*(\d+)\s*\}\}/g) || [];
    let max = 0;
    for (const m of matches) {
        const n = parseInt(m.replace(/[^\d]/g, ""), 10);
        if (n > max) max = n;
    }
    return max;
}

/** Hapus token {{target}} dari body lalu nomori ulang {{k>target}} → {{k-1}}. */
function renumberRemove(body: string, removeIdx: number): string {
    const target = removeIdx + 1;
    let b = body.replace(new RegExp(`\\{\\{\\s*${target}\\s*\\}\\}`, "g"), "");
    b = b.replace(/\{\{\s*(\d+)\s*\}\}/g, (_, n) => {
        const num = parseInt(n, 10);
        return `{{${num > target ? num - 1 : num}}}`;
    });
    return b.replace(/[ \t]{2,}/g, " ");
}

/**
 * Pengelola variabel template WhatsApp — komponen mandiri.
 * Tambah/hapus variabel (sinkron ke body via onBody) + edit keterangan & contoh.
 * Hapus akan menomori ulang otomatis (Meta wajib {{1}}..{{N}} berurutan).
 */
export function TemplateVariableBuilder({ body, onBody, labels, samples, setLabels, setSamples }: {
    body: string;
    onBody: (b: string) => void;
    labels: string[];
    samples: string[];
    setLabels: Dispatch<SetStateAction<string[]>>;
    setSamples: Dispatch<SetStateAction<string[]>>;
}) {
    const count = detectVarCount(body);

    const addVar = () => onBody(`${body}${body && !/\s$/.test(body) ? " " : ""}{{${count + 1}}}`);
    const removeVar = (i: number) => {
        onBody(renumberRemove(body, i));
        setLabels((a) => a.filter((_, k) => k !== i));
        setSamples((a) => a.filter((_, k) => k !== i));
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-medium">Variabel {count > 0 && `(${count})`}</div>
                <button type="button" onClick={addVar}
                    className="text-xs px-2.5 py-1 rounded-lg bg-primary text-primary-foreground flex items-center gap-1"
                    title="Sisipkan variabel berikutnya ke isi pesan">
                    <Plus className="w-3.5 h-3.5" /> Tambah variabel {`{{${count + 1}}}`}
                </button>
            </div>

            {count === 0 ? (
                <p className="text-xs opacity-60">
                    Belum ada variabel. Klik <b>+ Tambah variabel</b> — otomatis menyisipkan <code>{"{{1}}"}</code> ke isi pesan,
                    lalu isi <b>keterangan</b> &amp; <b>contoh nilai</b>-nya di sini.
                </p>
            ) : (
                <div className="space-y-2">
                    {Array.from({ length: count }, (_, i) => (
                        <div key={i} className="grid grid-cols-[auto_1fr_1fr_auto] items-center gap-2">
                            <span className="text-xs font-mono px-2 py-2 rounded bg-muted shrink-0">{`{{${i + 1}}}`}</span>
                            <input
                                value={labels[i] ?? ""}
                                onChange={(e) => setLabels((a) => { const n = [...a]; n[i] = e.target.value; return n; })}
                                placeholder="Keterangan (mis. Nama pelanggan)"
                                className="rounded-lg bg-muted/60 px-3 py-2 text-sm outline-none"
                            />
                            <input
                                value={samples[i] ?? ""}
                                onChange={(e) => setSamples((a) => { const n = [...a]; n[i] = e.target.value; return n; })}
                                placeholder="Contoh nilai (mis. Budi)"
                                className="rounded-lg bg-muted/60 px-3 py-2 text-sm outline-none"
                            />
                            <button type="button" onClick={() => removeVar(i)}
                                className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500" title="Hapus variabel ini">
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    <p className="text-[11px] opacity-60">
                        Keterangan = arti variabel (untuk tim). Contoh nilai <b>wajib</b> agar lolos review Meta. Menghapus variabel menomori ulang otomatis.
                    </p>
                </div>
            )}
        </div>
    );
}
