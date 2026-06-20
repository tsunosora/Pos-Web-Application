"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getWorkOrderByJob, createWorkOrder, updateWorkOrder, uploadWorkOrderImage,
    FABRIC_OPTIONS, COLLAR_OPTIONS, getWorkOrderOptions, getProducts, getSettings,
    type JerseyWorkOrder, type WoItem, type WoPrintPattern, type WoQcRow,
    resolvePhotoUrl,
} from "@/lib/api";
import { X, Plus, Trash2, Printer, Loader2, Save, FileText, Upload, ImageIcon } from "lucide-react";
import dayjs from "dayjs";

interface Props {
    jobId: number;
    jobNumber: string;
    onClose: () => void;
}

const fmtDate = (d?: string | null) => (d ? dayjs(d).format("DD/MM/YY") : "");
const toInput = (d?: string | null) => (d ? dayjs(d).format("YYYY-MM-DD") : "");

export function WorkOrderModal({ jobId, jobNumber, onClose }: Props) {
    const queryClient = useQueryClient();
    const { data: existing, isLoading, refetch } = useQuery({
        queryKey: ["work-order-job", jobId],
        queryFn: () => getWorkOrderByJob(jobId),
    });

    const [wo, setWo] = useState<JerseyWorkOrder | null>(null);
    const [saving, setSaving] = useState(false);
    const [mode, setMode] = useState<"form" | "print">("form");
    const printRef = useRef<HTMLDivElement>(null);

    // Logo & nama toko untuk header cetak WO
    const { data: settings } = useQuery({
        queryKey: ["store-settings"],
        queryFn: getSettings,
        staleTime: 5 * 60_000,
    });

    // Form state
    const [form, setForm] = useState({
        woNumber: "", source: "", designerName: "", customerName: "",
        collarType: "", fabricType: "", orderDate: "", deadline: "",
        notes: "",
        printInspector: "", jahitInspector: "",
        tglPrint: "", tglPress: "", tglJahit: "",
    });
    const [mockupImages, setMockupImages] = useState<string[]>([]);
    const [printLayoutImages, setPrintLayoutImages] = useState<string[]>([]);
    const [shortSleeve, setShortSleeve] = useState<WoItem[]>([]);
    const [longSleeve, setLongSleeve] = useState<WoItem[]>([]);
    const [pants, setPants] = useState<WoItem[]>([]);
    const [patterns, setPatterns] = useState<WoPrintPattern[]>([]);
    const [qc, setQc] = useState<WoQcRow[]>([]);

    // Hydrate from existing
    useEffect(() => {
        if (existing) {
            setWo(existing);
            setForm({
                woNumber: existing.woNumber || "",
                source: existing.source || "",
                designerName: existing.designerName || "",
                customerName: existing.customerName || "",
                collarType: existing.collarType || "",
                fabricType: existing.fabricType || "",
                orderDate: toInput(existing.orderDate),
                deadline: toInput(existing.deadline),
                notes: existing.notes || "",
                printInspector: existing.printInspector || "",
                jahitInspector: existing.jahitInspector || "",
                tglPrint: toInput(existing.tglPrint),
                tglPress: toInput(existing.tglPress),
                tglJahit: toInput(existing.tglJahit),
            });
            // Multi-image: pakai array kalau ada, fallback ke single legacy
            setMockupImages(existing.mockupImages?.length ? existing.mockupImages : (existing.mockupImageUrl ? [existing.mockupImageUrl] : []));
            setPrintLayoutImages(existing.printLayoutImages?.length ? existing.printLayoutImages : (existing.printLayoutImageUrl ? [existing.printLayoutImageUrl] : []));
            setShortSleeve(existing.shortSleeveItems || []);
            setLongSleeve(existing.longSleeveItems || []);
            setPants(existing.pantsItems || []);
            setPatterns(existing.printPatterns || []);
            setQc(existing.qcChecklist || []);
        }
    }, [existing]);

    const handleCreate = async () => {
        setSaving(true);
        try {
            const created = await createWorkOrder({ productionJobId: jobId });
            setWo(created);
            await refetch();
        } catch (e: any) {
            alert(`Gagal buat WO: ${e?.response?.data?.message || e?.message || e}`);
        } finally { setSaving(false); }
    };

    const handleSave = async () => {
        if (!wo) return;
        setSaving(true);
        try {
            const updated = await updateWorkOrder(wo.id, {
                productionJobId: jobId,
                woNumber: form.woNumber || undefined,
                source: form.source || undefined,
                designerName: form.designerName || undefined,
                customerName: form.customerName || undefined,
                collarType: form.collarType || undefined,
                fabricType: form.fabricType || undefined,
                orderDate: form.orderDate || undefined,
                deadline: form.deadline || undefined,
                mockupImages,
                printLayoutImages,
                notes: form.notes || undefined,
                printInspector: form.printInspector || undefined,
                jahitInspector: form.jahitInspector || undefined,
                tglPrint: form.tglPrint || null,
                tglPress: form.tglPress || null,
                tglJahit: form.tglJahit || null,
                shortSleeveItems: shortSleeve,
                longSleeveItems: longSleeve,
                pantsItems: pants,
                printPatterns: patterns,
                qcChecklist: qc,
            });
            setWo(updated);
            await refetch();
            // Refresh opsi kerah/bahan agar nilai custom yang baru langsung jadi saran
            queryClient.invalidateQueries({ queryKey: ["wo-options"] });
            alert("✓ Work Order tersimpan");
        } catch (e: any) {
            alert(`Gagal simpan: ${e?.response?.data?.message || e?.message || e}`);
        } finally { setSaving(false); }
    };

    const handlePrint = () => {
        // Pastikan preview WO ter-render dulu, lalu cetak di JENDELA TERPISAH.
        // Pendekatan window.open menjamin HANYA dokumen WO yang tercetak — halaman
        // web di belakang modal tidak mungkin ikut (dokumen berbeda). Style aplikasi
        // (Tailwind) disalin ke jendela baru supaya layout WO tetap utuh.
        setMode("print");
        setTimeout(() => {
            const node = printRef.current;
            if (!node) return;
            const win = window.open("", "_blank", "width=900,height=1200");
            if (!win) {
                alert("Popup diblokir browser. Izinkan popup untuk mencetak Work Order.");
                return;
            }
            // Salin semua stylesheet & style inline dari halaman agar kelas Tailwind berlaku.
            const styles = Array.from(
                document.querySelectorAll('link[rel="stylesheet"], style'),
            ).map((el) => el.outerHTML).join("");

            win.document.write(
                `<!DOCTYPE html><html><head><meta charset="utf-8">` +
                `<title>Work Order ${form.woNumber || jobNumber}</title>` +
                `<base href="${window.location.origin}/">` +
                styles +
                // margin via @page sering diabaikan browser → pakai padding body sebagai
                // batas pinggir yang dijamin tampil. @page margin 0 supaya tak dobel.
                `<style>@page{size:A4;margin:0}html,body{background:#fff!important;margin:0}` +
                `body{box-sizing:border-box;padding:16mm 14mm;` +
                `-webkit-print-color-adjust:exact;print-color-adjust:exact}</style>` +
                `</head><body>${node.innerHTML}</body></html>`,
            );
            win.document.close();
            // Beri waktu CSS + gambar termuat sebelum dialog print muncul.
            let fired = false;
            const fire = () => { if (fired) return; fired = true; win.focus(); win.print(); };
            win.onload = () => setTimeout(fire, 300);
            setTimeout(fire, 900); // fallback kalau onload tak terpicu
        }, 200);
    };

    if (isLoading) {
        return (
            <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // ── Empty state: belum ada WO ──
    if (!wo) {
        return (
            <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-4">
                <div className="glass-strong rounded-xl p-6 max-w-md w-full text-center">
                    <FileText className="h-12 w-12 mx-auto text-indigo-500 mb-3" />
                    <h3 className="font-bold text-lg mb-1">Buat Work Order</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                        Job <span className="font-mono font-semibold">{jobNumber}</span> belum punya Work Order.
                        Buat sekarang — header & data customer akan auto-terisi dari order.
                    </p>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-sm hover:bg-accent">Batal</button>
                        <button onClick={handleCreate} disabled={saving}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50">
                            {saving ? "Membuat..." : "📋 Buat WO"}
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-background/25 backdrop-blur-md z-[300] flex items-center justify-center p-2 sm:p-4 print:bg-white print:relative print:inset-auto print:p-0 print:z-auto">
            <div className="glass-strong rounded-xl w-full max-w-4xl max-h-[95vh] overflow-y-auto">
                {/* Toolbar — hidden saat print */}
                <div className="sticky top-0 bg-card border-b border-border px-4 py-3 flex items-center justify-between z-10 print:hidden">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <FileText className="h-5 w-5 text-indigo-600" />
                        Work Order — {form.woNumber || jobNumber}
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="bg-muted rounded-lg p-1 flex text-xs">
                            <button onClick={() => setMode("form")}
                                className={`px-3 py-1 rounded font-semibold ${mode === "form" ? "bg-card shadow text-indigo-600 dark:text-indigo-300" : "text-muted-foreground"}`}>Edit</button>
                            <button onClick={() => setMode("print")}
                                className={`px-3 py-1 rounded font-semibold ${mode === "print" ? "bg-card shadow text-indigo-600 dark:text-indigo-300" : "text-muted-foreground"}`}>Preview</button>
                        </div>
                        <button onClick={handleSave} disabled={saving}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
                        </button>
                        <button onClick={handlePrint}
                            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-1">
                            <Printer className="h-4 w-4" /> Cetak
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-accent rounded"><X className="h-5 w-5" /></button>
                    </div>
                </div>

                <div ref={printRef} className="p-4">
                    {mode === "form" ? (
                        <WorkOrderForm
                            form={form} setForm={setForm}
                            mockupImages={mockupImages} setMockupImages={setMockupImages}
                            printLayoutImages={printLayoutImages} setPrintLayoutImages={setPrintLayoutImages}
                            shortSleeve={shortSleeve} setShortSleeve={setShortSleeve}
                            longSleeve={longSleeve} setLongSleeve={setLongSleeve}
                            pants={pants} setPants={setPants}
                            patterns={patterns} setPatterns={setPatterns}
                            qc={qc} setQc={setQc}
                        />
                    ) : (
                        <WorkOrderPrint
                            form={form}
                            logoUrl={(settings as any)?.logoImageUrl ?? null}
                            mockupImages={mockupImages} printLayoutImages={printLayoutImages}
                            shortSleeve={shortSleeve} longSleeve={longSleeve} pants={pants}
                            patterns={patterns} qc={qc}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── FORM ───────────────────────────────────────────────────────────────────

function SizeTable({ title, items, setItems }: {
    title: string; items: WoItem[]; setItems: (v: WoItem[]) => void;
}) {
    const total = items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    return (
        <div className="border border-border rounded-lg p-2">
            <div className="font-semibold text-xs mb-1.5">{title} <span className="text-muted-foreground">({total})</span></div>
            <div className="space-y-1">
                {items.map((it, i) => (
                    <div key={i} className="flex gap-1 items-center">
                        <input value={it.size} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, size: e.target.value } : x))}
                            placeholder="Size" className="w-16 border border-border bg-background rounded px-1.5 py-1 text-xs" />
                        <input type="number" min={0} value={it.qty || ""} onChange={e => setItems(items.map((x, j) => j === i ? { ...x, qty: +e.target.value || 0 } : x))}
                            placeholder="Qty" className="w-16 border border-border bg-background rounded px-1.5 py-1 text-xs font-mono" />
                        <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                ))}
            </div>
            <button onClick={() => setItems([...items, { size: "", qty: 1 }])}
                className="mt-1.5 text-[11px] text-indigo-600 font-semibold flex items-center gap-0.5">
                <Plus className="h-3 w-3" /> Size
            </button>
        </div>
    );
}

function MultiImageUploadField({ label, images, onChange, max = 6 }: {
    label: string; images: string[]; onChange: (urls: string[]) => void; max?: number;
}) {
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const pickFiles = () => { if (!uploading) inputRef.current?.click(); };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const slots = max - images.length;
        if (slots <= 0) { alert(`Maksimal ${max} gambar`); e.target.value = ""; return; }
        const toUpload = files.slice(0, slots);
        setUploading(true);
        try {
            const uploaded: string[] = [];
            for (const file of toUpload) {
                if (!file.type.startsWith("image/")) { alert(`${file.name}: bukan gambar — skip`); continue; }
                uploaded.push(await uploadWorkOrderImage(file));
            }
            onChange([...images, ...uploaded]);
        } catch (err: any) {
            alert(`Upload gagal: ${err?.response?.data?.message || err?.message || err}`);
        } finally { setUploading(false); e.target.value = ""; }
    };

    const removeAt = (i: number) => onChange(images.filter((_, j) => j !== i));

    return (
        <div>
            <div className="text-[11px] font-semibold text-muted-foreground mb-1">
                {label} <span className="text-muted-foreground/70 font-normal">({images.length}/{max})</span>
            </div>
            <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" />
            <div className="grid grid-cols-3 gap-1.5">
                {images.map((url, i) => {
                    const src = resolvePhotoUrl(url) || url;
                    return (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-indigo-500/20 bg-muted group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
                            <button type="button" onClick={() => removeAt(i)}
                                className="absolute top-0.5 right-0.5 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Hapus">×</button>
                        </div>
                    );
                })}
                {images.length < max && (
                    <button type="button" onClick={pickFiles} disabled={uploading}
                        className="flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-border hover:border-indigo-400 hover:bg-indigo-500/10 transition-colors disabled:opacity-50">
                        {uploading
                            ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                            : <Upload className="h-5 w-5 text-muted-foreground" />}
                        <span className="text-[9px] text-muted-foreground mt-0.5">{uploading ? "..." : "Tambah"}</span>
                    </button>
                )}
            </div>
        </div>
    );
}

function WorkOrderForm({ form, setForm, mockupImages, setMockupImages, printLayoutImages, setPrintLayoutImages, shortSleeve, setShortSleeve, longSleeve, setLongSleeve, pants, setPants, patterns, setPatterns, qc, setQc }: any) {
    const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
    const lbl = "block text-[11px] font-semibold text-muted-foreground mb-0.5";
    const inp = "w-full border border-border bg-background rounded-lg px-2.5 py-1.5 text-sm";

    // Opsi jenis kerah diambil dari variant produk "Kerah" di manajemen stok.
    const { data: products } = useQuery({
        queryKey: ["products-for-collar"],
        queryFn: getProducts,
        staleTime: 5 * 60_000,
    });
    const collarOptions: string[] = useMemo(() => {
        const list = (products as any[]) ?? [];
        const opts: string[] = [];
        for (const p of list) {
            const isKerah = (p.name || "").toLowerCase().includes("kerah")
                || (p.category?.name || "").toLowerCase().includes("kerah");
            if (!isKerah) continue;
            for (const v of p.variants || []) {
                const name = v.variantName || p.name;
                if (name && !opts.includes(name)) opts.push(name);
            }
        }
        return opts;
    }, [products]);
    // Opsi kerah/bahan yang pernah disimpan — nilai custom otomatis muncul di sini
    // begitu sebuah WO disimpan (lihat invalidateQueries di handleSave).
    const { data: woOptions } = useQuery({
        queryKey: ["wo-options"],
        queryFn: getWorkOrderOptions,
        staleTime: 5 * 60_000,
    });

    // Gabungan saran (dedup case-insensitive): default + dari produk "Kerah"
    // + nilai tersimpan + nilai yang sedang diisi. "Lainnya" dibuang (sudah bisa ketik bebas).
    const mergeSuggest = (...lists: (string[] | undefined)[]): string[] => {
        const seen = new Map<string, string>();
        for (const list of lists) {
            for (const raw of list ?? []) {
                const v = (raw || "").trim();
                if (!v || v.toLowerCase() === "lainnya") continue;
                const k = v.toLowerCase();
                if (!seen.has(k)) seen.set(k, v);
            }
        }
        return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "id"));
    };
    const collarSuggestions = mergeSuggest(COLLAR_OPTIONS, collarOptions, woOptions?.collarTypes, [form.collarType]);
    const fabricSuggestions = mergeSuggest(FABRIC_OPTIONS, woOptions?.fabricTypes, [form.fabricType]);

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div><label className={lbl}>Tgl Order</label><input type="date" value={form.orderDate} onChange={e => set("orderDate", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Sumber</label><input value={form.source} onChange={e => set("source", e.target.value)} placeholder="META/WA/IG" className={inp} /></div>
                <div><label className={lbl}>Desainer</label><input value={form.designerName} onChange={e => set("designerName", e.target.value)} className={inp} /></div>
                <div><label className={lbl}>Dateline</label><input type="date" value={form.deadline} onChange={e => set("deadline", e.target.value)} className={inp} /></div>
            </div>

            {/* Identitas */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="col-span-2"><label className={lbl}>Nama Pemesan</label><input value={form.customerName} onChange={e => set("customerName", e.target.value)} className={inp} /></div>
                <div>
                    <label className={lbl}>Jenis Kerah</label>
                    <input
                        list="wo-collar-options"
                        value={form.collarType}
                        onChange={e => set("collarType", e.target.value)}
                        placeholder="Pilih / ketik custom"
                        className={inp}
                    />
                    <datalist id="wo-collar-options">
                        {collarSuggestions.map((o: string) => <option key={o} value={o} />)}
                    </datalist>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Ketik bebas — nilai baru tersimpan otomatis & jadi pilihan berikutnya.</p>
                </div>
                <div>
                    <label className={lbl}>Bahan</label>
                    <input
                        list="wo-fabric-options"
                        value={form.fabricType}
                        onChange={e => set("fabricType", e.target.value)}
                        placeholder="Pilih / ketik custom"
                        className={inp}
                    />
                    <datalist id="wo-fabric-options">
                        {fabricSuggestions.map((o: string) => <option key={o} value={o} />)}
                    </datalist>
                </div>
            </div>
            <div>
                <label className={lbl}>Kode Produksi</label>
                <input value={form.woNumber} onChange={e => set("woNumber", e.target.value)} placeholder="auto-generate" className={`${inp} font-mono max-w-xs`} />
            </div>

            {/* Upload gambar (multi): Mockup desain & Layout pola print */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <MultiImageUploadField label="Mockup Desain" images={mockupImages} onChange={setMockupImages} />
                <MultiImageUploadField label="Layout Pola Print" images={printLayoutImages} onChange={setPrintLayoutImages} />
            </div>

            {/* Jumlah Order */}
            <div>
                <div className="font-bold text-sm mb-2">Jumlah Order</div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <SizeTable title="Atasan Lengan Pendek" items={shortSleeve} setItems={setShortSleeve} />
                    <SizeTable title="Atasan Lengan Panjang" items={longSleeve} setItems={setLongSleeve} />
                    <SizeTable title="Celana" items={pants} setItems={setPants} />
                </div>
            </div>

            {/* Pola Print */}
            <div>
                <div className="font-bold text-sm mb-2">Pola Print</div>
                <div className="space-y-1">
                    {patterns.map((p: WoPrintPattern, i: number) => (
                        <div key={i} className="flex gap-1 items-center">
                            <input value={p.name} onChange={e => setPatterns(patterns.map((x: WoPrintPattern, j: number) => j === i ? { ...x, name: e.target.value } : x))}
                                placeholder="Nama pola" className="flex-1 border border-border bg-background rounded px-2 py-1 text-xs" />
                            <input type="number" min={0} value={p.qty || ""} onChange={e => setPatterns(patterns.map((x: WoPrintPattern, j: number) => j === i ? { ...x, qty: +e.target.value || 0 } : x))}
                                placeholder="Jml" className="w-16 border border-border bg-background rounded px-1.5 py-1 text-xs font-mono" />
                            <button onClick={() => setPatterns(patterns.filter((_: any, j: number) => j !== i))} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                    ))}
                </div>
                <button onClick={() => setPatterns([...patterns, { name: "", qty: 0 }])}
                    className="mt-1.5 text-[11px] text-indigo-600 font-semibold flex items-center gap-0.5"><Plus className="h-3 w-3" /> Pola</button>
            </div>

            {/* QC checklist */}
            <div>
                <div className="font-bold text-sm mb-2">Quality Control</div>
                <div className="space-y-1">
                    {qc.map((row: WoQcRow, i: number) => (
                        <div key={i} className="flex gap-1 items-center">
                            <input value={row.criteria} onChange={e => setQc(qc.map((x: WoQcRow, j: number) => j === i ? { ...x, criteria: e.target.value } : x))}
                                placeholder="Kriteria" className="flex-1 border border-border bg-background rounded px-2 py-1 text-xs" />
                            <input value={row.note || ""} onChange={e => setQc(qc.map((x: WoQcRow, j: number) => j === i ? { ...x, note: e.target.value } : x))}
                                placeholder="Catatan" className="w-28 border border-border bg-background rounded px-2 py-1 text-xs" />
                            <input value={row.inspector || ""} onChange={e => setQc(qc.map((x: WoQcRow, j: number) => j === i ? { ...x, inspector: e.target.value } : x))}
                                placeholder="Pemeriksa" className="w-24 border border-border bg-background rounded px-2 py-1 text-xs" />
                            <button onClick={() => setQc(qc.filter((_: any, j: number) => j !== i))} className="text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                    ))}
                </div>
                <button onClick={() => setQc([...qc, { criteria: "" }])}
                    className="mt-1.5 text-[11px] text-indigo-600 font-semibold flex items-center gap-0.5"><Plus className="h-3 w-3" /> Kriteria</button>
            </div>

            {/* Tanggal tahap */}
            <div>
                <div className="font-bold text-sm mb-2">Tanggal Tahap Produksi</div>
                <div className="grid grid-cols-3 gap-2">
                    <div><label className={lbl}>Tgl Print</label><input type="date" value={form.tglPrint} onChange={e => set("tglPrint", e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Tgl Press</label><input type="date" value={form.tglPress} onChange={e => set("tglPress", e.target.value)} className={inp} /></div>
                    <div><label className={lbl}>Tgl Jahit</label><input type="date" value={form.tglJahit} onChange={e => set("tglJahit", e.target.value)} className={inp} /></div>
                </div>
            </div>

            <div>
                <label className={lbl}>Catatan</label>
                <textarea rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} className={inp} />
            </div>
        </div>
    );
}

// ─── PRINT VIEW ─────────────────────────────────────────────────────────────

function WorkOrderPrint({ form, logoUrl = null, mockupImages = [], printLayoutImages = [], shortSleeve, longSleeve, pants, patterns, qc }: any) {
    const mockups: string[] = (mockupImages as string[]).map((u) => resolvePhotoUrl(u) || u).filter(Boolean);
    const layouts: string[] = (printLayoutImages as string[]).map((u) => resolvePhotoUrl(u) || u).filter(Boolean);
    const logoSrc = logoUrl ? (resolvePhotoUrl(logoUrl) || logoUrl) : null;
    const cell = "border border-black px-1.5 py-0.5 text-[11px]";

    const renderSizeCol = (title: string, items: WoItem[]) => (
        <div>
            <div className="font-semibold text-[11px] text-center border border-black bg-gray-100 py-0.5">{title}</div>
            <table className="w-full border-collapse">
                <thead><tr><th className={cell}>Size</th><th className={cell}>Jml</th></tr></thead>
                <tbody>
                    {(items.length ? items : [{ size: "", qty: 0 }]).map((it, i) => (
                        <tr key={i}><td className={cell}>{it.size}</td><td className={`${cell} text-center font-mono`}>{it.qty || ""}</td></tr>
                    ))}
                    <tr><td className={`${cell} font-bold`}>Total</td><td className={`${cell} text-center font-bold font-mono`}>{items.reduce((s, x) => s + (Number(x.qty) || 0), 0)}</td></tr>
                </tbody>
            </table>
        </div>
    );

    return (
        <div className="text-black">
            {/* Header: logo kiri — judul tengah — info order kanan */}
            <div className="flex items-center justify-between gap-3 border-b-2 border-black pb-2 mb-3">
                {/* Logo toko (kiri) */}
                <div className="w-24 shrink-0 flex items-center">
                    {logoSrc && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={logoSrc} alt="Logo" className="h-16 w-auto max-w-[96px] object-contain" />
                    )}
                </div>
                {/* Judul (tengah) */}
                <div className="flex-1 text-center">
                    <div className="text-2xl font-bold tracking-tight">WORK ORDER</div>
                    <div className="text-sm text-gray-600">Jersey Printing</div>
                </div>
                {/* Info order (kanan) */}
                <table className="border-collapse text-[11px] shrink-0">
                    <thead><tr>
                        <th className={cell}>Tgl Order</th><th className={cell}>Sumber</th>
                        <th className={cell}>Desainer</th><th className={cell}>Dateline</th>
                    </tr></thead>
                    <tbody><tr>
                        <td className={cell}>{fmtDate(form.orderDate)}</td>
                        <td className={cell}>{form.source}</td>
                        <td className={cell}>{form.designerName}</td>
                        <td className={cell}>{fmtDate(form.deadline)}</td>
                    </tr></tbody>
                </table>
            </div>

            {/* Identitas + Mockup */}
            <div className="flex gap-4 mb-3">
                <div className="flex-1 space-y-1 text-sm">
                    <div className="flex"><span className="w-32 font-semibold">Nama Pemesan</span>: {form.customerName}</div>
                    <div className="flex"><span className="w-32 font-semibold">Jenis Kerah</span>: {form.collarType}</div>
                    <div className="flex"><span className="w-32 font-semibold">Bahan</span>: {form.fabricType}</div>
                    <div className="flex"><span className="w-32 font-semibold">Kode Produksi</span>: <span className="font-mono">{form.woNumber}</span></div>
                </div>
                {mockups.length > 0 ? (
                    <div className={`shrink-0 grid gap-1 ${mockups.length > 1 ? "grid-cols-2 w-44" : "w-40"}`}>
                        {mockups.map((m, i) => (
                            <div key={i} className="border border-black aspect-square flex items-center justify-center overflow-hidden">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={m} alt={`mockup ${i + 1}`} className="max-w-full max-h-full object-contain" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="w-40 h-40 border border-black flex items-center justify-center text-xs text-gray-400 shrink-0">MOCK UP</div>
                )}
            </div>

            {/* Jumlah Order */}
            <div className="font-bold text-sm mb-1">JUMLAH ORDER</div>
            <div className="grid grid-cols-3 gap-2 mb-3">
                {renderSizeCol("Atasan Lengan Pendek", shortSleeve)}
                {renderSizeCol("Atasan Lengan Panjang", longSleeve)}
                {renderSizeCol("Celana", pants)}
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* Pola Print */}
                <div>
                    <div className="font-bold text-sm mb-1">POLA PRINT</div>
                    <table className="w-full border-collapse">
                        <thead><tr><th className={cell}>Pola</th><th className={cell}>Jml</th><th className={cell}>OK</th></tr></thead>
                        <tbody>
                            {patterns.map((p: WoPrintPattern, i: number) => (
                                <tr key={i}>
                                    <td className={cell}>{p.name}</td>
                                    <td className={`${cell} text-center font-mono`}>{p.qty || ""}</td>
                                    <td className={`${cell} text-center`}>{p.ok ? "✓" : ""}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {layouts.length > 0 && (
                        <div className="mt-2 border border-black p-1">
                            <div className="text-[10px] font-semibold text-gray-600 mb-0.5">Layout Pola Print</div>
                            <div className={`grid gap-1 ${layouts.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                                {layouts.map((l, i) => (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img key={i} src={l} alt={`layout ${i + 1}`} className="w-full max-h-44 object-contain" />
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Tanggal Tahap */}
                <div>
                    <div className="font-bold text-sm mb-1">TAHAP PRODUKSI</div>
                    <table className="w-full border-collapse">
                        <tbody>
                            <tr><td className={`${cell} font-semibold`}>Tgl Print</td><td className={cell}>{fmtDate(form.tglPrint)}</td><td className={cell}>{form.printInspector}</td></tr>
                            <tr><td className={`${cell} font-semibold`}>Tgl Press</td><td className={cell}>{fmtDate(form.tglPress)}</td><td className={cell}></td></tr>
                            <tr><td className={`${cell} font-semibold`}>Tgl Jahit</td><td className={cell}>{fmtDate(form.tglJahit)}</td><td className={cell}>{form.jahitInspector}</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>

            {/* QC */}
            <div className="mt-3">
                <div className="font-bold text-sm mb-1">QUALITY CONTROL</div>
                <table className="w-full border-collapse">
                    <thead><tr>
                        <th className={cell}>Kriteria</th><th className={cell}>OK</th>
                        <th className={cell}>Catatan</th><th className={cell}>Pemeriksa</th>
                    </tr></thead>
                    <tbody>
                        {qc.map((row: WoQcRow, i: number) => (
                            <tr key={i}>
                                <td className={cell}>{row.criteria}</td>
                                <td className={`${cell} text-center`}>{row.ok ? "✓" : ""}</td>
                                <td className={cell}>{row.note}</td>
                                <td className={cell}>{row.inspector}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {form.notes && (
                <div className="mt-3 text-[11px]"><span className="font-semibold">Catatan:</span> {form.notes}</div>
            )}
        </div>
    );
}
