"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, ShoppingBag, X } from "lucide-react";
import {
    addProductToWaCatalog, listWaChannels, previewProductToWaCatalog,
    type WaCatalogFromProductResult, type WaChannel,
} from "@/lib/api/whatsapp-cloud";

const rpMinor = (minor: number) => "Rp " + Math.round(minor / 100).toLocaleString("id-ID");
const errMsg = (e: unknown, fb: string) => (e as { response?: { data?: { message?: string } } })?.response?.data?.message || fb;

/**
 * "Jadikan Katalog WA" dari produk POS: nama, harga, deskripsi & gambar diambil otomatis dari
 * produk (pratinjau dari server), pilih varian, lalu kirim. Varian yang sudah ada diperbarui.
 */
export function WaCatalogFromProductModal({ product, onClose }: { product: { id: number; name: string }; onClose: () => void }) {
    const qc = useQueryClient();
    const { data: channels = [], isLoading: loadingChannels } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });
    const activeChannels = useMemo(() => channels.filter((c: WaChannel) => c.isActive), [channels]);
    const [channelId, setChannelId] = useState<number | null>(null);
    useEffect(() => {
        if (channelId == null && activeChannels.length) setChannelId(activeChannels[0].id);
    }, [activeChannels, channelId]);

    // Pratinjau pakai mutation (tidak disimpan ke cache persisten).
    const previewMut = useMutation({ mutationFn: (chId: number) => previewProductToWaCatalog(chId, product.id) });
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [done, setDone] = useState<WaCatalogFromProductResult | null>(null);
    const plan = previewMut.data?.plan ?? [];

    useEffect(() => {
        if (channelId == null) return;
        setDone(null);
        previewMut.mutate(channelId, {
            onSuccess: (res) => setSelected(new Set((res.plan ?? []).filter((p) => p.action !== "skip").map((p) => p.variantId))),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [channelId, product.id]);

    const sendMut = useMutation({
        mutationFn: () => addProductToWaCatalog(channelId as number, product.id, [...selected]),
        onSuccess: (res) => {
            setDone(res);
            qc.invalidateQueries({ queryKey: ["wa-catalog", channelId] });
        },
    });

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !sendMut.isPending) onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose, sendMut.isPending]);

    const toggle = (id: number) => setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const firstPayload = plan.find((p) => p.payload)?.payload;
    const allUpdate = plan.length > 0 && [...selected].every((id) => plan.find((p) => p.variantId === id)?.action === "update");
    const okCount = done?.results?.filter((r) => r.ok).length ?? 0;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-background/25 backdrop-blur-md" onClick={() => !sendMut.isPending && onClose()}>
            <div role="dialog" aria-modal="true" aria-labelledby="wa-cat-title" onClick={(e) => e.stopPropagation()}
                className="glass-strong w-full sm:max-w-lg rounded-t-2xl sm:rounded-xl border border-border shadow-lg overflow-hidden flex flex-col max-h-[88vh]">
                <div className="flex items-start gap-3 border-b border-border px-4 py-3">
                    <div className="mt-0.5 rounded-lg bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400"><ShoppingBag className="h-4 w-4" /></div>
                    <div className="min-w-0 flex-1">
                        <h3 id="wa-cat-title" className="font-semibold leading-tight">Jadikan Katalog WhatsApp</h3>
                        <p className="truncate text-xs text-muted-foreground">{product.name}</p>
                    </div>
                    <button type="button" onClick={onClose} disabled={sendMut.isPending} aria-label="Tutup" className="rounded-md p-1 text-muted-foreground hover:bg-muted disabled:opacity-40">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
                    {loadingChannels ? (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat channel WhatsApp…</p>
                    ) : activeChannels.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Belum ada channel WhatsApp aktif. Atur dulu di CRM → WhatsApp → Pengaturan.</p>
                    ) : (
                        <>
                            {activeChannels.length > 1 && (
                                <label className="block text-xs font-medium text-muted-foreground">Channel / nomor WhatsApp
                                    <select value={channelId ?? ""} onChange={(e) => setChannelId(Number(e.target.value))} disabled={sendMut.isPending}
                                        className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground">
                                        {activeChannels.map((c: WaChannel) => <option key={c.id} value={c.id}>{c.label || `Channel ${c.id}`}</option>)}
                                    </select>
                                </label>
                            )}

                            {done ? (
                                <div className="space-y-2">
                                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${okCount > 0 ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>
                                        {okCount > 0 ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
                                        {okCount > 0 ? `${okCount} item terkirim ke katalog WhatsApp.` : "Tidak ada item yang terkirim."}
                                    </div>
                                    <ul className="space-y-1.5 text-sm">
                                        {(done.results ?? []).map((r) => (
                                            <li key={r.variantId} className="flex items-start gap-2">
                                                {r.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                                                <span className="min-w-0">
                                                    <span className="font-medium">{r.name || `Varian #${r.variantId}`}</span>
                                                    <span className="text-muted-foreground"> — {r.ok ? (r.action === "update" ? "diperbarui" : "ditambahkan") : r.error || "gagal"}</span>
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="text-xs text-muted-foreground">Meta kadang perlu beberapa menit untuk meninjau sebelum item tampil di WhatsApp.</p>
                                </div>
                            ) : previewMut.isPending || (!previewMut.data && !previewMut.isError) ? (
                                <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan data dari produk…</p>
                            ) : previewMut.isError ? (
                                <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errMsg(previewMut.error, "Gagal menyiapkan data katalog.")}
                                </p>
                            ) : (
                                <>
                                    <p className="text-xs text-muted-foreground">Nama, harga, deskripsi & gambar diambil otomatis dari produk POS — tidak perlu input ulang.</p>
                                    <ul className="space-y-2">
                                        {plan.map((item) => {
                                            const pl = item.payload;
                                            const skip = item.action === "skip";
                                            return (
                                                <li key={item.variantId}>
                                                    <label className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${skip ? "border-amber-500/30 bg-amber-500/5" : selected.has(item.variantId) ? "border-emerald-500/50 bg-emerald-500/5" : "border-border"} ${skip ? "" : "cursor-pointer"}`}>
                                                        <input type="checkbox" className="h-4 w-4 accent-emerald-600" disabled={skip || sendMut.isPending}
                                                            checked={!skip && selected.has(item.variantId)} onChange={() => toggle(item.variantId)} />
                                                        {pl ? (
                                                            /* eslint-disable-next-line @next/next/no-img-element */
                                                            <img src={pl.image_url} alt="" className="h-12 w-12 shrink-0 rounded-md border border-border object-cover" />
                                                        ) : (
                                                            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-dashed border-amber-500/50 text-amber-600"><AlertTriangle className="h-4 w-4" /></div>
                                                        )}
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate text-sm font-medium">{pl?.name ?? `Varian #${item.variantId}`}</span>
                                                            {pl && <span className="block text-sm font-semibold text-emerald-700 dark:text-emerald-300">{rpMinor(pl.price)}</span>}
                                                            {skip && <span className="block text-xs text-amber-700 dark:text-amber-300">{item.error}</span>}
                                                        </span>
                                                        {!skip && (
                                                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${item.action === "update" ? "bg-sky-500/15 text-sky-700 dark:text-sky-300" : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"}`}>
                                                                {item.action === "update" ? "Sudah ada · perbarui" : "Baru"}
                                                            </span>
                                                        )}
                                                    </label>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {firstPayload && (
                                        <details className="rounded-lg border border-border px-3 py-2 text-sm">
                                            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Lihat deskripsi yang dikirim</summary>
                                            <p className="mt-2 whitespace-pre-line text-xs text-foreground/90">{firstPayload.description}</p>
                                        </details>
                                    )}
                                    {sendMut.isError && (
                                        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errMsg(sendMut.error, "Gagal mengirim ke katalog.")}
                                        </p>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
                    <Link href="/crm/whatsapp/catalog" className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-muted-foreground hover:text-foreground">
                        Buka Katalog WA <ExternalLink className="h-3 w-3" />
                    </Link>
                    {done ? (
                        <button type="button" onClick={onClose} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">Selesai</button>
                    ) : (
                        <div className="ml-auto flex gap-2">
                            <button type="button" onClick={onClose} disabled={sendMut.isPending} className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted disabled:opacity-40">Batal</button>
                            <button type="button" onClick={() => sendMut.mutate()} disabled={selected.size === 0 || sendMut.isPending || !previewMut.data}
                                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
                                {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingBag className="h-4 w-4" />}
                                {allUpdate ? "Perbarui Katalog" : "Kirim ke Katalog"}{selected.size > 0 ? ` (${selected.size})` : ""}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
