"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, CheckCircle2, XCircle, ArrowLeft, RefreshCw, HardDrive, User } from "lucide-react";
import {
    listWaChannels, createWaChannel, updateWaChannel, deleteWaChannel, getWaHealth,
    getWaMediaStats, cleanupWaMedia, getWaChannelProfile, updateWaChannelProfile,
    type WaChannel, type CreateChannelBody, type WaBusinessProfile,
} from "@/lib/api/whatsapp-cloud";
import { getBranches } from "@/lib/api/settings";
import { StatusBadge } from "@/components/ui/status-badge";
import { WhatsappGuideButton } from "@/components/whatsapp/WhatsappGuideButton";

const EMPTY: CreateChannelBody = { label: "", phoneNumberId: "", wabaId: "", displayNumber: "", branchId: null };

export default function WhatsappSettingsPage() {
    const qc = useQueryClient();
    const [form, setForm] = useState<CreateChannelBody>(EMPTY);
    const [showForm, setShowForm] = useState(false);
    const [profileOpenId, setProfileOpenId] = useState<number | null>(null);

    const { data: channels = [], isLoading } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });
    const { data: branches = [] } = useQuery({ queryKey: ["branches"], queryFn: getBranches });
    const { data: health, refetch: refetchHealth, isFetching: healthLoading } = useQuery({
        queryKey: ["wa-health"], queryFn: getWaHealth,
    });

    const healthById = new Map((health?.channels ?? []).map((c) => [c.id, c]));

    const invalidate = () => {
        qc.invalidateQueries({ queryKey: ["wa-channels"] });
        qc.invalidateQueries({ queryKey: ["wa-health"] });
    };

    const createMut = useMutation({
        mutationFn: createWaChannel,
        onSuccess: () => { setForm(EMPTY); setShowForm(false); invalidate(); },
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal menambah channel"),
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateWaChannel>[1] }) => updateWaChannel(id, data),
        onSuccess: invalidate,
    });
    const deleteMut = useMutation({
        mutationFn: deleteWaChannel,
        onSuccess: invalidate,
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal menghapus"),
    });

    const branchName = (id: number | null) => (id == null ? "Semua cabang (global)" : branches.find((b: { id: number; name: string }) => b.id === id)?.name || `#${id}`);

    return (
        <div className="max-w-4xl mx-auto p-4 space-y-4">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                    <h1 className="text-lg font-semibold">Channel WhatsApp (per cabang)</h1>
                    <WhatsappGuideButton />
                </div>
                <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground">
                    <Plus className="w-4 h-4" /> Tambah channel
                </button>
            </div>

            <p className="text-sm opacity-60">
                Tiap nomor WhatsApp Business (dari Meta) didaftarkan di sini. <b>phone_number_id</b> dipakai
                webhook untuk me-route pesan ke cabang yang benar. Token & app secret ada di <code>.env</code> server.
            </p>

            {!health?.enabled && (
                <div className="text-sm rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 px-3 py-2">
                    Integrasi belum diaktifkan — set <code>WA_CLOUD_ENABLED=&quot;true&quot;</code> di <code>.env</code> server lalu restart.
                </div>
            )}

            {showForm && (
                <form
                    onSubmit={(e) => { e.preventDefault(); createMut.mutate(form); }}
                    className="rounded-2xl border border-border bg-card/60 p-4 grid sm:grid-cols-2 gap-3"
                >
                    <label className="text-sm">Label
                        <input required value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })}
                            placeholder="CS Pusat" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <label className="text-sm">Cabang
                        <select value={form.branchId ?? ""} onChange={(e) => setForm({ ...form, branchId: e.target.value ? +e.target.value : null })}
                            className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                            <option value="">Semua cabang (global)</option>
                            {branches.map((b: { id: number; name: string }) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                    </label>
                    <label className="text-sm">phone_number_id (Meta)
                        <input required value={form.phoneNumberId} onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
                            placeholder="1234567890" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <label className="text-sm">waba_id (Meta)
                        <input required value={form.wabaId} onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
                            placeholder="9876543210" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <label className="text-sm sm:col-span-2">Nomor tampilan (opsional)
                        <input value={form.displayNumber ?? ""} onChange={(e) => setForm({ ...form, displayNumber: e.target.value })}
                            placeholder="+62 812-3456-7890" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                    </label>
                    <div className="sm:col-span-2 flex gap-2 justify-end">
                        <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY); }} className="text-sm px-3 py-1.5 rounded-lg bg-muted">Batal</button>
                        <button type="submit" disabled={createMut.isPending} className="text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">Simpan</button>
                    </div>
                </form>
            )}

            <div className="flex justify-end">
                <button onClick={() => refetchHealth()} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70">
                    <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} /> Cek koneksi
                </button>
            </div>

            <div className="space-y-2">
                {isLoading && <p className="text-sm opacity-60">Memuat…</p>}
                {!isLoading && channels.length === 0 && <p className="text-sm opacity-60">Belum ada channel terdaftar.</p>}
                {channels.map((ch: WaChannel) => {
                    const h = healthById.get(ch.id);
                    return (
                        <div key={ch.id} className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-medium">{ch.label}</span>
                                        <StatusBadge tone={ch.isActive ? "success" : "neutral"}>{ch.isActive ? "Aktif" : "Nonaktif"}</StatusBadge>
                                        {h && (h.ok
                                            ? <StatusBadge tone="info" icon={CheckCircle2}>{h.verifiedName || h.displayNumber || "Terhubung"}</StatusBadge>
                                            : <StatusBadge tone="danger" icon={XCircle}>{h.error?.slice(0, 40) || "Gagal"}</StatusBadge>)}
                                    </div>
                                    <div className="text-xs opacity-60 mt-1 space-x-2">
                                        <span>{branchName(ch.branchId)}</span>
                                        <span>· PN {ch.phoneNumberId}</span>
                                        {ch.displayNumber && <span>· {ch.displayNumber}</span>}
                                        {ch._count && <span>· {ch._count.conversations} percakapan</span>}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => setProfileOpenId((id) => (id === ch.id ? null : ch.id))}
                                        className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg ${profileOpenId === ch.id ? "bg-primary text-primary-foreground" : "bg-muted hover:bg-muted/70"}`}
                                    >
                                        <User className="w-3.5 h-3.5" /> Profil
                                    </button>
                                    <button
                                        onClick={() => updateMut.mutate({ id: ch.id, data: { isActive: !ch.isActive } })}
                                        className="text-xs px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70"
                                    >
                                        {ch.isActive ? "Nonaktifkan" : "Aktifkan"}
                                    </button>
                                    <button
                                        onClick={() => { if (confirm(`Hapus channel "${ch.label}"?`)) deleteMut.mutate(ch.id); }}
                                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            {profileOpenId === ch.id && <ChannelProfileEditor channelId={ch.id} />}
                        </div>
                    );
                })}
            </div>

            <MediaStorageCard />
        </div>
    );
}

function fmtBytes(n: number): string {
    if (!n) return "0 B";
    const u = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), u.length - 1);
    return `${(n / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${u[i]}`;
}

function MediaStorageCard() {
    const qc = useQueryClient();
    const { data: stats, isLoading } = useQuery({ queryKey: ["wa-media-stats"], queryFn: getWaMediaStats });
    const [before, setBefore] = useState("");

    const cleanupMut = useMutation({
        mutationFn: (d: string) => cleanupWaMedia(d),
        onSuccess: (r) => {
            qc.invalidateQueries({ queryKey: ["wa-media-stats"] });
            alert(`Selesai. ${r.deletedFiles} berkas dihapus, ${fmtBytes(r.freedBytes)} dibebaskan.`);
        },
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal membersihkan media"),
    });

    const diskUsedPct = stats && stats.diskTotalBytes > 0
        ? Math.round(((stats.diskTotalBytes - stats.diskFreeBytes) / stats.diskTotalBytes) * 100)
        : 0;

    const doCleanup = () => {
        if (!before) return alert("Pilih tanggal batas dulu.");
        if (!confirm(`Hapus SEMUA berkas media WhatsApp sebelum ${before}?\n\nRiwayat teks tetap ada, hanya berkas media yang dihapus. Tindakan ini tidak bisa dibatalkan.`)) return;
        // kirim akhir hari agar inklusif untuk tanggal yang dipilih
        cleanupMut.mutate(new Date(before + "T23:59:59").toISOString());
    };

    return (
        <div className="rounded-2xl border border-border bg-card/60 p-4 space-y-4">
            <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" />
                <h2 className="font-semibold">Penyimpanan Media WhatsApp</h2>
            </div>
            <p className="text-xs opacity-60 -mt-2">
                Media (gambar/dokumen) diarsipkan permanen di server homelab agar tak hilang saat retensi Meta (±30 hari) berakhir.
                Backup &amp; restore data ada di halaman <Link href="/settings" className="underline">Pengaturan</Link>.
            </p>

            {isLoading && <p className="text-sm opacity-60">Memuat statistik…</p>}
            {stats && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="rounded-xl bg-muted/50 p-3">
                            <div className="text-xs opacity-60">Dipakai media WA</div>
                            <div className="text-lg font-semibold">{fmtBytes(stats.totalBytes)}</div>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-3">
                            <div className="text-xs opacity-60">Jumlah berkas</div>
                            <div className="text-lg font-semibold">{stats.fileCount.toLocaleString("id-ID")}</div>
                        </div>
                        <div className="rounded-xl bg-muted/50 p-3">
                            <div className="text-xs opacity-60">Sisa disk server</div>
                            <div className="text-lg font-semibold">{fmtBytes(stats.diskFreeBytes)}</div>
                        </div>
                    </div>

                    {stats.diskTotalBytes > 0 && (
                        <div className="space-y-1">
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                                <div className={`h-full ${diskUsedPct > 90 ? "bg-red-500" : diskUsedPct > 75 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${diskUsedPct}%` }} />
                            </div>
                            <div className="text-[11px] opacity-60 text-right">
                                Disk server: {fmtBytes(stats.diskTotalBytes - stats.diskFreeBytes)} / {fmtBytes(stats.diskTotalBytes)} terpakai ({diskUsedPct}%)
                            </div>
                        </div>
                    )}

                    {stats.byMonth.length > 0 && (
                        <div className="text-xs">
                            <div className="opacity-60 mb-1">Rincian per bulan:</div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                                {stats.byMonth.map((m) => (
                                    <div key={m.month} className="flex justify-between rounded bg-muted/40 px-2 py-1">
                                        <span>{m.month}</span>
                                        <span className="opacity-70">{fmtBytes(m.bytes)} · {m.files}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="border-t border-border pt-3 space-y-2">
                        <div className="text-sm font-medium flex items-center gap-1.5"><Trash2 className="w-3.5 h-3.5" /> Bersihkan media lama</div>
                        <p className="text-xs opacity-60">Hapus berkas media sebelum tanggal tertentu (riwayat teks tetap tersimpan).</p>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="date"
                                value={before}
                                onChange={(e) => setBefore(e.target.value)}
                                className="rounded-lg bg-muted/60 px-3 py-2 text-sm outline-none"
                            />
                            <button
                                onClick={doCleanup}
                                disabled={!before || cleanupMut.isPending}
                                className="text-sm px-3 py-2 rounded-lg bg-red-500 text-white disabled:opacity-40 hover:bg-red-600"
                            >
                                {cleanupMut.isPending ? "Menghapus…" : "Hapus sebelum tanggal"}
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// Kategori bisnis (vertical) yang didukung Meta.
const WA_VERTICALS: Array<[string, string]> = [
    ["UNDEFINED", "(belum dipilih)"],
    ["OTHER", "Lainnya"],
    ["RETAIL", "Retail / Toko"],
    ["APPAREL", "Pakaian & Fashion"],
    ["PROF_SERVICES", "Jasa Profesional"],
    ["RESTAURANT", "Restoran / Kuliner"],
    ["GROCERY", "Toko Kelontong"],
    ["BEAUTY", "Kecantikan"],
    ["EDU", "Pendidikan"],
    ["ENTERTAIN", "Hiburan"],
    ["EVENT_PLAN", "Perencana Acara"],
    ["FINANCE", "Keuangan"],
    ["HEALTH", "Kesehatan"],
    ["HOTEL", "Hotel / Penginapan"],
    ["TRAVEL", "Travel"],
    ["AUTO", "Otomotif"],
    ["GOVT", "Pemerintahan"],
    ["NONPROFIT", "Nirlaba"],
    ["NOT_A_BIZ", "Bukan bisnis"],
];

function ChannelProfileEditor({ channelId }: { channelId: number }) {
    const qc = useQueryClient();
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ["wa-profile", channelId],
        queryFn: () => getWaChannelProfile(channelId),
    });
    const [form, setForm] = useState<WaBusinessProfile>({});
    const [loaded, setLoaded] = useState(false);
    useEffect(() => {
        if (data && !loaded) { setForm({ ...data }); setLoaded(true); }
    }, [data, loaded]);

    const setWebsite = (i: number, v: string) => {
        setForm((f) => {
            const websites = [...(f.websites ?? [])];
            websites[i] = v;
            return { ...f, websites };
        });
    };

    const saveMut = useMutation({
        mutationFn: () => updateWaChannelProfile(channelId, {
            about: form.about ?? "",
            description: form.description ?? "",
            address: form.address ?? "",
            email: form.email ?? "",
            vertical: form.vertical,
            websites: (form.websites ?? []).map((w) => w.trim()).filter(Boolean),
        }),
        onSuccess: (d) => {
            setForm({ ...d });
            qc.invalidateQueries({ queryKey: ["wa-profile", channelId] });
            alert("Profil bisnis tersimpan!");
        },
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal menyimpan profil"),
    });

    if (isLoading) return <div className="border-t border-border pt-3 text-sm opacity-60">Memuat profil…</div>;
    if (isError) return <div className="border-t border-border pt-3 text-sm text-red-500">Gagal memuat profil: {(error as { response?: { data?: { message?: string } } })?.response?.data?.message || "error"}</div>;

    return (
        <div className="border-t border-border pt-3 space-y-3">
            <div className="flex items-center gap-3">
                {form.profile_picture_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={form.profile_picture_url} alt="foto profil" className="w-12 h-12 rounded-full object-cover border border-border" />
                    : <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center"><User className="w-5 h-5 opacity-50" /></div>}
                <div className="text-xs opacity-60">Foto profil dikelola langsung di WhatsApp Manager / Business App.</div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-sm sm:col-span-2">Tentang (about, maks 139)
                    <input maxLength={139} value={form.about ?? ""} onChange={(e) => setForm({ ...form, about: e.target.value })}
                        placeholder="Percetakan & sablon terpercaya" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                </label>
                <label className="text-sm sm:col-span-2">Deskripsi (maks 512)
                    <textarea maxLength={512} rows={2} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none resize-none" />
                </label>
                <label className="text-sm">Alamat
                    <input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })}
                        className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                </label>
                <label className="text-sm">Email
                    <input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                </label>
                <label className="text-sm">Kategori bisnis
                    <select value={form.vertical ?? "UNDEFINED"} onChange={(e) => setForm({ ...form, vertical: e.target.value })}
                        className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                        {WA_VERTICALS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
                    </select>
                </label>
                <label className="text-sm">Website 1
                    <input value={form.websites?.[0] ?? ""} onChange={(e) => setWebsite(0, e.target.value)}
                        placeholder="https://…" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                </label>
                <label className="text-sm sm:col-span-2">Website 2 (opsional)
                    <input value={form.websites?.[1] ?? ""} onChange={(e) => setWebsite(1, e.target.value)}
                        placeholder="https://…" className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none" />
                </label>
            </div>

            <div className="flex justify-end">
                <button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}
                    className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                    {saveMut.isPending ? "Menyimpan…" : "Simpan profil"}
                </button>
            </div>
        </div>
    );
}
