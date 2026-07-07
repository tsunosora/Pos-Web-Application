'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getWhatsappStatus, getWhatsappGroups, getWhatsappConfig,
    logoutWhatsapp, sendWhatsappToGroup, broadcastWhatsapp,
    sendWhatsappAnnouncement, updateWhatsappBroadcastGroups, setWhatsappAnnouncement,
    setWhatsappDesignGroup
} from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCcw, LogOut, CheckCircle2, AlertTriangle, Smartphone, Loader2, FileText, Send, Megaphone, Radio, Users, Plus, Trash2, Settings, MessageCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

type Group = { id: string; name: string; isBroadcast: boolean; isAnnouncement: boolean };

export default function WhatsappSettingsPage() {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // --- Broadcast state ---
    const [broadcastMessage, setBroadcastMessage] = useState('');
    const [announceMessage, setAnnounceMessage] = useState('');
    const [sendGroupId, setSendGroupId] = useState('');
    const [sendGroupMessage, setSendGroupMessage] = useState('');
    const [announcementInput, setAnnouncementInput] = useState('');
    const [announcementManualId, setAnnouncementManualId] = useState('');
    const [broadcastResult, setBroadcastResult] = useState<string | null>(null);
    const [sendResult, setSendResult] = useState<string | null>(null);
    const [announceResult, setAnnounceResult] = useState<string | null>(null);
    const [announceConfigResult, setAnnounceConfigResult] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['whatsapp-status'],
        queryFn: getWhatsappStatus,
        refetchInterval: 3000,
    });

    const { data: groups = [], refetch: refetchGroups } = useQuery<Group[]>({
        queryKey: ['whatsapp-groups'],
        queryFn: getWhatsappGroups,
        enabled: data?.isReady === true,
    });

    const { data: config, refetch: refetchConfig } = useQuery({
        queryKey: ['whatsapp-config'],
        queryFn: getWhatsappConfig,
        enabled: data?.isReady === true,
    });

    const logoutMutation = useMutation({
        mutationFn: logoutWhatsapp,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
            alert('WhatsApp Client sedang di-restart. Silakan tunggu QR Code baru muncul dalam beberapa detik.');
        },
        onError: (err: any) => alert('Gagal restart client: ' + err.message)
    });

    const broadcastMutation = useMutation({
        mutationFn: () => broadcastWhatsapp(broadcastMessage),
        onSuccess: (res) => {
            setBroadcastResult(`✅ Berhasil: ${res.success}/${res.total} grup`);
            setBroadcastMessage('');
        },
        onError: () => setBroadcastResult('❌ Gagal mengirim broadcast.')
    });

    const announceMutation = useMutation({
        mutationFn: () => sendWhatsappAnnouncement(announceMessage),
        onSuccess: (res) => {
            setAnnounceResult(res.success ? '✅ Pengumuman berhasil dikirim!' : '❌ Gagal mengirim. Channel pengumuman belum diatur?');
            setAnnounceMessage('');
        },
        onError: () => setAnnounceResult('❌ Gagal mengirim pengumuman.')
    });

    const sendGroupMutation = useMutation({
        mutationFn: () => sendWhatsappToGroup(sendGroupId, sendGroupMessage),
        onSuccess: (res) => {
            setSendResult(res.success ? '✅ Pesan berhasil dikirim!' : '❌ Gagal mengirim. Periksa Group ID.');
            setSendGroupMessage('');
        },
        onError: () => setSendResult('❌ Gagal mengirim pesan.')
    });

    const addBroadcastMutation = useMutation({
        mutationFn: (groupId: string) => updateWhatsappBroadcastGroups({ add: groupId }),
        onSuccess: () => { refetchGroups(); refetchConfig(); }
    });

    const removeBroadcastMutation = useMutation({
        mutationFn: (groupId: string) => updateWhatsappBroadcastGroups({ remove: groupId }),
        onSuccess: () => { refetchGroups(); refetchConfig(); }
    });

    const setAnnouncementMutation = useMutation({
        mutationFn: (channelId: string | null) => setWhatsappAnnouncement(channelId),
        onSuccess: () => { refetchGroups(); refetchConfig(); setAnnouncementInput(''); }
    });

    const setDesignGroupMutation = useMutation({
        mutationFn: (groupId: string | null) => setWhatsappDesignGroup(groupId),
        onSuccess: () => { refetchConfig(); }
    });

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await refetch();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    const handleLogout = () => {
        if (confirm('Apakah Anda yakin ingin keluar (logout) dari WhatsApp Bot saat ini? Anda harus scan QR code kembali.')) {
            logoutMutation.mutate();
        }
    };

    if (isLoading && !data) return (
        <div className="p-8 flex items-center justify-center min-h-[400px]">
            <div className="flex flex-col items-center text-muted-foreground gap-4">
                <Loader2 className="w-10 h-10 animate-spin" />
                <p>Menghubungkan ke layanan WhatsApp...</p>
            </div>
        </div>
    );

    if (isError) return (
        <div className="p-8 bg-red-500/10 text-red-600 dark:text-red-300 rounded-lg m-6 flex flex-col items-center gap-3">
            <AlertTriangle className="w-10 h-10" />
            <h3 className="font-bold text-lg">Gagal Terhubung ke Backend</h3>
            <p>Pastikan backend server sedang berjalan.</p>
        </div>
    );

    const { status, qrCode, isReady } = data || {};

    const renderStatusBadge = () => {
        switch (status) {
            case 'CONNECTED':
            case 'AUTHENTICATED':
                return <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> TERHUBUNG SEDIA</span>;
            case 'WAITING_QR':
                return <span className="bg-amber-500/10 text-amber-600 dark:text-amber-300 border border-amber-500/20 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"><Smartphone className="w-4 h-4" /> MENUNGGU SCAN QR</span>;
            case 'INITIALIZING':
                return <span className="bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> MENGINISIALISASI...</span>;
            case 'DISCONNECTED':
                return <span className="bg-red-500/10 text-red-600 dark:text-red-300 border border-red-500/20 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> TERPUTUS</span>;
            default:
                return <span className="bg-muted text-foreground px-3 py-1 rounded-full text-sm font-bold">TIDAK DIKETAHUI</span>;
        }
    };

    const broadcastGroups = groups.filter(g => g.isBroadcast);
    const announcementGroup = groups.find(g => g.isAnnouncement);

    return (
        <div className="p-6 space-y-6 max-w-5xl">
            <div className="flex items-start gap-3 pb-4 border-b border-border">
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Pengaturan WhatsApp Bot</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Kelola koneksi dan kirim pesan/pengumuman ke grup WhatsApp.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* Status Card */}
                <Card className="md:col-span-7 border-border shadow-sm">
                    <CardHeader className="bg-muted border-b border-border pb-4">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Smartphone className="text-indigo-500 w-5 h-5" />
                                Info Koneksi
                            </CardTitle>
                            {renderStatusBadge()}
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="space-y-2">
                            <div className="flex justify-between py-2 border-b border-dashed border-border">
                                <span className="text-muted-foreground font-medium">Status Internal</span>
                                <span className="font-bold text-foreground">{status}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-dashed border-border">
                                <span className="text-muted-foreground font-medium">Kesiapan Kirim Pesan</span>
                                <span className={isReady ? 'font-bold text-emerald-600' : 'font-bold text-red-600'}>
                                    {isReady ? 'Siap' : 'Belum Siap'}
                                </span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-dashed border-border">
                                <span className="text-muted-foreground font-medium">Grup Broadcast</span>
                                <span className="font-bold text-foreground">{config?.broadcastGroupIds?.length ?? 0} grup</span>
                            </div>
                            <div className="flex justify-between py-2 border-dashed border-border">
                                <span className="text-muted-foreground font-medium">Channel Pengumuman</span>
                                <span className={`font-bold text-sm ${config?.announcementChannelId ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                    {config?.announcementChannelId ? announcementGroup?.name || 'Diatur' : 'Belum diatur'}
                                </span>
                            </div>
                        </div>

                        <div className="bg-blue-500/10 p-4 border border-blue-500/20 rounded-lg text-sm text-blue-600 dark:text-blue-300 flex gap-3">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p>
                                <strong>Catatan:</strong> Gunakan perintah <code>!getgroupid</code> di grup tujuan untuk mendapatkan ID grup.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-muted border-t border-border flex justify-between gap-4 p-4">
                        <Button variant="outline" onClick={handleManualRefresh} disabled={isRefreshing}>
                            <RefreshCcw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Cek Ulang Status
                        </Button>
                        {(status === 'CONNECTED' || status === 'AUTHENTICATED' || status === 'DISCONNECTED') && (
                            <Button variant="destructive" onClick={handleLogout} disabled={logoutMutation.isPending}>
                                {logoutMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                                Logout & Restart Bot
                            </Button>
                        )}
                    </CardFooter>
                </Card>

                {/* QR Code Card */}
                <Card className="md:col-span-5 border-border shadow-sm">
                    <CardHeader className="bg-muted border-b border-border pb-4 text-center">
                        <CardTitle className="text-lg">Tautkan Perangkat</CardTitle>
                        <CardDescription>Buka WhatsApp di HP Anda, masuk ke Perangkat Tertaut / Linked Devices</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-8 min-h-[300px]">
                        {status === 'WAITING_QR' && qrCode ? (
                            <div className="space-y-6 flex flex-col items-center w-full">
                                <div className="bg-white p-4 rounded-xl border-2 border-border shadow-sm transition-transform hover:scale-105">
                                    <QRCodeSVG value={qrCode} size={220} bgColor={"#ffffff"} fgColor={"#0f172a"} level={"L"} includeMargin={false} />
                                </div>
                                <p className="text-sm font-medium text-muted-foreground animate-pulse">Menunggu pindaian Anda...</p>
                            </div>
                        ) : status === 'CONNECTED' || status === 'AUTHENTICATED' ? (
                            <div className="flex flex-col items-center gap-4 text-emerald-600">
                                <CheckCircle2 className="w-24 h-24 text-emerald-500" />
                                <h3 className="text-xl font-bold text-center">Bot Sudah Terhubung!</h3>
                                <p className="text-sm text-center text-muted-foreground mt-2">Tidak perlu scan QR code. Sistem sudah mengingat sesi WhatsApp sebelumnya via cache.</p>
                            </div>
                        ) : status === 'INITIALIZING' ? (
                            <div className="flex flex-col items-center gap-4 text-muted-foreground">
                                <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
                                <h3 className="font-semibold text-center mt-2 text-indigo-600 dark:text-indigo-300">Chrome sedang disiapkan...</h3>
                                <p className="text-xs text-center">Biasanya butuh waktu hingga 15-30 detik jika mesin agak lambat.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-muted-foreground">
                                <Smartphone className="w-20 h-20 opacity-20" />
                                <h3 className="font-semibold text-center mt-2">Memuat QR Code...</h3>
                                <p className="text-xs text-center">Silakan klik "Logout & Restart" jika QR tidak muncul lebih dari 1 menit.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* ====== BROADCAST SECTION ====== */}
                {isReady && (
                    <>
                        {/* Kirim Broadcast ke Semua Grup */}
                        <Card className="md:col-span-6 border-border shadow-sm">
                            <CardHeader className="bg-muted border-b border-border pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Radio className="text-indigo-500 w-5 h-5" />
                                    Broadcast ke Semua Grup
                                </CardTitle>
                                <CardDescription>Kirim pesan serentak ke semua grup broadcast yang terdaftar ({broadcastGroups.length} grup).</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-3">
                                {broadcastGroups.length === 0 && (
                                    <div className="text-sm text-amber-600 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
                                        Belum ada grup broadcast. Tambahkan grup di bagian "Kelola Grup" di bawah.
                                    </div>
                                )}
                                <Textarea
                                    placeholder="Tulis pesan broadcast di sini..."
                                    value={broadcastMessage}
                                    onChange={e => { setBroadcastMessage(e.target.value); setBroadcastResult(null); }}
                                    rows={4}
                                    className="resize-none"
                                />
                                {broadcastResult && (
                                    <p className={`text-sm font-medium ${broadcastResult.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{broadcastResult}</p>
                                )}
                            </CardContent>
                            <CardFooter className="bg-muted border-t border-border p-4">
                                <Button
                                    className="w-full"
                                    onClick={() => broadcastMutation.mutate()}
                                    disabled={!broadcastMessage.trim() || broadcastGroups.length === 0 || broadcastMutation.isPending}
                                >
                                    {broadcastMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Radio className="w-4 h-4 mr-2" />}
                                    Kirim Broadcast ({broadcastGroups.length} Grup)
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* Kirim ke Channel Pengumuman */}
                        <Card className="md:col-span-6 border-purple-500/20 shadow-sm">
                            <CardHeader className="bg-purple-500/10 border-b border-purple-500/20 pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Megaphone className="text-purple-500 w-5 h-5" />
                                    Kirim ke Pengumuman Community
                                </CardTitle>
                                <CardDescription>Kirim pesan ke channel pengumuman grup community WhatsApp.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-4">

                                {/* Step 1: Konfigurasi target channel */}
                                <div className="rounded-lg border border-border p-4 space-y-3 bg-muted">
                                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                                        <Settings className="w-4 h-4 text-muted-foreground" />
                                        Target Channel Pengumuman
                                    </h4>

                                    {config?.announcementChannelId ? (
                                        // Sudah diatur — tampilkan info + tombol ganti
                                        <div className="flex items-center justify-between bg-purple-500/10 border border-purple-500/20 rounded-lg px-3 py-2.5">
                                            <div>
                                                <p className="text-sm font-semibold text-purple-600 dark:text-purple-300">
                                                    {announcementGroup?.name || 'Channel Diatur'}
                                                </p>
                                                <p className="text-xs text-muted-foreground font-mono mt-0.5">{config.announcementChannelId}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                className="text-red-500 hover:text-red-700 hover:bg-red-500/10 shrink-0"
                                                onClick={() => { setAnnouncementMutation.mutate(null); setAnnounceConfigResult(null); }}
                                                disabled={setAnnouncementMutation.isPending}
                                            >
                                                <Trash2 className="w-3.5 h-3.5 mr-1" /> Ganti
                                            </Button>
                                        </div>
                                    ) : (
                                        // Belum diatur — form pengaturan
                                        <div className="space-y-3">
                                            <div>
                                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                                    Pilih dari grup yang diikuti bot:
                                                </label>
                                                <select
                                                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                                    defaultValue=""
                                                    onChange={e => {
                                                        if (e.target.value) {
                                                            setAnnouncementMutation.mutate(e.target.value);
                                                            setAnnounceConfigResult(null);
                                                            e.target.value = '';
                                                        }
                                                    }}
                                                    disabled={setAnnouncementMutation.isPending}
                                                >
                                                    <option value="">-- Pilih grup/channel --</option>
                                                    {groups.map(g => (
                                                        <option key={g.id} value={g.id}>{g.name}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <div className="flex-1 h-px bg-border" />
                                                <span>atau isi ID manual</span>
                                                <div className="flex-1 h-px bg-border" />
                                            </div>

                                            <div>
                                                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                                    Group / Channel ID:
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        className="flex-1 border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                                                        placeholder="contoh: 120363xxxxxxxx@g.us"
                                                        value={announcementManualId}
                                                        onChange={e => { setAnnouncementManualId(e.target.value); setAnnounceConfigResult(null); }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        className="bg-purple-600 hover:bg-purple-700 text-white shrink-0"
                                                        onClick={() => {
                                                            if (announcementManualId.trim()) {
                                                                setAnnouncementMutation.mutate(announcementManualId.trim());
                                                                setAnnouncementManualId('');
                                                                setAnnounceConfigResult('✅ Channel pengumuman berhasil diatur!');
                                                            }
                                                        }}
                                                        disabled={!announcementManualId.trim() || setAnnouncementMutation.isPending}
                                                    >
                                                        {setAnnouncementMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                        Simpan
                                                    </Button>
                                                </div>
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Ketik <code className="bg-muted px-1 rounded">!getgroupid</code> di channel tersebut untuk mendapatkan ID-nya.
                                                </p>
                                            </div>
                                            {announceConfigResult && (
                                                <p className={`text-xs font-medium ${announceConfigResult.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{announceConfigResult}</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Step 2: Tulis & kirim pesan */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground block">Isi Pesan Pengumuman:</label>
                                    <Textarea
                                        placeholder="Tulis pesan pengumuman di sini..."
                                        value={announceMessage}
                                        onChange={e => { setAnnounceMessage(e.target.value); setAnnounceResult(null); }}
                                        rows={4}
                                        className="resize-none"
                                        disabled={!config?.announcementChannelId}
                                    />
                                    {!config?.announcementChannelId && (
                                        <p className="text-xs text-amber-600">Atur channel pengumuman di atas terlebih dahulu.</p>
                                    )}
                                    {announceResult && (
                                        <p className={`text-sm font-medium ${announceResult.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{announceResult}</p>
                                    )}
                                </div>

                            </CardContent>
                            <CardFooter className="bg-purple-500/10 border-t border-purple-500/20 p-4">
                                <Button
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                                    onClick={() => announceMutation.mutate()}
                                    disabled={!announceMessage.trim() || !config?.announcementChannelId || announceMutation.isPending}
                                >
                                    {announceMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Megaphone className="w-4 h-4 mr-2" />}
                                    Kirim Pengumuman
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* Group Internal Sales Order (Desain → Kasir/Operator) */}
                        <Card className="md:col-span-6 border-border shadow-sm">
                            <CardHeader className="bg-indigo-500/10 border-b border-indigo-500/20 pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <FileText className="text-indigo-600 w-5 h-5" />
                                    Group Internal Sales Order <span className="text-xs font-normal text-muted-foreground">(Default Global)</span>
                                </CardTitle>
                                <CardDescription>
                                    Group WA default kalau cabang belum punya Design Group sendiri.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-3">
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-md p-3 text-xs text-amber-600 dark:text-amber-300">
                                    <p className="font-semibold mb-1">⚠ Multi-cabang</p>
                                    <p className="leading-relaxed">
                                        Tiap cabang biasanya punya group WA internal yang berbeda. Set <strong>Design Group ID per cabang</strong> di{' '}
                                        <a href="/settings/branch-config" className="underline font-semibold">Settings → Konfigurasi Cabang</a>.
                                        Field di sini hanya jadi <em>fallback</em> kalau cabang asal SO belum punya Design Group sendiri.
                                    </p>
                                </div>
                                {config?.designGroupId ? (
                                    <div className="flex items-center justify-between gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-md p-3">
                                        <div className="text-sm min-w-0">
                                            <div className="text-xs text-indigo-600 dark:text-indigo-300">Group terdaftar:</div>
                                            <div className="font-semibold text-indigo-700 dark:text-indigo-200 truncate">
                                                {groups.find(g => g.id === config.designGroupId)?.name || 'Group tidak diikuti bot'}
                                            </div>
                                            <div className="font-mono text-xs text-indigo-600/70 dark:text-indigo-300/70 truncate">{config.designGroupId}</div>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="border-red-500/30 text-red-600 hover:bg-red-500/10 shrink-0"
                                            onClick={() => setDesignGroupMutation.mutate(null)}
                                            disabled={setDesignGroupMutation.isPending}
                                        >
                                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Hapus
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground block">
                                            Pilih dari grup yang diikuti bot:
                                        </label>
                                        <select
                                            className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                            defaultValue=""
                                            onChange={e => {
                                                if (e.target.value) {
                                                    setDesignGroupMutation.mutate(e.target.value);
                                                    e.target.value = '';
                                                }
                                            }}
                                            disabled={setDesignGroupMutation.isPending || groups.length === 0}
                                        >
                                            <option value="">-- Pilih grup --</option>
                                            {groups.map(g => (
                                                <option key={g.id} value={g.id}>{g.name}</option>
                                            ))}
                                        </select>
                                        {groups.length === 0 && (
                                            <p className="text-xs text-amber-600">Bot belum terhubung ke grup manapun. Hubungkan bot & tunggu daftar grup termuat.</p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Kirim ke Grup Tertentu */}
                        <Card className="md:col-span-6 border-border shadow-sm">
                            <CardHeader className="bg-muted border-b border-border pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Send className="text-emerald-500 w-5 h-5" />
                                    Kirim ke Grup Tertentu
                                </CardTitle>
                                <CardDescription>Kirim pesan ke satu grup spesifik menggunakan Group ID.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-3">
                                <div>
                                    <label className="text-sm font-medium text-foreground mb-1 block">Group ID</label>
                                    <select
                                        className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                                        value={sendGroupId}
                                        onChange={e => { setSendGroupId(e.target.value); setSendResult(null); }}
                                    >
                                        <option value="">-- Pilih dari daftar grup bot --</option>
                                        {groups.map(g => (
                                            <option key={g.id} value={g.id}>{g.name} ({g.id})</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-muted-foreground mt-1">Atau bisa juga ketik ID manual: <code>!getgroupid</code> di dalam grup.</p>
                                </div>
                                <Textarea
                                    placeholder="Tulis pesan di sini..."
                                    value={sendGroupMessage}
                                    onChange={e => { setSendGroupMessage(e.target.value); setSendResult(null); }}
                                    rows={3}
                                    className="resize-none"
                                />
                                {sendResult && (
                                    <p className={`text-sm font-medium ${sendResult.startsWith('✅') ? 'text-emerald-600' : 'text-red-600'}`}>{sendResult}</p>
                                )}
                            </CardContent>
                            <CardFooter className="bg-muted border-t border-border p-4">
                                <Button
                                    className="w-full"
                                    variant="outline"
                                    onClick={() => sendGroupMutation.mutate()}
                                    disabled={!sendGroupId || !sendGroupMessage.trim() || sendGroupMutation.isPending}
                                >
                                    {sendGroupMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                    Kirim ke Grup
                                </Button>
                            </CardFooter>
                        </Card>

                        {/* Kelola Grup (Broadcast & Announcement) */}
                        <Card className="md:col-span-6 border-border shadow-sm">
                            <CardHeader className="bg-muted border-b border-border pb-4">
                                <CardTitle className="text-lg flex items-center gap-2">
                                    <Settings className="text-muted-foreground w-5 h-5" />
                                    Kelola Target Grup
                                </CardTitle>
                                <CardDescription>Atur grup broadcast dan channel pengumuman.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-5 space-y-5">
                                {/* Broadcast Groups */}
                                <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                                        <Radio className="w-4 h-4 text-indigo-500" /> Grup Broadcast Terdaftar
                                    </h4>
                                    {broadcastGroups.length === 0 ? (
                                        <p className="text-xs text-muted-foreground italic">Belum ada grup broadcast.</p>
                                    ) : (
                                        <ul className="space-y-1.5">
                                            {broadcastGroups.map(g => (
                                                <li key={g.id} className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/20 rounded-lg px-3 py-2">
                                                    <div>
                                                        <p className="text-sm font-medium text-indigo-800">{g.name}</p>
                                                        <p className="text-xs text-muted-foreground font-mono">{g.id}</p>
                                                    </div>
                                                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-700 hover:bg-red-500/10"
                                                        onClick={() => removeBroadcastMutation.mutate(g.id)}
                                                        disabled={removeBroadcastMutation.isPending}>
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </Button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    <div className="mt-2">
                                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Tambah grup dari daftar bot:</label>
                                        <div className="flex gap-2">
                                            <select
                                                className="flex-1 border border-border rounded-md px-2 py-1.5 text-xs bg-background"
                                                defaultValue=""
                                                onChange={e => { if (e.target.value) { addBroadcastMutation.mutate(e.target.value); e.target.value = ''; } }}
                                            >
                                                <option value="">-- Pilih grup --</option>
                                                {groups.filter(g => !g.isBroadcast).map(g => (
                                                    <option key={g.id} value={g.id}>{g.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                            </CardContent>
                        </Card>
                    </>
                )}

                {/* Panduan & Commands */}
                <Card className="md:col-span-12 border-border shadow-sm mt-4">
                    <CardHeader className="bg-muted border-b pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="text-emerald-500 w-5 h-5" />
                            Panduan & Daftar Perintah (Command)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">

                        <div className="space-y-3">
                            <h3 className="font-bold text-foreground">1. Cara Mendapatkan ID Grup</h3>
                            <div className="text-muted-foreground text-sm leading-relaxed">
                                <ol className="list-decimal ml-5 mt-2 space-y-1">
                                    <li>Masukkan nomor bot ke dalam Grup WhatsApp tujuan.</li>
                                    <li>Ketikkan <code className="bg-muted px-1 rounded">!getgroupid</code> di dalam grup tersebut.</li>
                                    <li>Bot akan membalas dengan ID berakhiran <code className="bg-muted px-1 rounded">@g.us</code>.</li>
                                    <li>Gunakan ID tersebut untuk mengatur grup broadcast atau pengumuman.</li>
                                </ol>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <h3 className="font-bold text-foreground">2. Daftar Perintah Bot</h3>
                            <div className="bg-muted border rounded-lg overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-muted border-b text-foreground">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Perintah</th>
                                            <th className="px-4 py-3 font-semibold">Fungsi</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border text-muted-foreground">
                                        {[
                                            ['!getgroupid', 'Mendapatkan ID grup saat ini (hanya di grup)'],
                                            ['!botadmin status', 'Cek status koneksi bot'],
                                            ['!botadmin listmygroups', 'Tampilkan semua grup yang diikuti bot'],
                                            ['!botadmin addbroadcast [ID]', 'Tambah grup ke daftar broadcast'],
                                            ['!botadmin removebroadcast [ID]', 'Hapus grup dari daftar broadcast'],
                                            ['!botadmin listbroadcast', 'Lihat daftar grup broadcast & channel pengumuman'],
                                            ['!botadmin setannouncement [ID]', 'Set channel pengumuman community'],
                                            ['!botadmin broadcast [pesan]', 'Broadcast pesan ke semua grup terdaftar'],
                                            ['!botadmin announce [pesan]', 'Kirim pesan ke channel pengumuman'],
                                            ['!botadmin sendgroup [ID] [pesan]', 'Kirim pesan ke grup spesifik'],
                                        ].map(([cmd, desc]) => (
                                            <tr key={cmd}>
                                                <td className="px-4 py-3 font-mono text-indigo-600 font-medium text-xs">{cmd}</td>
                                                <td className="px-4 py-3">{desc}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </CardContent>
                </Card>

            </div>
        </div>
    );
}
