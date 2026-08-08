"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Plus, Trash2, Pencil, ShoppingBag, X } from "lucide-react";
import {
    listWaChannels, listWaCatalog, createWaCatalogProduct, updateWaCatalogProduct, deleteWaCatalogProduct,
    type WaChannel, type WaCatalogProduct, type CatalogProductBody,
} from "@/lib/api/whatsapp-cloud";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";

const EMPTY: CatalogProductBody = { name: "", description: "", priceRupiah: undefined, imageUrl: "", url: "" };

function errMsg(e: unknown, fb: string) {
    return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;
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

    const startEdit = (p: WaCatalogProduct) => {
        setEditId(p.id);
        setForm({
            name: p.name ?? "",
            description: p.description ?? "",
            imageUrl: p.imageUrl ?? "",
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
                    <label className="text-sm sm:col-span-2">URL gambar (publik)
                        <input value={form.imageUrl ?? ""} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                            placeholder="https://…/foto-produk.jpg" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
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
                            {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={p.name ?? ""} className="w-16 h-16 rounded-lg object-cover border border-border shrink-0" />
                            ) : (
                                <div className="w-16 h-16 rounded-lg bg-muted grid place-items-center shrink-0"><ShoppingBag className="w-5 h-5 opacity-50" /></div>
                            )}
                            <div className="min-w-0 flex-1">
                                <div className="font-medium truncate">{p.name}</div>
                                <div className="text-sm text-emerald-600 dark:text-emerald-400">{p.price}</div>
                                {p.description && <div className="text-xs opacity-60 line-clamp-2">{p.description}</div>}
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
