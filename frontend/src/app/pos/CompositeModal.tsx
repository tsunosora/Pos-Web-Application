'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Boxes, Loader2 } from 'lucide-react';
import { getCompositeOptions, computeComposite } from '@/lib/api/products';

interface CompositeOption {
    key: string;
    label: string;
    type: 'select' | 'number' | 'variantRef';
    min?: number;
    choices?: any[];
}

interface Quote {
    name: string;
    price: number;
    hpp: number;
    breakdown: { name: string; qty: number; lineTotal: number }[];
}

/**
 * Form konfigurasi produk COMPOSITE (produk konfigurasi, mis. Buku Custom).
 * Opsi diambil dari backend (variantRef sudah di-resolve jadi daftar pilihan),
 * harga dihitung real-time via endpoint compute (server = otoritatif).
 */
export function CompositeModal({
    product,
    onClose,
    onAdd,
}: {
    product: { id: number; name: string };
    onClose: () => void;
    onAdd: (args: {
        productId: number;
        name: string;
        price: number;
        compositeOptions: Record<string, any>;
        breakdown?: { name: string; qty: number; lineTotal: number }[];
        note?: string;
    }) => void;
}) {
    const { data: cfg, isLoading } = useQuery({
        queryKey: ['composite-options', product.id],
        queryFn: () => getCompositeOptions(product.id),
    });
    const options: CompositeOption[] = cfg?.options ?? [];

    const [selected, setSelected] = useState<Record<string, any>>({});
    const [note, setNote] = useState('');
    const [quote, setQuote] = useState<Quote | null>(null);
    const [computing, setComputing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Semua opsi wajib terisi sebelum compute.
    const ready = useMemo(
        () => options.length > 0 && options.every((o) => selected[o.key] !== undefined && selected[o.key] !== ''),
        [options, selected],
    );

    // Debounce compute saat pilihan berubah.
    useEffect(() => {
        if (!ready) { setQuote(null); return; }
        let cancelled = false;
        setComputing(true);
        setError(null);
        const t = setTimeout(async () => {
            try {
                const q = await computeComposite(product.id, selected);
                if (!cancelled) setQuote(q);
            } catch (e: any) {
                if (!cancelled) {
                    setError(e?.response?.data?.message ?? 'Gagal menghitung harga');
                    setQuote(null);
                }
            } finally {
                if (!cancelled) setComputing(false);
            }
        }, 350);
        return () => { cancelled = true; clearTimeout(t); };
    }, [ready, selected, product.id]);

    const setOpt = (key: string, val: any) => setSelected((s) => ({ ...s, [key]: val }));

    const inputClass = 'w-full px-3 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm';

    return (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-background/25 backdrop-blur-md">
            <div className="glass-strong w-full max-w-md rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                            <Boxes className="w-4 h-4 text-foreground" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold truncate">Konfigurasi Produk</p>
                            <p className="text-xs text-muted-foreground truncate">{product.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-3">
                    {isLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                            <Loader2 className="w-4 h-4 animate-spin" /> Memuat opsi…
                        </div>
                    ) : (
                        options.map((opt) => (
                            <div key={opt.key} className="space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">{opt.label}</label>
                                {opt.type === 'select' ? (
                                    <select className={inputClass} value={selected[opt.key] ?? ''} onChange={(e) => setOpt(opt.key, e.target.value)}>
                                        <option value="" disabled>Pilih {opt.label}…</option>
                                        {(opt.choices ?? []).map((c: any) => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                ) : opt.type === 'number' ? (
                                    <input
                                        type="number"
                                        min={opt.min ?? 1}
                                        className={inputClass}
                                        placeholder={opt.label}
                                        value={selected[opt.key] ?? ''}
                                        onChange={(e) => setOpt(opt.key, e.target.value === '' ? '' : Number(e.target.value))}
                                    />
                                ) : (
                                    <select className={inputClass} value={selected[opt.key] ?? ''} onChange={(e) => setOpt(opt.key, Number(e.target.value))}>
                                        <option value="" disabled>Pilih {opt.label}…</option>
                                        {(opt.choices ?? []).map((c: any) => (
                                            <option key={c.variantId} value={c.variantId}>
                                                {c.label} — Rp{Number(c.price).toLocaleString('id-ID')}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        ))
                    )}

                    {/* Catatan */}
                    {!isLoading && (
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-muted-foreground">Catatan (opsional)</label>
                            <textarea
                                rows={2}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm resize-none"
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="mis. nama file desain, deadline…"
                            />
                        </div>
                    )}

                    {/* Preview harga */}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    {computing && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menghitung harga…
                        </div>
                    )}
                    {quote && !computing && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2">
                            <p className="text-sm font-semibold">{quote.name}</p>
                            <ul className="space-y-1">
                                {quote.breakdown.map((b, i) => (
                                    <li key={i} className="flex justify-between text-xs text-muted-foreground">
                                        <span className="truncate pr-2">{b.name} × {b.qty}</span>
                                        <span className="font-mono shrink-0">Rp{Number(b.lineTotal).toLocaleString('id-ID')}</span>
                                    </li>
                                ))}
                            </ul>
                            <div className="flex justify-between items-baseline pt-1 border-t border-border/60">
                                <span className="text-xs font-medium">Total</span>
                                <span className="text-base font-bold">Rp{Number(quote.price).toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex gap-2 px-5 py-4 border-t border-border/60">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl border border-border bg-muted/50 font-medium text-sm hover:bg-muted transition-colors"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        disabled={!quote || computing}
                        onClick={() => {
                            if (!quote) return;
                            onAdd({
                                productId: product.id,
                                name: quote.name,
                                price: quote.price,
                                compositeOptions: selected,
                                breakdown: quote.breakdown,
                                note: note.trim() || undefined,
                            });
                            onClose();
                        }}
                        className="flex-[2] py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors disabled:opacity-40"
                    >
                        Tambah ke Keranjang
                    </button>
                </div>
            </div>
        </div>
    );
}
