'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getDiscordConfig, updateDiscordConfig, testDiscordChannel, getActiveCompanyBranches,
    type DiscordConfig, type DiscordChannelKey, type DiscordEventKey, type DiscordWebhooks,
} from '@/lib/api/discord';
import {
    Webhook, Save, Loader2, CheckCircle2, Send, Info, Power, Building2, Globe,
} from 'lucide-react';

const CHANNELS: { key: DiscordChannelKey; label: string; hint: string; system?: boolean }[] = [
    { key: 'sales', label: '#penjualan', hint: 'Order POS, lead & deal closing' },
    { key: 'production', label: '#produksi', hint: 'Pesanan siap & Surat Order' },
    { key: 'finance', label: '#keuangan', hint: 'Laporan tutup shift + bukti' },
    { key: 'inventory', label: '#stok-gudang', hint: 'Stok menipis' },
    { key: 'leaderboard', label: '#leaderboard', hint: 'Pengumuman juara CS (lintas cabang)', system: true },
    { key: 'system', label: '#sistem', hint: 'Backup & error (lintas cabang)', system: true },
];

const EVENTS: { key: DiscordEventKey; label: string; desc: string; channel: DiscordChannelKey }[] = [
    { key: 'newTransaction', label: 'Order / Penjualan Baru', desc: 'Setiap transaksi POS dibuat (detail item + total + kasir)', channel: 'sales' },
    { key: 'shiftRecap', label: 'Laporan Tutup Shift', desc: 'Ringkasan + laporan lengkap & foto bukti saat tutup shift', channel: 'finance' },
    { key: 'suratOrder', label: 'Surat Order Desain', desc: 'SO dari desainer ke kasir/operator (teks + lampiran desain)', channel: 'production' },
    { key: 'newLead', label: 'Lead Baru Masuk', desc: 'Setiap lead baru dibuat (real-time)', channel: 'sales' },
    { key: 'dealClosing', label: 'Deal Closing Baru', desc: 'Saat lead berhasil di-convert (CLOSED_WON)', channel: 'sales' },
    { key: 'jobReady', label: 'Pesanan Siap Diambil', desc: 'Saat job cetak selesai (SELESAI)', channel: 'production' },
    { key: 'lowStock', label: 'Stok Menipis', desc: 'Saat stok di bawah batas minimum', channel: 'inventory' },
    { key: 'backup', label: 'Status Backup', desc: 'Backup otomatis berhasil / gagal (lintas cabang)', channel: 'system' },
    { key: 'error', label: 'Error Sistem', desc: 'Error server (≥500) diteruskan ke Discord (lintas cabang)', channel: 'system' },
    { key: 'champion', label: 'Pengumuman Juara', desc: 'Rekap juara leaderboard (manual / terjadwal, lintas cabang)', channel: 'leaderboard' },
];

const CHANNEL_LABEL: Record<DiscordChannelKey, string> =
    Object.fromEntries(CHANNELS.map(c => [c.key, c.label])) as any;

// 'global' = webhook sistem/lintas-cabang; number = branchId
type Scope = 'global' | number;

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button" role="switch" aria-checked={checked} disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-primary-foreground shadow-md transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );
}

