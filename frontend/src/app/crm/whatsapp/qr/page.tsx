"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { ArrowLeft, QrCode, Copy, Trash2, ExternalLink, Plus, FileImage, FileCode } from "lucide-react";
import {
    listWaQrLinks, createWaQrLink, updateWaQrLink, deleteWaQrLink, listWaChannels,
    buildWaMeLink, type WaQrLink, type WaChannel,
} from "@/lib/api/whatsapp-cloud";
import { LEAD_SOURCE_LABEL, type LeadSource } from "@/lib/api/crm";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";

// Sumber lead yang lazim dipakai untuk QR offline/kanal fisik.
const SOURCE_OPTIONS: LeadSource[] = ["WALK_IN", "REFERRAL", "INSTAGRAM", "TIKTOK", "FACEBOOK", "WEBSITE", "MARKETPLACE", "OTHER", "CUSTOM"];

const DEFAULT_PREFILL = "Halo, saya mau tanya-tanya produk 🙏";

function errMsg(e: unknown): string {
    return (e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Terjadi kesalahan";
}

// imageSettings qrcode.react — sisipkan logo toko di tengah (excavate = kosongkan modul di baliknya).
function logoSettings(dataUrl: string | undefined, size: number) {
    return dataUrl ? { src: dataUrl, height: size, width: size, excavate: true } : undefined;
}

export default function WhatsappQrPage() {
    const qc = useQueryClient();
    const { data: links = [], isLoading } = useQuery({ queryKey: ["wa-qr-links"], queryFn: listWaQrLinks });
    const { data: channels = [] } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });

    const activeChannels = useMemo(() => channels.filter((c) => c.isActive), [channels]);

    // Logo toko sebagai data URL (dari proxy same-origin /api/logo → aman utk canvas & portabel di SVG).
    const [logoDataUrl, setLogoDataUrl] = useState<string | undefined>(undefined);
    useEffect(() => {
        let cancelled = false;
        fetch("/api/logo")
            .then((r) => (r.ok ? r.blob() : null))
            .then((blob) => {
                if (!blob || cancelled) return;
                const fr = new FileReader();
                fr.onload = () => { if (!cancelled) setLogoDataUrl(fr.result as string); };
                fr.readAsDataURL(blob);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const [name, setName] = useState("");
    const [source, setSource] = useState<LeadSource>("WALK_IN");
    const [sourceDetail, setSourceDetail] = useState("");
    const [channelId, setChannelId] = useState<number | "">("");
    const [prefill, setPrefill] = useState(DEFAULT_PREFILL);

    // Ekspor on-demand: render 1 QR resolusi tinggi tersembunyi lalu unduh.
    const [exporting, setExporting] = useState<{ link: WaQrLink; url: string; format: "png" | "svg" } | null>(null);
    useEffect(() => {
        if (!exporting) return;
        const t = setTimeout(() => {
            const host = document.getElementById("qr-export-host");
            try {
                if (exporting.format === "png") {
                    const canvas = host?.querySelector("canvas");
                    if (canvas) triggerDownload(canvas.toDataURL("image/png"), `qr-wa-${exporting.link.code}.png`);
                } else {
                    const svg = host?.querySelector("svg");
                    if (svg) {
                        const xml = new XMLSerializer().serializeToString(svg);
                        const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', xml], { type: "image/svg+xml;charset=utf-8" });
                        const objUrl = URL.createObjectURL(blob);
                        triggerDownload(objUrl, `qr-wa-${exporting.link.code}.svg`);
                        setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
                    }
                }
            } finally {
                setExporting(null);
            }
        }, 300); // beri waktu logo (data URL) ter-decode ke canvas/SVG
        return () => clearTimeout(t);
    }, [exporting]);

    const createMut = useMutation({
        mutationFn: () => createWaQrLink({
            name: name.trim(),
            source,
            sourceDetail: sourceDetail.trim() || null,
            channelId: channelId === "" ? null : channelId,
            prefillText: prefill.trim(),
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["wa-qr-links"] });
            setName(""); setSourceDetail(""); setPrefill(DEFAULT_PREFILL);
        },
        onError: (e) => alert(errMsg(e)),
    });

    const delMut = useMutation({
        mutationFn: (id: number) => deleteWaQrLink(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-qr-links"] }),
        onError: (e) => alert(errMsg(e)),
    });

    const toggleMut = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateWaQrLink(id, { isActive }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-qr-links"] }),
        onError: (e) => alert(errMsg(e)),
    });

    const canCreate = name.trim().length > 1 && !createMut.isPending;

    return (
        <div className="max-w-5xl mx-auto p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                <QrCode className="w-5 h-5 text-emerald-500" />
                <h1 className="text-lg font-semibold">QR Klik-untuk-Chat</h1>
                <WhatsappGuideButton />
            </div>
            <p className="text-sm opacity-60">
                Buat <b>QR WhatsApp</b> untuk brosur, banner, atau meja kasir. Saat pelanggan scan, WhatsApp mereka
                terbuka dengan pesan siap-kirim. Tiap QR menanam kode tersembunyi (<code>#kode</code>) sehingga
                lead yang masuk otomatis ditandai sumbernya (mis. <b>Walk-in</b>) di CRM &amp; leaderboard.
                Unduh sebagai <b>SVG</b> (vektor, tak pecah dicetak sebesar apa pun) atau <b>PNG HD</b>.
            </p>

            <div className="grid md:grid-cols-[340px_1fr] gap-4 items-start">
                {/* Form buat QR baru */}
                <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                    <div className="font-medium flex items-center gap-2"><Plus className="w-4 h-4" /> QR Baru</div>

                    <label className="block text-sm space-y-1">
                        <span className="opacity-70">Nama QR</span>
                        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="mis. Leads Walk-in Toko A"
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                    </label>

                    <label className="block text-sm space-y-1">
                        <span className="opacity-70">Sumber lead</span>
                        <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                            {SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{LEAD_SOURCE_LABEL[s]}</option>)}
                        </select>
                    </label>

                    <label className="block text-sm space-y-1">
                        <span className="opacity-70">Detail sumber <span className="opacity-50">(opsional)</span></span>
                        <input value={sourceDetail} onChange={(e) => setSourceDetail(e.target.value)} placeholder="mis. Banner depan toko"
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm" />
                    </label>

                    <label className="block text-sm space-y-1">
                        <span className="opacity-70">Nomor tujuan</span>
                        <select value={channelId} onChange={(e) => setChannelId(e.target.value === "" ? "" : Number(e.target.value))}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
                            <option value="">Pilih channel…</option>
                            {activeChannels.map((c: WaChannel) => (
                                <option key={c.id} value={c.id}>{c.label}{c.displayNumber ? ` (${c.displayNumber})` : ""}</option>
                            ))}
                        </select>
                        {activeChannels.length === 0 && (
                            <span className="text-xs text-amber-500">Belum ada channel aktif. Tambah di Pengaturan Channel dulu.</span>
                        )}
                    </label>

                    <label className="block text-sm space-y-1">
                        <span className="opacity-70">Pesan otomatis</span>
                        <textarea value={prefill} onChange={(e) => setPrefill(e.target.value)} rows={3}
                            className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm resize-y" />
                        <span className="text-xs opacity-50">Kode atribusi (<code>#kode</code>) ditambahkan otomatis di akhir pesan.</span>
                    </label>

                    <button onClick={() => createMut.mutate()} disabled={!canCreate}
                        className="w-full rounded-lg bg-emerald-500 text-white py-2 text-sm font-medium disabled:opacity-50">
                        {createMut.isPending ? "Menyimpan…" : "Buat QR"}
                    </button>
                    {logoDataUrl
                        ? <p className="text-[11px] opacity-50">✓ Logo toko akan disematkan di tengah QR.</p>
                        : <p className="text-[11px] opacity-50">Logo toko belum diunggah — QR tetap dibuat tanpa logo. Atur di Pengaturan.</p>}
                </div>

                {/* Daftar QR */}
                <div className="space-y-3">
                    {isLoading ? (
                        <div className="text-sm opacity-60">Memuat…</div>
                    ) : links.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm opacity-60">
                            Belum ada QR. Buat QR pertama di sebelah kiri.
                        </div>
                    ) : (
                        links.map((link) => {
                            const channel = channels.find((c) => c.id === link.channelId);
                            const url = buildWaMeLink(channel?.displayNumber, link.prefillText);
                            return (
                                <QrLinkCard
                                    key={link.id}
                                    link={link}
                                    channel={channel}
                                    url={url}
                                    logoDataUrl={logoDataUrl}
                                    onDownload={(format) => setExporting({ link, url, format })}
                                    onDelete={() => { if (confirm(`Hapus QR "${link.name}"?`)) delMut.mutate(link.id); }}
                                    onToggle={() => toggleMut.mutate({ id: link.id, isActive: !link.isActive })}
                                />
                            );
                        })
                    )}
                </div>
            </div>

            {/* Host tersembunyi untuk render QR resolusi tinggi saat ekspor */}
            <div id="qr-export-host" aria-hidden style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none", opacity: 0 }}>
                {exporting && (exporting.format === "png" ? (
                    <QRCodeCanvas value={exporting.url} size={1024} level="H" marginSize={4} bgColor="#ffffff" fgColor="#0f172a"
                        imageSettings={logoSettings(logoDataUrl, 220)} />
                ) : (
                    <QRCodeSVG value={exporting.url} size={512} level="H" marginSize={4} bgColor="#ffffff" fgColor="#0f172a"
                        imageSettings={logoSettings(logoDataUrl, 110)} />
                ))}
            </div>
        </div>
    );
}

function triggerDownload(href: string, filename: string) {
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
}

function QrLinkCard({ link, channel, url, logoDataUrl, onDownload, onDelete, onToggle }: {
    link: WaQrLink;
    channel?: WaChannel;
    url: string;
    logoDataUrl?: string;
    onDownload: (format: "png" | "svg") => void;
    onDelete: () => void;
    onToggle: () => void;
}) {
    const copyLink = async () => {
        try { await navigator.clipboard.writeText(url); alert("Link disalin ✓"); }
        catch { alert("Gagal menyalin"); }
    };

    return (
        <div className={`rounded-2xl border border-border bg-card/60 p-4 flex gap-4 ${link.isActive ? "" : "opacity-60"}`}>
            <div className="shrink-0 rounded-xl bg-white p-2 self-start">
                <QRCodeSVG value={url} size={120} level="H" marginSize={0} bgColor="#ffffff" fgColor="#0f172a"
                    imageSettings={logoSettings(logoDataUrl, 26)} />
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{link.name}</span>
                    <span className="text-[11px] rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 px-2 py-0.5">
                        {LEAD_SOURCE_LABEL[link.source as LeadSource] || link.source}
                    </span>
                    {!link.isActive && <span className="text-[11px] rounded-full bg-muted px-2 py-0.5">Nonaktif</span>}
                </div>
                {link.sourceDetail && <div className="text-xs opacity-60">{link.sourceDetail}</div>}
                <div className="text-xs opacity-60">
                    Nomor: {channel ? `${channel.label}${channel.displayNumber ? ` (${channel.displayNumber})` : ""}` : <span className="text-amber-500">belum diset</span>}
                </div>
                <div className="text-xs opacity-70">Kode: <code className="bg-muted px-1 rounded">#{link.code}</code> · {link.scanCount} scan</div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                    <button onClick={() => onDownload("svg")} className="inline-flex items-center gap-1 text-xs rounded-lg border border-border px-2 py-1 hover:bg-muted">
                        <FileCode className="w-3.5 h-3.5" /> SVG
                    </button>
                    <button onClick={() => onDownload("png")} className="inline-flex items-center gap-1 text-xs rounded-lg border border-border px-2 py-1 hover:bg-muted">
                        <FileImage className="w-3.5 h-3.5" /> PNG HD
                    </button>
                    <button onClick={copyLink} className="inline-flex items-center gap-1 text-xs rounded-lg border border-border px-2 py-1 hover:bg-muted">
                        <Copy className="w-3.5 h-3.5" /> Salin link
                    </button>
                    <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs rounded-lg border border-border px-2 py-1 hover:bg-muted">
                        <ExternalLink className="w-3.5 h-3.5" /> Uji
                    </a>
                    <button onClick={onToggle} className="inline-flex items-center gap-1 text-xs rounded-lg border border-border px-2 py-1 hover:bg-muted">
                        {link.isActive ? "Nonaktifkan" : "Aktifkan"}
                    </button>
                    <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs rounded-lg border border-border px-2 py-1 hover:bg-muted text-red-500">
                        <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </button>
                </div>
            </div>
        </div>
    );
}
