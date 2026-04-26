'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings } from '@/lib/api/settings';
import { useState, useEffect } from 'react';
import {
    Bell, ShoppingCart, Package, RefreshCw, Clock, MessageSquare, GitCommit,
    Save, Loader2, CheckCircle2, Copy, ExternalLink, Info, Send, Shield
} from 'lucide-react';

const API_URL = typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001')
    : '';

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        >
            <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );
}

function Section({ icon, iconClass, title, description, children }: {
    icon: React.ReactNode; iconClass: string; title: string; description: string; children: React.ReactNode;
}) {
    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 bg-muted/40 border-b">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${iconClass}`}>
                    {icon}
                </div>
                <div>
                    <h2 className="font-semibold text-sm">{title}</h2>
                    <p className="text-xs text-muted-foreground">{description}</p>
                </div>
            </div>
            <div className="p-5 space-y-4">
                {children}
            </div>
        </div>
    );
}

function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{label}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <div className="shrink-0">{children}</div>
        </div>
    );
}

export default function NotificationsSettingsPage() {
    const queryClient = useQueryClient();
    const { data: settings, isLoading } = useQuery({ queryKey: ['store-settings'], queryFn: getSettings });

    // Local form state
    const [form, setForm] = useState({
        notifyNewTransaction: true,
        notifyLowStock: true,
        notifyOfflineSync: true,
        notifyShiftReminder: false,
        notifyGithubCommit: true,
        lowStockThreshold: 5,
        shiftReminderTime: '08:00',
        shiftReminderTime2: '17:00',
        discordWebhookUrl: '',
        githubWebhookSecret: '',
    });

    const [saved, setSaved] = useState(false);
    const [testDiscordResult, setTestDiscordResult] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (settings) {
            setForm({
                notifyNewTransaction: settings.notifyNewTransaction ?? true,
                notifyLowStock: settings.notifyLowStock ?? true,
                notifyOfflineSync: settings.notifyOfflineSync ?? true,
                notifyShiftReminder: settings.notifyShiftReminder ?? false,
                notifyGithubCommit: (settings as any).notifyGithubCommit ?? true,
                lowStockThreshold: settings.lowStockThreshold ?? 5,
                shiftReminderTime: settings.shiftReminderTime ?? '08:00',
                shiftReminderTime2: (settings as any).shiftReminderTime2 ?? '17:00',
                discordWebhookUrl: settings.discordWebhookUrl ?? '',
                githubWebhookSecret: settings.githubWebhookSecret ?? '',
            });
        }
    }, [settings]);

    const mutation = useMutation({
        mutationFn: (data: any) => updateSettings(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['store-settings'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        },
    });

    const handleSave = () => {
        mutation.mutate(form);
    };

    const handleTestDiscord = async () => {
        if (!form.discordWebhookUrl) return;
        setTestDiscordResult(null);
        try {
            const res = await fetch(form.discordWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: '✅ **Test Notifikasi POS**\nKoneksi Discord Webhook berhasil! Notifikasi dari aplikasi POS akan muncul di sini.' }),
            });
            if (res.ok || res.status === 204) {
                setTestDiscordResult('✅ Pesan test berhasil dikirim ke Discord!');
            } else {
                setTestDiscordResult(`❌ Gagal (HTTP ${res.status}). Periksa URL webhook.`);
            }
        } catch {
            setTestDiscordResult('❌ Gagal menghubungi Discord. Periksa koneksi dan URL.');
        }
    };

    const webhookUrl = `${API_URL}/webhook/github`;

    const copyWebhookUrl = () => {
        navigator.clipboard.writeText(webhookUrl).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-3xl space-y-6">
            {/* Page Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                        <Bell className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Pengaturan Notifikasi</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Atur jenis notifikasi di aplikasi, Discord, atau dari GitHub.
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {mutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                    ) : saved ? (
                        <><CheckCircle2 className="w-4 h-4" /> Tersimpan!</>
                    ) : (
                        <><Save className="w-4 h-4" /> Simpan</>
                    )}
                </button>
            </div>

            {/* ══ 1. In-App Notifications ════════════════════════════════════ */}
            <Section
                icon={<Bell className="w-4 h-4 text-primary" />}
                iconClass="bg-primary/10"
                title="Notifikasi Aplikasi"
                description="Notifikasi yang muncul di ikon lonceng di pojok kanan atas"
            >
                <SettingRow
                    label="Transaksi Baru"
                    description="Tampilkan notif setiap ada transaksi POS yang berhasil"
                >
                    <ToggleSwitch
                        checked={form.notifyNewTransaction}
                        onChange={v => setForm(f => ({ ...f, notifyNewTransaction: v }))}
                    />
                </SettingRow>

                <div className="border-t border-dashed border-border" />

                <SettingRow
                    label="Stok Hampir Habis"
                    description="Tampilkan notif ketika stok produk di bawah batas minimum"
                >
                    <ToggleSwitch
                        checked={form.notifyLowStock}
                        onChange={v => setForm(f => ({ ...f, notifyLowStock: v }))}
                    />
                </SettingRow>

                {form.notifyLowStock && (
                    <div className="pl-4 border-l-2 border-amber-200 ml-2">
                        <label className="text-xs font-medium text-muted-foreground block mb-1">
                            Batas Stok Minimum (pcs)
                        </label>
                        <input
                            type="number"
                            min={1}
                            value={form.lowStockThreshold}
                            onChange={e => setForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) || 5 }))}
                            className="border border-border rounded-lg px-3 py-1.5 text-sm w-24 bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            Notif akan muncul jika stok ≤ {form.lowStockThreshold} unit setelah transaksi.
                        </p>
                    </div>
                )}

                <div className="border-t border-dashed border-border" />

                <SettingRow
                    label="Sinkronisasi Offline Selesai"
                    description="Notif saat data transaksi offline berhasil diunggah ke server"
                >
                    <ToggleSwitch
                        checked={form.notifyOfflineSync}
                        onChange={v => setForm(f => ({ ...f, notifyOfflineSync: v }))}
                    />
                </SettingRow>

                <div className="border-t border-dashed border-border" />

                <SettingRow
                    label="Pengingat Tutup Shift"
                    description="Ingatkan kasir untuk tutup shift pada jam tertentu"
                >
                    <ToggleSwitch
                        checked={form.notifyShiftReminder}
                        onChange={v => setForm(f => ({ ...f, notifyShiftReminder: v }))}
                    />
                </SettingRow>

                {form.notifyShiftReminder && (
                    <div className="pl-4 border-l-2 border-indigo-200 ml-2 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Jam Pengingat per Shift</p>

                        {/* Shift 1 */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">
                                🕗 Shift 1 — Jam Pengingat
                            </label>
                            <input
                                type="time"
                                value={form.shiftReminderTime}
                                onChange={e => setForm(f => ({ ...f, shiftReminderTime: e.target.value }))}
                                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Misal: jam buka toko / tutup shift pagi
                            </p>
                        </div>

                        {/* Shift 2 */}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">
                                🕔 Shift 2 — Jam Pengingat
                            </label>
                            <input
                                type="time"
                                value={(form as any).shiftReminderTime2 || ''}
                                onChange={e => setForm(f => ({ ...f, shiftReminderTime2: e.target.value }))}
                                className="border border-border rounded-lg px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Misal: jam tutup toko / tutup shift sore
                            </p>
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Notif akan muncul otomatis setiap hari pada jam yang diatur.
                        </p>
                    </div>
                )}
            </Section>

            {/* ══ 2. Discord Webhook ══════════════════════════════════════════ */}
            <Section
                icon={<MessageSquare className="w-4 h-4 text-indigo-600" />}
                iconClass="bg-indigo-100"
                title="Integrasi Discord"
                description="Forward notifikasi penting ke channel Discord toko kamu"
            >
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm text-indigo-800 flex gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        Notifikasi yang dikirim ke Discord: <strong>stok hampir habis</strong> dan <strong>ringkasan tutup shift</strong>.
                        Buat webhook di Discord: <em>Settings Channel › Integrations › Webhooks › New Webhook</em>.
                    </div>
                </div>

                <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">Discord Webhook URL</label>
                    <input
                        type="url"
                        placeholder="https://discord.com/api/webhooks/..."
                        value={form.discordWebhookUrl}
                        onChange={e => setForm(f => ({ ...f, discordWebhookUrl: e.target.value }))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                    />
                </div>

                {form.discordWebhookUrl && (
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleTestDiscord}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                        >
                            <Send className="w-3.5 h-3.5" />
                            Kirim Test
                        </button>
                        {testDiscordResult && (
                            <p className={`text-xs font-medium ${testDiscordResult.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>
                                {testDiscordResult}
                            </p>
                        )}
                    </div>
                )}
            </Section>

            {/* ══ 3. GitHub Webhook ═══════════════════════════════════════════ */}
            <Section
                icon={<GitCommit className="w-4 h-4 text-violet-600" />}
                iconClass="bg-violet-100"
                title="Integrasi GitHub (Commit Notification)"
                description="Tampilkan notif di aplikasi saat developer push commit ke repository GitHub"
            >
                <div className="bg-violet-50 border border-violet-100 rounded-lg p-3 text-sm text-violet-800 flex gap-2">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                        Setiap kali ada <strong>push commit</strong> ke repository GitHub, notifikasi akan muncul otomatis
                        di bell icon. Berguna untuk kasir mengetahui app sedang diupdate.
                    </div>
                </div>

                <SettingRow
                    label="Aktifkan Notifikasi Commit GitHub"
                    description="Tampilkan notif di aplikasi saat ada push ke branch utama"
                >
                    <ToggleSwitch
                        checked={form.notifyGithubCommit}
                        onChange={v => setForm(f => ({ ...f, notifyGithubCommit: v }))}
                    />
                </SettingRow>

                {/* Webhook URL for GitHub */}
                <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                        URL Webhook (Pasang di GitHub Repository Settings)
                    </label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            readOnly
                            value={webhookUrl}
                            className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-muted font-mono text-muted-foreground"
                        />
                        <button
                            onClick={copyWebhookUrl}
                            className="flex items-center gap-1.5 border border-border rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
                        >
                            {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                            {copied ? 'Disalin!' : 'Salin'}
                        </button>
                    </div>
                </div>

                {/* GitHub Secret */}
                <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1.5 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        Secret Token (Opsional — untuk keamanan tambahan)
                    </label>
                    <input
                        type="password"
                        placeholder="Kosongkan jika tidak ingin memakai verifikasi secret"
                        value={form.githubWebhookSecret}
                        onChange={e => setForm(f => ({ ...f, githubWebhookSecret: e.target.value }))}
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                        Isi nilai yang sama di bagian "Secret" saat mendaftarkan webhook di GitHub.
                    </p>
                </div>

                {/* Step-by-step guide */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wide">Cara Pasang Webhook di GitHub</h3>
                    <ol className="text-xs text-slate-600 space-y-1.5 list-decimal ml-4">
                        <li>Buka repository GitHub kamu → <strong>Settings</strong> → <strong>Webhooks</strong> → <strong>Add webhook</strong></li>
                        <li>Isi <strong>Payload URL</strong> dengan URL di atas (salin & tempel)</li>
                        <li>Ubah <strong>Content type</strong> ke <code className="bg-slate-100 px-1 rounded">application/json</code></li>
                        <li>Isi <strong>Secret</strong> jika kamu mengatur secret token di atas</li>
                        <li>Pilih event: <strong>Just the push event</strong></li>
                        <li>Centang <strong>Active</strong> lalu klik <strong>Add webhook</strong></li>
                    </ol>
                    <a
                        href="https://docs.github.com/en/developers/webhooks-and-events/webhooks/creating-webhooks"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                    >
                        <ExternalLink className="w-3 h-3" /> Dokumentasi GitHub Webhooks
                    </a>
                </div>
            </Section>

            {/* Save Button (bottom) */}
            <div className="flex justify-end pb-4">
                <button
                    onClick={handleSave}
                    disabled={mutation.isPending}
                    className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {mutation.isPending ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</>
                    ) : saved ? (
                        <><CheckCircle2 className="w-4 h-4" /> Tersimpan!</>
                    ) : (
                        <><Save className="w-4 h-4" /> Simpan Pengaturan</>
                    )}
                </button>
            </div>
        </div>
    );
}