export default function DiscordSettingsPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ['discord-config'], queryFn: getDiscordConfig });
    const { data: branches } = useQuery({ queryKey: ['company-branches-active'], queryFn: getActiveCompanyBranches });

    const [form, setForm] = useState<DiscordConfig>({ enabled: false, webhooks: {}, events: {}, branchConfigs: {} });
    const [scope, setScope] = useState<Scope>('global');
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState<DiscordChannelKey | null>(null);
    const [testResult, setTestResult] = useState<Record<string, string>>({});

    useEffect(() => {
        if (data) setForm({
            enabled: !!data.enabled,
            webhooks: data.webhooks ?? {},
            events: data.events ?? {},
            branchConfigs: data.branchConfigs ?? {},
        });
    }, [data]);

    const mutation = useMutation({
        mutationFn: (d: Partial<DiscordConfig>) => updateDiscordConfig(d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['discord-config'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    // Webhook set untuk scope aktif
    const scopeWebhooks = (): DiscordWebhooks =>
        scope === 'global' ? form.webhooks : (form.branchConfigs[String(scope)]?.webhooks ?? {});

    const setWebhook = (key: DiscordChannelKey, url: string) => {
        if (scope === 'global') {
            setForm(f => ({ ...f, webhooks: { ...f.webhooks, [key]: url } }));
        } else {
            const id = String(scope);
            setForm(f => ({
                ...f,
                branchConfigs: {
                    ...f.branchConfigs,
                    [id]: { webhooks: { ...(f.branchConfigs[id]?.webhooks ?? {}), [key]: url } },
                },
            }));
        }
    };

    const setEvent = (key: DiscordEventKey, on: boolean) =>
        setForm(f => ({ ...f, events: { ...f.events, [key]: on } }));
    const eventOn = (key: DiscordEventKey) => form.events[key] !== false;

    const handleTest = async (channel: DiscordChannelKey) => {
        setTesting(channel);
        setTestResult(r => ({ ...r, [channel]: '' }));
        try {
            // Simpan dulu agar URL terbaru dipakai backend saat test
            await updateDiscordConfig({ webhooks: form.webhooks, branchConfigs: form.branchConfigs });
            const res = await testDiscordChannel(channel, scope === 'global' ? null : scope);
            setTestResult(r => ({ ...r, [channel]: (res.ok ? '✅ ' : '❌ ') + res.message }));
        } catch {
            setTestResult(r => ({ ...r, [channel]: '❌ Gagal menghubungi server.' }));
        } finally {
            setTesting(null);
        }
    };

    if (isLoading) {
        return <div className="p-8 flex items-center justify-center min-h-[400px]"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
    }

    const wh = scopeWebhooks();
    const isGlobal = scope === 'global';
    // Di tab cabang, channel sistem (leaderboard/system) tidak relevan (selalu pakai global)
    const visibleChannels = isGlobal ? CHANNELS : CHANNELS.filter(c => !c.system);
    const scopeName = isGlobal ? 'Global / Sistem' : (branches?.find(b => b.id === scope)?.name ?? `Cabang #${scope}`);

    return (
        <div className="p-6 max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                        <Webhook className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Notifikasi Discord</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Webhook terpisah per cabang. Pilih cabang untuk atur channel-nya sendiri.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => mutation.mutate(form)}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                        : saved ? <><CheckCircle2 className="w-4 h-4" /> Tersimpan!</>
                        : <><Save className="w-4 h-4" /> Simpan</>}
                </button>
            </div>

            {/* Master toggle */}
            <div className="bg-card border border-border rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${form.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                        <Power className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold">Aktifkan Notifikasi Discord</p>
                        <p className="text-xs text-muted-foreground">Master switch — kalau mati, semua notifikasi Discord (semua cabang) tidak dikirim.</p>
                    </div>
                </div>
                <ToggleSwitch checked={form.enabled} onChange={v => setForm(f => ({ ...f, enabled: v }))} />
            </div>

            {/* Scope selector */}
            <div className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setScope('global')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isGlobal ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                    >
                        <Globe className="w-3.5 h-3.5" /> Global / Sistem
                    </button>
                    {(branches ?? []).map(b => (
                        <button
                            key={b.id}
                            onClick={() => setScope(b.id)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${scope === b.id ? 'bg-primary text-primary-foreground' : 'bg-muted/50 text-muted-foreground hover:bg-muted'}`}
                        >
                            <Building2 className="w-3.5 h-3.5" /> {b.name}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-indigo-800 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                    {isGlobal
                        ? <>Webhook <strong>Global/Sistem</strong> dipakai untuk event lintas-cabang (juara, backup, error) dan data tanpa cabang (mis. order via website). Channel #leaderboard & #sistem hanya bisa di sini.</>
                        : <>Webhook untuk <strong>{scopeName}</strong>. Event cabang ini (order, shift, surat order, dll) dikirim ke sini. <strong>Tanpa fallback</strong> — kalau channel dikosongkan, notifikasinya tidak terkirim.</>}
                </div>
            </div>

            {/* Webhooks per channel (scope aktif) */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b flex items-center gap-2">
                    {isGlobal ? <Globe className="w-4 h-4 text-muted-foreground" /> : <Building2 className="w-4 h-4 text-muted-foreground" />}
                    <div>
                        <h2 className="font-semibold text-sm">Webhook — {scopeName}</h2>
                        <p className="text-xs text-muted-foreground">Satu URL webhook Discord untuk tiap kategori notifikasi.</p>
                    </div>
                </div>
                <div className="p-5 space-y-4">
                    {visibleChannels.map(ch => (
                        <div key={ch.key}>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold">{ch.label} <span className="text-muted-foreground font-normal">— {ch.hint}</span></label>
                                <button
                                    onClick={() => handleTest(ch.key)}
                                    disabled={!wh[ch.key] || testing === ch.key}
                                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
                                >
                                    {testing === ch.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Test
                                </button>
                            </div>
                            <input
                                type="url"
                                placeholder="https://discord.com/api/webhooks/..."
                                value={wh[ch.key] ?? ''}
                                onChange={e => setWebhook(ch.key, e.target.value)}
                                className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                            />
                            {testResult[ch.key] && (
                                <p className={`text-xs mt-1 font-medium ${testResult[ch.key].startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{testResult[ch.key]}</p>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Event toggles (global, berlaku semua cabang) */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b">
                    <h2 className="font-semibold text-sm">Event yang Dikirim</h2>
                    <p className="text-xs text-muted-foreground">Berlaku untuk semua cabang. Default semua aktif.</p>
                </div>
                <div className="p-5 space-y-1">
                    {EVENTS.map((ev, i) => (
                        <div key={ev.key}>
                            {i > 0 && <div className="border-t border-dashed border-border my-1" />}
                            <div className="flex items-start justify-between gap-4 py-1.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{ev.label} <span className="text-xs font-normal text-muted-foreground">→ {CHANNEL_LABEL[ev.channel]}</span></p>
                                    <p className="text-xs text-muted-foreground mt-0.5">{ev.desc}</p>
                                </div>
                                <ToggleSwitch checked={eventOn(ev.key)} onChange={v => setEvent(ev.key, v)} disabled={!form.enabled} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex justify-end pb-4">
                <button
                    onClick={() => mutation.mutate(form)}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                        : saved ? <><CheckCircle2 className="w-4 h-4" /> Tersimpan!</>
                        : <><Save className="w-4 h-4" /> Simpan Pengaturan</>}
                </button>
            </div>
        </div>
    );
}
