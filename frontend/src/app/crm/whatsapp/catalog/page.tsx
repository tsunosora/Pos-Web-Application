"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Pencil, ShoppingBag, X, Upload, Loader2, ImagePlus, Clock, CheckCircle2, AlertTriangle, type LucideIcon } from "lucide-react";
import {
    listWaChannels, listWaCatalog, createWaCatalogProduct, updateWaCatalogProduct, deleteWaCatalogProduct, uploadWaCatalogImage,
    getWaCatalogConfig, setWaCatalogConfig,
    type WaChannel, type WaCatalogProduct, type CatalogProductBody,
} from "@/lib/api/whatsapp-cloud";
import { StatusBadge, type BadgeTone } from "@/components/ui/status-badge";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";

const EMPTY: CatalogProductBody = { name: "", description: "", priceRupiah: undefined, imageUrl: "", url: "", additionalImageUrls: [] };

const MAX_EXTRA_IMAGES = 10; // batas additional_image_urls Meta

function errMsg(e: unknown, fb: string) {
    return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;
}

/** Status approval Meta → badge terbaca. null = tak perlu tampil (mis. produk tanpa review). */
function reviewBadge(status: string | null | undefined): { label: string; tone: BadgeTone; icon: LucideIcon } | null {
    switch ((status || "").toLowerCase()) {
        case "pending": return { label: "Menunggu review Meta", tone: "warning", icon: Clock };
        case "approved": return { label: "Disetujui Meta", tone: "success", icon: CheckCircle2 };
        case "rejected": return { label: "Ditolak Meta", tone: "danger", icon: AlertTriangle };
        case "outdated": return { label: "Perlu diperbarui", tone: "warning", icon: AlertTriangle };
        default: return null; // no_review / kosong → produk langsung tayang, tak perlu badge
    }
}

