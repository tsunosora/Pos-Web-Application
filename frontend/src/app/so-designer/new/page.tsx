"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2, Upload, Loader2, Save, Search, X, Send, UserPlus, Users, FileText, AlertTriangle } from "lucide-react";
import { useDesignerSession } from "../useDesignerSession";
import { designerCreateSO, designerUpdateSO, designerGetSO, designerUploadProofs, designerDeleteProof, designerSendWA, designerCreateLeadFromSO, getPublicCustomers, designerLookupLeadsByPhone, designerListActiveCsLeads, type ActiveLeadPreview } from "@/lib/api/designers";
import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

/** URL gambar proof dari path tersimpan (strip prefix `public/`). */
function proofUrl(filename: string) {
    const rel = filename.replace(/^public[\\/]/i, "/").replace(/\\/g, "/");
    return `${API_BASE}${rel.startsWith("/") ? rel : "/" + rel}`;
}

interface CustomerHint { id: number; name: string; phone: string | null; address: string | null; }

interface DraftItem {
    key: string;
    productVariantId: number;
    productLabel: string;
    pricingMode: "UNIT" | "AREA_BASED";
    quantity: number;
    widthCm?: number;
    heightCm?: number;
    unitType?: string;
    pcs?: number;
    customPrice?: number | null;
    note?: string;
}

interface FlatVariant {
    productVariantId: number;
    label: string;
    pricingMode: "UNIT" | "AREA_BASED";
    sku: string;
    outOfStock: boolean; // produk lacak-stok & stok agregat habis (≤ 0)
}

function DesignerNewSOContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const editId = searchParams.get('id');
    const isEdit = !!editId;
    const session = useDesignerSession();

    const [customerName, setCustomerName] = useState("");
    const [customerPhone, setCustomerPhone] = useState("");
    const [customerAddress, setCustomerAddress] = useState("");
    const [customerSearch, setCustomerSearch] = useState("");
    const [customers, setCustomers] = useState<CustomerHint[]>([]);
    const [notes, setNotes] = useState("");
    const [deadline, setDeadline] = useState("");
    const [items, setItems] = useState<DraftItem[]>([]);
    const [proofFiles, setProofFiles] = useState<File[]>([]);
    const [existingProofs, setExistingProofs] = useState<{ id: number; filename: string }[]>([]); // proof yang sudah tersimpan (mode edit)
    const [deletingProof, setDeletingProof] = useState<number | null>(null);
    const [variantSearch, setVariantSearch] = useState("");
    const [products, setProducts] = useState<any[]>([]);
    const [productsLoaded, setProductsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [sending, setSending] = useState(false);
    const [leading, setLeading] = useState(false); // busy state tombol "Lead Order"
    const [activeLeads, setActiveLeads] = useState<ActiveLeadPreview[]>([]); // lead aktif dgn HP sama
    const [leadsChecking, setLeadsChecking] = useState(false);
    const [leadChoiceOpen, setLeadChoiceOpen] = useState(false); // modal pilih: tempel vs lead baru
    const [csLeads, setCsLeads] = useState<ActiveLeadPreview[]>([]); // antrian lead CS utk kartu pilihan
    const [csLeadsLoading, setCsLeadsLoading] = useState(true);
    const [pickedLead, setPickedLead] = useState<ActiveLeadPreview | null>(null); // lead CS yg dipilih dari kartu
    const [csPickerOpen, setCsPickerOpen] = useState(false); // modal daftar lead CS

    // Load customers sekali saat komponen mount
    useMemo(() => {
        getPublicCustomers().then(setCustomers).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const filteredCustomers = useMemo(() => {
        const q = customerSearch.trim().toLowerCase();
        if (!q) return [];
        return customers.filter(c =>
            c.name.toLowerCase().includes(q) || (c.phone || "").includes(q)
        ).slice(0, 6);
    }, [customers, customerSearch]);

    function pickCustomer(c: CustomerHint) {
        setCustomerName(c.name);
        setCustomerPhone(c.phone ?? "");
        setCustomerAddress(c.address ?? "");
        setCustomerSearch("");
        setPickedLead(null); // ini customer terdaftar, bukan lead CS
    }

    // Klik kartu lead CS → isi data customer & tandai SO ini menempel ke lead itu
    function pickLead(l: ActiveLeadPreview) {
        setCustomerName(l.name || "");
        setCustomerPhone(l.phone || "");
        setPickedLead(l);
        setError(null);
    }

    // Muat antrian lead CS (mode buat baru saja)
    useEffect(() => {
        if (!session || isEdit) { setCsLeadsLoading(false); return; }
        setCsLeadsLoading(true);
        designerListActiveCsLeads(session.id, session.pin)
            .then(setCsLeads)
            .catch(() => setCsLeads([]))
            .finally(() => setCsLeadsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session?.id, isEdit]);

    // Lazy-load produk saat pertama kali user klik search
    async function ensureProducts() {
        if (productsLoaded) return;
        const res = await axios.get(`${API_BASE}/products/public`);
        setProducts(res.data ?? []);
        setProductsLoaded(true);
    }

    const flatVariants: FlatVariant[] = useMemo(() => {
        const out: FlatVariant[] = [];
        for (const p of products) {
            const mode: "UNIT" | "AREA_BASED" = p.pricingMode ?? "UNIT";
            for (const v of p.variants ?? []) {
                const suffix = v.variantName ? ` — ${v.variantName}` : "";
                out.push({
                    productVariantId: v.id,
                    label: `${p.name}${suffix}`,
                    pricingMode: mode,
                    sku: v.sku ?? "",
                    // Unlimited (trackStock=false) tak pernah habis; sisanya cek stok agregat.
                    outOfStock: p.trackStock !== false && Number(v.stock ?? 0) <= 0,
                });
            }
        }
        return out;
    }, [products]);

    const filteredVariants = useMemo(() => {
        const q = variantSearch.trim().toLowerCase();
        if (!q) return flatVariants.slice(0, 30);
        return flatVariants.filter(v => v.label.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)).slice(0, 30);
    }, [flatVariants, variantSearch]);

    function addVariant(v: FlatVariant) {
        if (v.outOfStock) {
            setError(`Stok "${v.label}" habis — tidak bisa ditambahkan ke order.`);
            return;
        }
        setError(null);
        setItems(prev => [...prev, {
            key: `${v.productVariantId}-${Date.now()}`,
            productVariantId: v.productVariantId,
            productLabel: v.label,
            pricingMode: v.pricingMode,
            quantity: 1,
            unitType: v.pricingMode === "AREA_BASED" ? "cm" : undefined,
            pcs: v.pricingMode === "AREA_BASED" ? 1 : undefined,
        }]);
        setVariantSearch("");
    }

    function updateItem(key: string, patch: Partial<DraftItem>) {
        setItems(prev => prev.map(it => it.key === key ? { ...it, ...patch } : it));
    }

    function addImageFiles(files: File[] | FileList | null) {
        if (!files) return;
        const arr = Array.from(files).filter(f => f.type.startsWith("image/"));
        if (arr.length === 0) return;
        const normalized = arr.map((f, i) => {
            if (f.name && f.name !== 'image.png' && /\.[a-z0-9]+$/i.test(f.name)) return f;
            const extMap: Record<string, string> = {
                'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif',
                'image/webp': '.webp', 'image/bmp': '.bmp',
            };
            const ext = extMap[f.type] || '.png';
            return new File([f], `pasted-${Date.now()}-${i}${ext}`, { type: f.type });
        });
        setProofFiles(prev => [...prev, ...normalized].slice(0, 10));
    }

    function handleProofInput(e: React.ChangeEvent<HTMLInputElement>) {
        addImageFiles(e.target.files);
        e.target.value = "";
    }

    // Hapus proof yang sudah tersimpan (mode edit) — eksplisit, hanya saat user klik
    async function removeExistingProof(proofId: number) {
        if (!session || !editId) return;
        if (!confirm("Hapus gambar ini dari SO?")) return;
        setDeletingProof(proofId);
        try {
            await designerDeleteProof(Number(editId), proofId, session.id, session.pin);
            setExistingProofs(p => p.filter(x => x.id !== proofId));
        } catch (e: any) {
            setError(e?.response?.data?.message || "Gagal hapus gambar");
        } finally {
            setDeletingProof(null);
        }
    }

    // Paste handler global — Ctrl+V untuk paste screenshot dari clipboard
    useEffect(() => {
        function onPaste(e: ClipboardEvent) {
            const tgt = e.target as HTMLElement | null;
            if (tgt) {
                const tag = tgt.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'textarea' || tgt.isContentEditable) {
                    const items = e.clipboardData?.items;
                    const hasOnlyImage = items && Array.from(items).every(it => it.type.startsWith('image/'));
                    if (!hasOnlyImage) return;
                }
            }
            const items = e.clipboardData?.items;
            if (!items) return;
            const files: File[] = [];
            for (const it of Array.from(items)) {
                if (it.kind === 'file' && it.type.startsWith('image/')) {
                    const f = it.getAsFile();
                    if (f) files.push(f);
                }
            }
            if (files.length > 0) {
                e.preventDefault();
                addImageFiles(files);
            }
        }
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    }, []);

    // Mode edit: muat SO yang ada lalu prefill form
    useEffect(() => {
        if (!isEdit || !editId) return;
        designerGetSO(Number(editId)).then((so: any) => {
            if (!so) return;
            setCustomerName(so.customerName || "");
            setCustomerPhone(so.customerPhone || "");
            setCustomerAddress(so.customerAddress || "");
            setNotes(so.notes || "");
            if (so.deadline) {
                // ISO → input datetime-local (buang detik/zona)
                const d = new Date(so.deadline);
                const pad = (n: number) => String(n).padStart(2, '0');
                setDeadline(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`);
            }
            setExistingProofs((so.proofs || []).map((p: any) => ({ id: p.id, filename: p.filename })));
            setItems((so.items || []).map((it: any, i: number) => {
                const mode: "UNIT" | "AREA_BASED" = it.productVariant?.product?.pricingMode === 'AREA_BASED' ? 'AREA_BASED' : 'UNIT';
                const vn = it.productVariant?.variantName ? ` — ${it.productVariant.variantName}` : '';
                return {
                    key: `${it.productVariantId}-${i}-${Date.now()}`,
                    productVariantId: it.productVariantId,
                    productLabel: `${it.productVariant?.product?.name ?? 'Produk'}${vn}`,
                    pricingMode: mode,
                    quantity: Number(it.quantity) || 1,
                    widthCm: it.widthCm ?? undefined,
                    heightCm: it.heightCm ?? undefined,
                    unitType: it.unitType ?? (mode === 'AREA_BASED' ? 'cm' : undefined),
                    pcs: it.pcs ?? (mode === 'AREA_BASED' ? 1 : undefined),
                    customPrice: it.customPrice ?? null,
                    note: it.note ?? undefined,
                };
            }));
        }).catch(() => setError("Gagal memuat SO untuk diedit"));
    }, [isEdit, editId]);

    // Cek lead aktif untuk nomor HP yang diketik (debounce) — supaya desainer tahu
    // customer ini sudah punya lead aktif (mis. dari CS) sebelum buat SO.
    useEffect(() => {
        if (!session) return;
        const digits = customerPhone.replace(/\D/g, "");
        if (digits.length < 5) { setActiveLeads([]); setLeadsChecking(false); return; }
        setLeadsChecking(true);
        const t = setTimeout(() => {
            designerLookupLeadsByPhone(session.id, session.pin, customerPhone)
                .then(setActiveLeads)
                .catch(() => setActiveLeads([]))
                .finally(() => setLeadsChecking(false));
        }, 450);
        return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerPhone, session?.id]);

    // mode 'save'  = simpan draft saja
    // mode 'send'  = "Buat Nota" — simpan lalu kirim ke Discord #produksi (kasir buatkan nota)
    // mode 'lead'  = "Lead Order" — simpan lalu buat Lead CRM tertaut (CS yang follow-up)
    async function handleSave(mode: 'save' | 'send' | 'lead', leadOpts?: { targetLeadId?: number; forceNewLead?: boolean }) {
        if (!session) return;
        setError(null);
        if (!customerName.trim()) { setError("Nama customer wajib diisi"); return; }
        if (items.length === 0) { setError("Tambahkan minimal 1 item"); return; }

        const busy = mode === 'send' ? setSending : mode === 'lead' ? setLeading : setSaving;
        busy(true);
        try {
            const payload = {
                customerName: customerName.trim(),
                customerPhone: customerPhone.trim() || null,
                customerAddress: customerAddress.trim() || null,
                notes: notes.trim() || null,
                deadline: deadline ? new Date(deadline).toISOString() : null,
                items: items.map(it => ({
                    productVariantId: it.productVariantId,
                    quantity: Number(it.quantity) || 1,
                    widthCm: it.widthCm ?? null,
                    heightCm: it.heightCm ?? null,
                    unitType: it.unitType ?? null,
                    pcs: it.pcs ?? null,
                    customPrice: it.customPrice ?? null,
                    note: it.note?.trim() || null,
                })),
            };
            const so = isEdit
                ? await designerUpdateSO(Number(editId), session.id, session.pin, payload)
                : await designerCreateSO(session.id, session.pin, payload);
            if (proofFiles.length > 0) {
                await designerUploadProofs(so.id, session.id, session.pin, proofFiles);
            }
            if (mode === 'send') {
                // Langsung broadcast ke channel Discord #produksi cabang
                await designerSendWA(so.id, session.id, session.pin);
                alert(`SO ${so.soNumber || ''} ${isEdit ? 'diperbarui' : 'dibuat'} & dikirim — kasir tinggal buatkan nota.`);
            } else if (mode === 'lead') {
                // Buat Lead CRM tertaut — CS follow-up, nota dibuat dari SO nanti
                const res = await designerCreateLeadFromSO(so.id, session.id, session.pin, leadOpts);
                alert(
                    res.merged
                        ? `SO ${so.soNumber || ''} ditempelkan ke lead "${res.lead?.name || ''}" yang sudah ada (satu pintu) — CS lanjut follow-up; nota dari SO ini setelah deal.`
                        : res.revised
                            ? `SO ${so.soNumber || ''} direvisi — data & gambar lead di CRM ikut diperbarui, dan notif revisi terkirim ke Discord (CS + Produksi).`
                            : res.existing
                                ? `SO ${so.soNumber || ''} disimpan. Lead untuk SO ini sudah selesai (closing/lost) — data lead tidak diubah.`
                                : `SO ${so.soNumber || ''} disimpan & masuk ke CS sebagai Lead Order baru — gambar desain tersimpan di lead & terkirim ke Discord (CS + Produksi). CS akan follow-up; nota dibuat dari SO ini nanti.`);
            } else {
                alert(`SO ${so.soNumber || ''} ${isEdit ? 'diperbarui' : 'disimpan sebagai draft'}.`);
            }
            // Kembali ke dashboard (halaman awal); SO baru muncul paling atas
            router.push('/so-designer/dashboard');
        } catch (e: any) {
            setError(e?.response?.data?.message || e?.message || "Gagal menyimpan SO");
        } finally {
            busy(false);
        }
    }

    if (!session) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-3 flex items-center gap-3 shadow-lg shadow-indigo-500/20 sticky top-0 z-10">
                <Link href="/so-designer/dashboard" className="p-1.5 hover:bg-white/15 rounded-lg transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="min-w-0">
                    <div className="font-semibold leading-tight truncate">{isEdit ? 'Edit Sales Order' : 'Buat Sales Order Baru'}</div>
                    <div className="text-xs text-indigo-100 truncate">
                        {session.name}
                        {session.branchName && <> · <span className="text-yellow-300 font-semibold">{session.branchName}</span></>}
                    </div>
                </div>
            </div>

            <div className="max-w-2xl mx-auto p-4 space-y-4 pb-24">
                {error && <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 rounded-lg px-3 py-2 text-sm">{error}</div>}

                {/* Tombol ringkas → buka daftar lead CS (modal), form tetap di atas & bersih */}
                {!isEdit && (csLeadsLoading || csLeads.length > 0) && (
                    <button
                        type="button"
                        onClick={() => setCsPickerOpen(true)}
                        className="w-full flex items-center justify-between gap-2 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 px-4 py-3 transition-colors"
                    >
                        <span className="flex items-center gap-2 text-sm font-semibold text-indigo-700 dark:text-indigo-300">
                            <Users className="h-4 w-4" />
                            Ambil data dari Lead CS
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400">
                            {csLeadsLoading
                                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                : <span className="font-semibold bg-indigo-600 text-white rounded-full px-2 py-0.5">{csLeads.length}</span>}
                            <span className="hidden sm:inline">pilih</span>
                        </span>
                    </button>
                )}

                {/* Customer */}
                <Card title="Customer">
                    <div className="space-y-3">
                        {/* Search customer terdaftar */}
                        <Field label="Cari customer terdaftar (opsional)">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                <input
                                    value={customerSearch}
                                    onChange={e => setCustomerSearch(e.target.value)}
                                    placeholder="Ketik nama atau HP untuk cari..."
                                    className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors"
                                />
                                {filteredCustomers.length > 0 && (
                                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                        {filteredCustomers.map(c => (
                                            <button
                                                key={c.id}
                                                type="button"
                                                onMouseDown={e => e.preventDefault()}
                                                onClick={() => pickCustomer(c)}
                                                className="w-full text-left px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 text-slate-700 dark:text-slate-200"
                                            >
                                                <div className="font-medium">{c.name}</div>
                                                {c.phone && <div className="text-xs text-slate-400 dark:text-slate-500">{c.phone}</div>}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </Field>

                        <Field label="Nama Customer *">
                            <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" placeholder="Nama pelanggan" />
                        </Field>
                        <Field label="No. HP / WA">
                            <input value={customerPhone} onChange={e => { setCustomerPhone(e.target.value); setPickedLead(null); }}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" placeholder="08xx..." />
                            {leadsChecking && !pickedLead && (
                                <div className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Mengecek lead aktif untuk nomor ini…
                                </div>
                            )}
                        </Field>

                        {/* Terhubung ke lead CS (dipilih dari kartu) */}
                        {pickedLead && (
                            <div className="flex items-start gap-2 rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                                <UserPlus className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                                <div className="text-xs text-emerald-800 dark:text-emerald-200 flex-1">
                                    Terhubung ke lead CS <span className="font-semibold">{pickedLead.name}</span>
                                    {(pickedLead.assignedToName || pickedLead.createdByName) && ` (CS ${pickedLead.assignedToName || pickedLead.createdByName})`}.
                                    Saat tekan <span className="font-semibold">"Lead Order"</span>, SO ini otomatis ditempel ke lead tsb.
                                </div>
                                <button type="button" onClick={() => setPickedLead(null)}
                                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200 shrink-0">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        )}

                        {/* Banner peringatan lead aktif (kalau belum pilih dari kartu) */}
                        {activeLeads.length > 0 && !pickedLead && <ActiveLeadsPreview leads={activeLeads} />}

                        <Field label="Alamat">
                            <textarea value={customerAddress} onChange={e => setCustomerAddress(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" rows={2} placeholder="Opsional" />
                        </Field>
                    </div>
                </Card>

                {/* Order info */}
                <Card title="Detail Order">
                    <div className="space-y-3">
                        <Field label="Deadline">
                            <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" />
                        </Field>
                        <Field label="Catatan / Instruksi Cetak">
                            <textarea value={notes} onChange={e => setNotes(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" rows={3}
                                placeholder="Contoh: cetak double side, laminasi doff, art carton..." />
                        </Field>
                    </div>
                </Card>

                {/* Items */}
                <Card title={`Item (${items.length})`}>
                    <div className="relative mb-3">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input
                            value={variantSearch}
                            onChange={e => { setVariantSearch(e.target.value); ensureProducts(); }}
                            onFocus={ensureProducts}
                            placeholder="Cari produk untuk ditambahkan..."
                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors"
                        />
                        {variantSearch && filteredVariants.length > 0 && (
                            <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                                {filteredVariants.map(v => (
                                    <button key={v.productVariantId} type="button"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => addVariant(v)}
                                        disabled={v.outOfStock}
                                        className={`w-full text-left px-3 py-2 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 ${v.outOfStock ? "opacity-60 cursor-not-allowed text-slate-400 dark:text-slate-600" : "hover:bg-indigo-50 dark:hover:bg-indigo-950/30 text-slate-700 dark:text-slate-200"}`}
                                    >
                                        <div className="font-medium flex items-center gap-2">
                                            <span>{v.label}</span>
                                            {v.outOfStock && (
                                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">Stok habis</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-400 dark:text-slate-500">{v.sku} • {v.pricingMode === "AREA_BASED" ? "per m²" : "per unit"}</div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {items.length === 0 ? (
                        <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-lg">
                            Cari produk di atas untuk menambahkan item
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {items.map((it, idx) => (
                                <div key={it.key} className="border border-slate-200 dark:border-slate-700 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/50">
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500">Item {idx + 1}</div>
                                            <div className="font-medium text-sm text-slate-800 dark:text-slate-200">{it.productLabel}</div>
                                        </div>
                                        <button onClick={() => setItems(p => p.filter(i => i.key !== it.key))}
                                            className="p-1 hover:bg-red-100 dark:hover:bg-red-950/40 rounded text-red-500 dark:text-red-400">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 mt-2">
                                        {it.pricingMode !== "AREA_BASED" && (
                                            <Field label="Qty">
                                                <input type="number" min={1} value={it.quantity}
                                                    onChange={e => updateItem(it.key, { quantity: Number(e.target.value) })}
                                                    className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                            </Field>
                                        )}
                                        {it.pricingMode === "AREA_BASED" && (
                                            <>
                                                <Field label="Satuan">
                                                    <select value={it.unitType ?? "cm"}
                                                        onChange={e => updateItem(it.key, { unitType: e.target.value })}
                                                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                                                        <option value="cm">cm</option>
                                                        <option value="m">meter</option>
                                                        <option value="menit">menit</option>
                                                    </select>
                                                </Field>
                                                <Field label={`Lebar (${it.unitType ?? "cm"})`}>
                                                    <input type="number" min={0} step="any" value={it.widthCm ?? ""}
                                                        onChange={e => updateItem(it.key, { widthCm: Number(e.target.value) })}
                                                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                                </Field>
                                                {it.unitType !== "menit" && (
                                                    <Field label={`Tinggi (${it.unitType ?? "cm"})`}>
                                                        <input type="number" min={0} step="any" value={it.heightCm ?? ""}
                                                            onChange={e => updateItem(it.key, { heightCm: Number(e.target.value) })}
                                                            className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                                    </Field>
                                                )}
                                                <Field label="Pcs">
                                                    <input type="number" min={1} value={it.pcs ?? 1}
                                                        onChange={e => updateItem(it.key, { pcs: Number(e.target.value) })}
                                                        className="w-full px-2 py-1 text-sm border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                                </Field>
                                            </>
                                        )}
                                    </div>
                                    <div className="mt-2">
                                        <input value={it.note ?? ""} onChange={e => updateItem(it.key, { note: e.target.value })}
                                            placeholder="Catatan item (finishing, file desain, dll)"
                                            className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Proof */}
                <Card title={`Screenshot Proof Final (${existingProofs.length + proofFiles.length}/10)`}>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Upload screenshot ACC dari customer (WA pribadi). Akan dikirim ke Discord internal saat broadcast.</p>
                    {existingProofs.length > 0 && (
                        <div className="mb-3">
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Gambar tersimpan</p>
                            <div className="grid grid-cols-3 gap-2">
                                {existingProofs.map(p => (
                                    <div key={p.id} className="relative group">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={proofUrl(p.filename)} alt="proof" className="w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                        <button onClick={() => removeExistingProof(p.id)} disabled={deletingProof === p.id}
                                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100">
                                            {deletingProof === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <div
                        onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
                        onDrop={e => { e.preventDefault(); addImageFiles(e.dataTransfer.files); }}
                        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-4 text-center hover:bg-indigo-50/40 dark:hover:bg-indigo-950/20 transition-colors"
                    >
                        <label className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg cursor-pointer text-sm font-medium transition-colors">
                            <Upload className="h-4 w-4" /> Pilih Gambar
                            <input type="file" multiple accept="image/*" onChange={handleProofInput} className="hidden" />
                        </label>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                            atau <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded font-mono text-[10px]">Ctrl + V</kbd> untuk paste screenshot,
                            atau drag & drop file ke sini
                        </p>
                    </div>
                    {proofFiles.length > 0 && (
                        <div className="grid grid-cols-3 gap-2 mt-3">
                            {proofFiles.map((f, i) => (
                                <div key={i} className="relative group">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={URL.createObjectURL(f)} alt={f.name} className="w-full h-24 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
                                    <button onClick={() => setProofFiles(p => p.filter((_, j) => j !== i))}
                                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <X className="h-3 w-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Sticky footer */}
            <div className="fixed bottom-0 inset-x-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 p-4 shadow-lg">
                <div className="max-w-2xl mx-auto space-y-2">
                    <div className="flex gap-2">
                        <Link href="/so-designer/dashboard" className="text-center py-2 px-4 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors">
                            Batal
                        </Link>
                        <button onClick={() => handleSave('save')} disabled={saving || sending || leading}
                            className="flex-1 inline-flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Simpan Draft
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => {
                                if (pickedLead) handleSave('lead', { targetLeadId: pickedLead.id });
                                else if (activeLeads.length > 0) setLeadChoiceOpen(true);
                                else handleSave('lead');
                            }} disabled={saving || sending || leading}
                            title="Order belum pasti / perlu nego — masuk ke CS sebagai lead, nota dibuat dari SO ini nanti"
                            className="flex-1 inline-flex items-center justify-center gap-2 border border-amber-400 dark:border-amber-700 text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition">
                            {leading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                            Lead Order (CS)
                        </button>
                        <button onClick={() => handleSave('send')} disabled={saving || sending || leading}
                            title="Order sudah pasti — kirim ke kasir untuk dibuatkan nota"
                            className="flex-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white py-2.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition">
                            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            Buat Nota (Kirim)
                        </button>
                    </div>
                </div>
            </div>

            {/* Modal daftar lead CS — bottom-sheet, dicari & di-scroll di dalam */}
            {csPickerOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
                    onClick={() => setCsPickerOpen(false)}
                >
                    <div
                        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[80vh] flex flex-col animate-in fade-in slide-in-from-bottom-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <CsLeadPicker
                            leads={csLeads}
                            loading={csLeadsLoading}
                            pickedId={pickedLead?.id ?? null}
                            onPick={l => { pickLead(l); setCsPickerOpen(false); }}
                            onClose={() => setCsPickerOpen(false)}
                        />
                    </div>
                </div>
            )}

            {/* Modal pilihan saat customer sudah punya lead aktif (repeat order) */}
            {leadChoiceOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4"
                    onClick={() => setLeadChoiceOpen(false)}
                >
                    <div
                        className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 p-4 animate-in fade-in zoom-in-95"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 mb-1">
                            <Users className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            <h3 className="font-semibold text-slate-800 dark:text-slate-100">Customer sudah punya lead aktif</h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                            Ini lanjutan dari order yang sudah ada, atau order baru yang berbeda (repeat order)?
                        </p>

                        <div className="space-y-2">
                            {/* Lead yang bisa ditempeli (belum punya SO) */}
                            {activeLeads.filter(l => !l.hasSO).map(l => {
                                const handler = l.assignedToName || l.createdByName;
                                return (
                                    <button
                                        key={l.id}
                                        onClick={() => { setLeadChoiceOpen(false); handleSave('lead', { targetLeadId: l.id }); }}
                                        className="w-full text-left rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 px-3 py-2.5 transition-colors"
                                    >
                                        <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                                            Tempel ke lead: {l.name}
                                        </div>
                                        <div className="text-[11px] text-emerald-700/80 dark:text-emerald-300/70 mt-0.5">
                                            {STATUS_LABEL[l.status] || l.status}
                                            {handler && ` · ${l.origin === "DESIGNER" ? "Desainer" : "CS"} ${handler}`}
                                            {l.needs && ` · ${l.needs.slice(0, 40)}`}
                                        </div>
                                    </button>
                                );
                            })}

                            {/* Lead yang sudah punya SO sendiri — info, tak bisa ditempel */}
                            {activeLeads.some(l => l.hasSO) && (
                                <p className="text-[11px] text-slate-400 dark:text-slate-500 px-1">
                                    Ada lead yang sudah punya SO sendiri — tidak bisa ditempeli. Pilih "buat lead baru" bila ini order berbeda.
                                </p>
                            )}

                            {/* Selalu: buat lead baru terpisah */}
                            <button
                                onClick={() => { setLeadChoiceOpen(false); handleSave('lead', { forceNewLead: true }); }}
                                className="w-full text-left rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50 px-3 py-2.5 transition-colors"
                            >
                                <div className="text-sm font-medium text-indigo-800 dark:text-indigo-200">Buat lead baru terpisah</div>
                                <div className="text-[11px] text-indigo-700/80 dark:text-indigo-300/70 mt-0.5">
                                    Repeat order / kebutuhan berbeda dari lead di atas
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => setLeadChoiceOpen(false)}
                            className="mt-3 w-full text-center text-sm text-slate-500 dark:text-slate-400 py-2 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                        >
                            Batal
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function DesignerNewSOPage() {
    return (
        <Suspense fallback={null}>
            <DesignerNewSOContent />
        </Suspense>
    );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">{title}</h3>
            {children}
        </div>
    );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block mb-1">{label}</label>
            {children}
        </div>
    );
}

const STATUS_LABEL: Record<string, string> = {
    NEW: "Baru", FOLLOW_UP: "Follow-up", NEGOTIATION: "Negosiasi",
    CLOSED_WON: "Closing", CLOSED_LOST: "Lost", INVALID: "Tidak valid",
};
const STATUS_CLASS: Record<string, string> = {
    NEW: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
    FOLLOW_UP: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
    NEGOTIATION: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
};

function rupiah(n: number) {
    return "Rp" + n.toLocaleString("id-ID");
}

/**
 * Banner peringatan: nomor HP ini sudah punya lead aktif. Membantu desainer
 * membedakan "ini lanjutan lead CS yang sudah ada" (satu pintu — Lead Order akan
 * menempel ke lead itu) vs "order baru yang berbeda".
 */
function ActiveLeadsPreview({ leads }: { leads: ActiveLeadPreview[] }) {
    return (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3">
            <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <div className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    Nomor ini sudah punya {leads.length} lead aktif
                </div>
            </div>

            <div className="space-y-2">
                {leads.map(l => {
                    const handler = l.assignedToName || l.createdByName;
                    const isDesigner = l.origin === "DESIGNER";
                    return (
                        <div key={l.id} className="rounded-lg bg-white dark:bg-slate-900 border border-amber-200/70 dark:border-amber-900/60 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{l.name}</div>
                                <div className="flex items-center gap-1.5">
                                    {/* asal lead: CS vs Desainer */}
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                                        isDesigner
                                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300"
                                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                    }`}>
                                        <Users className="h-2.5 w-2.5" /> {isDesigner ? "Dibuat Desainer" : "Dibuat CS"}
                                    </span>
                                    {/* status lead */}
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_CLASS[l.status] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                                        {STATUS_LABEL[l.status] || l.status}
                                    </span>
                                </div>
                            </div>

                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                {handler && <span>CS: <span className="font-medium text-slate-700 dark:text-slate-300">{handler}</span></span>}
                                {l.designerName && <span>Desainer: <span className="font-medium text-slate-700 dark:text-slate-300">{l.designerName}</span></span>}
                                {l.sourceDetail && <span>Sumber: {l.sourceDetail}</span>}
                                {l.estimatedValue != null && l.estimatedValue > 0 && <span>Est: <span className="font-medium text-slate-700 dark:text-slate-300">{rupiah(l.estimatedValue)}</span></span>}
                                {l.hasSO && (
                                    <span className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400">
                                        <FileText className="h-3 w-3" /> Sudah ada SO{l.soNumber ? ` ${l.soNumber}` : ""}
                                    </span>
                                )}
                            </div>

                            {l.needs && (
                                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                    Kebutuhan: {l.needs}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <p className="mt-2 text-[11px] leading-relaxed text-amber-700/90 dark:text-amber-300/80">
                <span className="font-semibold">Satu pintu:</span> kalau ini lanjutan order customer yang sama, tekan
                <span className="font-semibold"> "Lead Order (CS)"</span> — SO ini otomatis menempel ke lead di atas
                (tanpa lead dobel). Kalau ini order yang benar-benar berbeda, lanjutkan saja; koordinasikan dengan CS bila perlu.
            </p>
        </div>
    );
}

/**
 * Isi modal daftar lead CS aktif (belum punya SO). Header + search menetap di
 * atas; daftar di-scroll di dalam modal supaya form di halaman tetap bersih.
 * Klik salah satu → isi data customer & SO menempel ke lead itu saat "Lead Order".
 */
function CsLeadPicker({
    leads, loading, pickedId, onPick, onClose,
}: {
    leads: ActiveLeadPreview[];
    loading: boolean;
    pickedId: number | null;
    onPick: (l: ActiveLeadPreview) => void;
    onClose: () => void;
}) {
    const [q, setQ] = useState("");
    const filtered = useMemo(() => {
        const s = q.trim().toLowerCase();
        if (!s) return leads;
        return leads.filter(l => (l.name || "").toLowerCase().includes(s) || (l.phone || "").includes(s));
    }, [leads, q]);

    return (
        <>
            {/* Header tetap */}
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <h3 className="font-semibold text-slate-800 dark:text-slate-100">Lead dari CS ({leads.length})</h3>
                </div>
                <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400">
                    <X className="h-5 w-5" />
                </button>
            </div>

            {/* Search tetap */}
            {leads.length > 3 && (
                <div className="px-4 pt-3 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Cari nama / HP lead…" autoFocus
                            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 transition-colors" />
                    </div>
                </div>
            )}

            {/* Daftar — area scroll */}
            {loading ? (
                <div className="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 py-8 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin" /> Memuat lead CS…
                </div>
            ) : leads.length === 0 ? (
                <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-8 px-4">
                    Belum ada lead aktif dari CS. Tutup lalu isi data customer manual.
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">Tidak ada lead cocok.</div>
            ) : (
                <div className="space-y-2 overflow-y-auto flex-1 p-4 pt-3">
                    {filtered.map(l => {
                        const handler = l.assignedToName || l.createdByName;
                        const active = pickedId === l.id;
                        return (
                            <button
                                key={l.id}
                                type="button"
                                onClick={() => onPick(l)}
                                className={`w-full text-left rounded-xl border px-3 py-2.5 transition-colors ${
                                    active
                                        ? "border-emerald-400 dark:border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-400/50"
                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:bg-indigo-50/60 dark:hover:bg-indigo-950/30"
                                }`}
                            >
                                <div className="flex items-center justify-between gap-2">
                                    <div className="font-medium text-sm text-slate-800 dark:text-slate-100 truncate">{l.name}</div>
                                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_CLASS[l.status] || "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>
                                        {STATUS_LABEL[l.status] || l.status}
                                    </span>
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                                    {l.phone && <span>{l.phone}</span>}
                                    {handler && <span>CS: {handler}</span>}
                                    {l.branchName && <span>{l.branchName}</span>}
                                    {l.estimatedValue != null && l.estimatedValue > 0 && <span>Est: {rupiah(l.estimatedValue)}</span>}
                                </div>
                                {l.needs && (
                                    <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">{l.needs}</div>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </>
    );
}
