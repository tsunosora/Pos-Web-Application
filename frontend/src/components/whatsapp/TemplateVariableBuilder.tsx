"use client";

import type { Dispatch, SetStateAction } from "react";
import { Plus, Trash2 } from "lucide-react";

/**
 * Daftar NILAI yang bisa dipilih untuk sebuah variabel (library standar).
 * label = arti variabel; sample = contoh nilai (untuk review Meta).
 * Nilai sebenarnya diisi saat KIRIM: broadcast (peta ke Nama kontak / kolom CSV /
 * teks), reminder (otomatis dari data nota). Daftar ini menyeragamkan artinya.
 */
export const VALUE_SOURCES: Array<{ label: string; sample: string }> = [
    { label: "Nama pelanggan", sample: "Budi" },
    { label: "Nomor nota", sample: "INV-2026-00123" },
    { label: "Alamat pelanggan", sample: "Jl. Merdeka No. 10" },
    { label: "Nomor HP", sample: "0812-3456-7890" },
    { label: "Total tagihan", sample: "Rp150.000" },
    { label: "Sisa tagihan", sample: "Rp50.000" },
    { label: "Nama produk", sample: "Banner 3x1m" },
    { label: "Jumlah (qty)", sample: "2" },
    { label: "Tanggal", sample: "8 Agustus 2026" },
    { label: "Diskon", sample: "20%" },
    { label: "Nama toko", sample: "Voliko Printing" },
    { label: "Link / URL", sample: "https://voliko.com/promo" },
];

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
                        <div key={i} className="rounded-lg bg-muted/30 p-2 space-y-1.5">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono px-2 py-1.5 rounded bg-muted shrink-0">{`{{${i + 1}}}`}</span>
                                <select
                                    value=""
                                    onChange={(e) => {
                                        const src = VALUE_SOURCES.find((s) => s.label === e.target.value);
                                        if (!src) return;
                                        setLabels((a) => { const n = [...a]; n[i] = src.label; return n; });
                                        setSamples((a) => { const n = [...a]; n[i] = src.sample; return n; });
                                    }}
                                    className="text-xs rounded-lg bg-muted/60 px-2 py-1.5 outline-none max-w-[13rem]"
                                    title="Pilih nilai variabel dari daftar"
                                >
                                    <option value="">📋 Pilih nilai dari daftar…</option>
                                    {VALUE_SOURCES.map((s) => <option key={s.label} value={s.label}>{s.label}</option>)}
                                </select>
                                <div className="flex-1" />
                                <button type="button" onClick={() => removeVar(i)}
                                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500 shrink-0" title="Hapus variabel ini">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    value={labels[i] ?? ""}
                                    onChange={(e) => setLabels((a) => { const n = [...a]; n[i] = e.target.value; return n; })}
                                    placeholder="Nilai / arti (mis. Nama pelanggan)"
                                    className="rounded-lg bg-muted/60 px-3 py-2 text-sm outline-none"
                                />
                                <input
                                    value={samples[i] ?? ""}
                                    onChange={(e) => setSamples((a) => { const n = [...a]; n[i] = e.target.value; return n; })}
                                    placeholder="Contoh nilai (mis. Budi)"
                                    className="rounded-lg bg-muted/60 px-3 py-2 text-sm outline-none"
                                />
                            </div>
                        </div>
                    ))}
                    <p className="text-[11px] opacity-60">
                        Pilih nilai tiap variabel dari <b>daftar</b> (atau ketik sendiri di kotak kiri). Nilai asli diisi saat <b>kirim</b>: di broadcast dipetakan ke Nama kontak / kolom CSV / teks; di reminder otomatis dari data nota. <b>Contoh nilai wajib</b> agar lolos review Meta.
                    </p>
                </div>
            )}
        </div>
    );
}
