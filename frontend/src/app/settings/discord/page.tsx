'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getDiscordConfig, updateDiscordConfig, testDiscordChannel,
    type DiscordConfig, type DiscordChannelKey, type DiscordEventKey,
} from '@/lib/api/discord';
import {
    Webhook, Save, Loader2, CheckCircle2, Send, Info, Power,
} from 'lucide-react';

const CHANNELS: { key: DiscordChannelKey; label: string; hint: string }[] = [
    { key: 'sales', label: '#penjualan', hint: 'Transaksi & deal closing' },
    { key: 'production', label: '#produksi', hint: 'Pesanan siap diambil' },
    { key: 'finance', label: '#keuangan', hint: 'Rekap tutup shift' },
    { key: 'inventory', label: '#stok-gudang', hint: 'Stok menipis' },
    { key: 'leaderboard', label: '#leaderboard', hint: 'Pengumuman juara CS' },
    { key: 'system', label: '#sistem', hint: 'Backup & error' },
];

const EVENTS: { key: DiscordEventKey; label: string; desc: string; channel: DiscordChannelKey }[] = [
    { key: 'shiftRecap', label: 'Rekap Tutup Shift', desc: 'Ringkasan omzet & kas saat tutup shift', channel: 'finance' },
    { key: 'newLead', label: 'Lead Baru Masuk', desc: 'Setiap lead baru dibuat (real-time)', channel: 'sales' },
    { key: 'dealClosing', label: 'Deal Closing Baru', desc: 'Saat lead berhasil di-convert (CLOSED_WON)', channel: 'sales' },
    { key: 'jobReady', label: 'Pesanan Siap Diambil', desc: 'Saat job cetak selesai (SELESAI)', channel: 'production' },
    { key: 'lowStock', label: 'Stok Menipis', desc: 'Saat stok di bawah batas minimum', channel: 'inventory' },
    { key: 'backup', label: 'Status Backup', desc: 'Backup otomatis berhasil / gagal', channel: 'system' },
    { key: 'error', label: 'Error Sistem', desc: 'Error server (≥500) diteruskan ke Discord', channel: 'system' },
    { key: 'champion', label: 'Pengumuman Juara', desc: 'Rekap juara leaderboard (manual / terjadwal)', channel: 'leaderboard' },
];

const CHANNEL_LABEL: Record<DiscordChannelKey, string> =
    Object.fromEntries(CHANNELS.map(c => [c.key, c.label])) as any;

function ToggleSwitch({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
    return (
        <button
            type="button" role="switch" aria-checked={checked} disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-40 ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );
}

export default function DiscordSettingsPage() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ['discord-config'], queryFn: getDiscordConfig });

    const [form, setForm] = useState<DiscordConfig>({ enabled: false, webhooks: {}, events: {} });
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState<DiscordChannelKey | null>(null);
    const [testResult, setTestResult] = useState<Record<string, string>>({});

    useEffect(() => {
        if (data) setForm({ enabled: !!data.enabled, webhooks: data.webhooks ?? {}, events: data.events ?? {} });
    }, [data]);

    const mutation = useMutation({
        mutationFn: (d: Partial<DiscordConfig>) => updateDiscordConfig(d),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['discord-config'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    const setWebhook = (key: DiscordChannelKey, url: string) =>
        setForm(f => ({ ...f, webhooks: { ...f.webhooks, [key]: url } }));
    const setEvent = (key: DiscordEventKey, on: boolean) =>
        setForm(f => ({ ...f, events: { ...f.events, [key]: on } }));
    // Event dianggap aktif kalau tidak di-set ke false (default ON)
    const eventOn = (key: DiscordEventKey) => form.events[key] !== false;

    const handleTest = async (channel: DiscordChannelKey) => {
        setTesting(channel);
        setTestResult(r => ({ ...r, [channel]: '' }));
        try {
            // Simpan dulu agar URL terbaru dipakai backend saat test
            await updateDiscordConfig({ webhooks: form.webhooks });
            const res = await testDiscordChannel(channel);
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
                            Kirim event penting ke channel Discord toko (multi-channel + toggle per-event).
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
                        <p className="text-xs text-muted-foreground">Master switch — kalau mati, semua notifikasi Discord tidak dikirim.</p>
                    </div>
                </div>
                <ToggleSwitch checked={form.enabled} onChange={v => setForm(f => ({ ...f, enabled: v }))} />
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-indigo-800 flex gap-2">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div>Buat webhook per channel di Discord: <em>Channel Settings › Integrations › Webhooks › New Webhook</em>, lalu tempel URL-nya di bawah. Channel yang kosong otomatis dilewati.</div>
            </div>

            {/* Webhooks per channel */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b">
                    <h2 className="font-semibold text-sm">Webhook per Channel</h2>
                    <p className="text-xs text-muted-foreground">Satu URL webhook Discord untuk tiap kategori notifikasi.</p>
                </div>
                <div className="p-5 space-y-4">
                    {CHANNELS.map(ch => (
                        <div key={ch.key}>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-xs font-semibold">{ch.label} <span className="text-muted-foreground font-normal">— {ch.hint}</span></label>
                                <button
                                    onClick={() => handleTest(ch.key)}
                                    disabled={!form.webhooks[ch.key] || testing === ch.key}
                                    className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-40"
                                >
                                    {testing === ch.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Test
                                </button>
                            </div>
                            <input
                                type="url"
                                placeholder="https://discord.com/api/webhooks/..."
                                value={form.webhooks[ch.key] ?? ''}
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

            {/* Event toggles */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-3 bg-muted/40 border-b">
                    <h2 className="font-semibold text-sm">Event yang Dikirim</h2>
                    <p className="text-xs text-muted-foreground">Pilih event mana yang dikirim ke Discord. Default semua aktif.</p>
                </div>
                <div className="p-5 space-y-1">
                    {EVENTS.map((ev, i) => (
                        <div key={ev.key}>
                            {i > 0 && <div className="border-t border-dashed border-border my-1" />}
                            <div className="flex items-start justify-between gap-4 py-1.5">
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{ev.label} <span className="text-[10px] font-normal text-muted-foreground">→ {CHANNEL_LABEL[ev.channel]}</span></p>
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