export default function WhatsappCatalogPage() {
    const qc = useQueryClient();
    const [channelId, setChannelId] = useState<number | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<string | null>(null); // productId sedang diedit
    const [form, setForm] = useState<CatalogProductBody>(EMPTY);

    const { data: channels = [] } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });
    const activeChannels = useMemo(() => channels.filter((c: WaChannel) => c.isActive), [channels]);
    useEffect(() => { if (channelId === null && activeChannels.length) setChannelId(activeChannels[0].id); }, [activeChannels, channelId]);

    const { data: products = [], isLoading, error } = useQuery({
        queryKey: ["wa-catalog", channelId],
        queryFn: () => listWaCatalog(channelId as number),
        enabled: channelId != null,
        retry: false,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["wa-catalog", channelId] });

    // Catalog ID manual (lewati auto-deteksi WABA yang bisa kena error #100).
    const [catIdInput, setCatIdInput] = useState("");
    const [showConfig, setShowConfig] = useState(false);
    const { data: cfg } = useQuery({
        queryKey: ["wa-catalog-config", channelId],
        queryFn: () => getWaCatalogConfig(channelId as number),
        enabled: channelId != null,
    });
    useEffect(() => { setCatIdInput(cfg?.catalogId ?? ""); }, [cfg?.catalogId, channelId]);
    const saveCfgMut = useMutation({
        mutationFn: () => setWaCatalogConfig(channelId as number, catIdInput.trim() || null),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["wa-catalog-config", channelId] });
            invalidate();
            setShowConfig(false);
        },
        onError: (e) => alert(errMsg(e, "Gagal menyimpan Catalog ID")),
    });
    const resetForm = () => { setForm(EMPTY); setEditId(null); setShowForm(false); };

    const saveMut = useMutation({
        mutationFn: () => editId
            ? updateWaCatalogProduct(channelId as number, editId, form)
            : createWaCatalogProduct(channelId as number, form),
        onSuccess: () => { resetForm(); invalidate(); },
        onError: (e) => alert(errMsg(e, "Gagal menyimpan produk")),
    });
    const delMut = useMutation({
        mutationFn: (productId: string) => deleteWaCatalogProduct(channelId as number, productId),
        onSuccess: invalidate,
        onError: (e) => alert(errMsg(e, "Gagal menghapus produk")),
    });
    const [uploading, setUploading] = useState(false);
    const onPickImage = async (file: File | undefined) => {
        if (!file) return;
        setUploading(true);
        try {
            const { url } = await uploadWaCatalogImage(file);
            setForm((f) => ({ ...f, imageUrl: url }));
        } catch (e) {
            alert(errMsg(e, "Gagal mengunggah gambar"));
        } finally {
            setUploading(false);
        }
    };

    // Gambar tambahan (galeri) — unggah banyak sekaligus, batasi total 10.
    const [uploadingExtra, setUploadingExtra] = useState(false);
    const onPickAdditional = async (files: FileList | null) => {
        if (!files?.length) return;
        setUploadingExtra(true);
        try {
            const room = Math.max(0, MAX_EXTRA_IMAGES - (form.additionalImageUrls?.length ?? 0));
            const picked = Array.from(files).slice(0, room);
            const urls: string[] = [];
            for (const f of picked) urls.push((await uploadWaCatalogImage(f)).url);
            setForm((f) => ({ ...f, additionalImageUrls: [...(f.additionalImageUrls ?? []), ...urls] }));
        } catch (e) {
            alert(errMsg(e, "Gagal mengunggah gambar tambahan"));
        } finally {
            setUploadingExtra(false);
        }
    };
    const removeAdditional = (idx: number) =>
        setForm((f) => ({ ...f, additionalImageUrls: (f.additionalImageUrls ?? []).filter((_, i) => i !== idx) }));

    const startEdit = (p: WaCatalogProduct) => {
        setEditId(p.id);
        setForm({
            name: p.name ?? "",
            description: p.description ?? "",
            imageUrl: p.imageUrl ?? "",
            additionalImageUrls: p.additionalImageUrls ?? [],
            url: p.url ?? "",
            priceRupiah: undefined, // Meta hanya kirim harga terformat; isi ulang bila mau ubah
        });
        setShowForm(true);
    };

    const canSave = (form.name?.trim().length ?? 0) > 0 && !saveMut.isPending && channelId != null &&
        (editId != null || (form.imageUrl?.trim().length ?? 0) > 0);

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                    <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                    <ShoppingBag className="w-5 h-5 text-emerald-500" />
                    <h1 className="text-lg font-semibold">Katalog Produk</h1>
                    <WhatsappGuideButton />
                </div>
                <div className="flex items-center gap-2">
                    <select value={channelId ?? ""} onChange={(e) => setChannelId(e.target.value ? +e.target.value : null)}
                        className="text-sm rounded-lg bg-muted/60 px-2.5 py-1.5 outline-none">
                        <option value="">Pilih channel…</option>
                        {activeChannels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                    </select>
                    <button onClick={() => { setForm(EMPTY); setEditId(null); setShowForm((s) => !s); }} disabled={!channelId}
                        className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                        <Plus className="w-4 h-4" /> Produk
                    </button>
                </div>
            </div>

            <p className="text-sm opacity-60">
                Katalog resmi <b>WhatsApp Business (Meta Commerce)</b>. Produk tersimpan di katalog WABA-mu.
                URL gambar harus <b>dapat diakses publik</b>. Perlu katalog terhubung di Commerce Manager &amp; token izin <code>catalog_management</code>.
            </p>

            {channelId && (
                <div className="rounded-2xl border border-border bg-card/40 p-3">
                    <button onClick={() => setShowConfig((s) => !s)} className="text-sm font-medium flex items-center gap-2">
                        ⚙️ Catalog ID {cfg?.catalogId ? <span className="text-xs opacity-60 font-mono">({cfg.catalogId})</span> : <span className="text-xs text-amber-500">belum diset</span>}
                    </button>
                    {showConfig && (
                        <div className="mt-2 space-y-2">
                            <p className="text-xs opacity-60">
                                Isi <b>Catalog ID</b> dari Meta Commerce Manager (Katalog → Pengaturan → ID katalog). Ini melewati
                                deteksi otomatis yang bisa gagal (#100 “application not approved”).
                            </p>
                            <div className="flex gap-2">
                                <input value={catIdInput} onChange={(e) => setCatIdInput(e.target.value)} placeholder="mis. 1234567890123456"
                                    className="flex-1 rounded-lg bg-muted/60 px-3 py-1.5 text-sm outline-none font-mono" />
                                <button onClick={() => saveCfgMut.mutate()} disabled={saveCfgMut.isPending}
                                    className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">Simpan</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {showForm && (
                <div className="rounded-2xl border border-border bg-card/60 p-4 grid sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2 font-medium text-sm">{editId ? "Edit produk" : "Produk baru"}</div>
                    <label className="text-sm">Nama produk
                        <input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })}
                            placeholder="Spanduk Flexi" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <label className="text-sm">Harga (Rp){editId ? " — kosongkan bila tak diubah" : ""}
                        <input type="number" value={form.priceRupiah ?? ""} onChange={(e) => setForm({ ...form, priceRupiah: e.target.value === "" ? undefined : Number(e.target.value) })}
                            placeholder="25000" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <div className="text-sm sm:col-span-2">
                        <span>Gambar produk</span>
                        <div className="mt-1 flex items-center gap-3">
                            {form.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={form.imageUrl} alt="produk" className="w-16 h-16 rounded-lg object-cover border border-border shrink-0" />
                            ) : (
                                <div className="w-16 h-16 rounded-lg bg-muted grid place-items-center shrink-0"><ShoppingBag className="w-5 h-5 opacity-50" /></div>
                            )}
                            <div className="flex-1 min-w-0">
                                <label className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/70 cursor-pointer">
                                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                    {uploading ? "Mengunggah…" : "Unggah gambar"}
                                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                                        onChange={(e) => { onPickImage(e.target.files?.[0]); e.currentTarget.value = ""; }} />
                                </label>
                                <input value={form.imageUrl ?? ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                                    placeholder="…atau tempel URL gambar" className="mt-1.5 w-full rounded-lg bg-muted/60 px-3 py-1.5 text-xs outline-none" />
                            </div>
                        </div>
                        <span className="text-[11px] opacity-50">Gambar diunggah otomatis jadi URL publik yang bisa diambil Meta.</span>
                    </div>
                    <div className="text-sm sm:col-span-2">
                        <span>Gambar tambahan <span className="opacity-50">(opsional, galeri — maks {MAX_EXTRA_IMAGES})</span></span>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                            {(form.additionalImageUrls ?? []).map((u, i) => (
                                <div key={u + i} className="relative w-16 h-16 shrink-0">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={u} alt={`gambar ${i + 2}`} className="w-16 h-16 rounded-lg object-cover border border-border" />
                                    <button type="button" onClick={() => removeAdditional(i)} aria-label="Hapus gambar"
                                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white grid place-items-center shadow">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            {(form.additionalImageUrls?.length ?? 0) < MAX_EXTRA_IMAGES && (
                                <label className="w-16 h-16 rounded-lg border border-dashed border-border grid place-items-center cursor-pointer hover:bg-muted/50 shrink-0" title="Tambah gambar">
                                    {uploadingExtra ? <Loader2 className="w-4 h-4 animate-spin opacity-60" /> : <ImagePlus className="w-4 h-4 opacity-60" />}
                                    <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden"
                                        onChange={(e) => { onPickAdditional(e.target.files); e.currentTarget.value = ""; }} />
                                </label>
                            )}
                        </div>
                        <span className="text-[11px] opacity-50">Tampil sebagai galeri saat produk dibuka pelanggan di WhatsApp. Bisa pilih beberapa berkas sekaligus.</span>
                    </div>
                    <label className="text-sm sm:col-span-2">Deskripsi
                        <textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
                            rows={2} placeholder="Cetak spanduk flexi 280gr, tahan luar ruang…"
                            className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none resize-none" />
                    </label>
                    <label className="text-sm sm:col-span-2">Link produk (opsional)
                        <input value={form.url ?? ""} onChange={(e) => setForm({ ...form, url: e.target.value })}
                            placeholder="https://tokomu.com/spanduk" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <div className="sm:col-span-2 flex justify-end gap-2">
                        <button onClick={resetForm} className="text-sm px-3 py-1.5 rounded-lg bg-muted">Batal</button>
                        <button onClick={() => saveMut.mutate()} disabled={!canSave}
                            className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                            {saveMut.isPending ? "Menyimpan…" : "Simpan"}
                        </button>
                    </div>
                </div>
            )}

            {!channelId ? (
                <p className="text-sm opacity-60">Pilih channel dulu.</p>
            ) : isLoading ? (
                <p className="text-sm opacity-60">Memuat katalog…</p>
            ) : error ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                    <X className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{errMsg(error, "Gagal memuat katalog. Pastikan katalog terhubung di Commerce Manager & token punya izin catalog_management.")}</span>
                </div>
            ) : products.length === 0 ? (
                <p className="text-sm opacity-60">Belum ada produk di katalog ini.</p>
            ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                    {products.map((p) => (
                        <div key={p.id} className="rounded-2xl border border-border bg-card/60 p-3 flex gap-3">
                            <div className="relative w-16 h-16 shrink-0">
                                {p.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={p.imageUrl} alt={p.name ?? ""} className="w-16 h-16 rounded-lg object-cover border border-border" />
                                ) : (
                                    <div className="w-16 h-16 rounded-lg bg-muted grid place-items-center"><ShoppingBag className="w-5 h-5 opacity-50" /></div>
                                )}
                                {(p.additionalImageUrls?.length ?? 0) > 0 && (
                                    <span className="absolute bottom-0.5 right-0.5 text-[10px] leading-none px-1 py-0.5 rounded bg-black/65 text-white font-medium" title={`${p.additionalImageUrls!.length} gambar tambahan`}>
                                        +{p.additionalImageUrls!.length}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{p.name}</div>
                                <div className="text-sm text-emerald-600 dark:text-emerald-400">{p.price}</div>
                                {(() => { const b = reviewBadge(p.reviewStatus); return b ? <StatusBadge tone={b.tone} icon={b.icon} className="mt-1">{b.label}</StatusBadge> : null; })()}
                                {p.description && <div className="text-xs opacity-60 line-clamp-2 mt-1">{p.description}</div>}
                                <div className="flex gap-1.5 mt-1.5">
                                    <button onClick={() => startEdit(p)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-border hover:bg-muted">
                                        <Pencil className="w-3 h-3" /> Edit
                                    </button>
                                    <button onClick={() => { if (confirm(`Hapus "${p.name}" dari katalog?`)) delMut.mutate(p.id); }}
                                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-lg border border-border hover:bg-red-500/10 text-red-500">
                                        <Trash2 className="w-3 h-3" /> Hapus
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
