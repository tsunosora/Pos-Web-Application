'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getWhatsappStatus, logoutWhatsapp } from '@/lib/api';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCcw, LogOut, CheckCircle2, AlertTriangle, Smartphone, Loader2, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function WhatsappSettingsPage() {
    const queryClient = useQueryClient();
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Poll the backend every 3 seconds to check for QR or Connection updates
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['whatsapp-status'],
        queryFn: getWhatsappStatus,
        refetchInterval: 3000,
    });

    const logoutMutation = useMutation({
        mutationFn: logoutWhatsapp,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['whatsapp-status'] });
            alert('WhatsApp Client sedang di-restart. Silakan tunggu QR Code baru muncul dalam beberapa detik.');
        },
        onError: (err: any) => {
            alert('Gagal restart client: ' + err.message);
        }
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
        <div className="p-8 bg-red-50 text-red-600 rounded-lg m-6 flex flex-col items-center gap-3">
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
                return <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> TERHUBUNG SEDIA</span>;
            case 'WAITING_QR':
                return <span className="bg-amber-100 text-amber-800 border border-amber-200 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"><Smartphone className="w-4 h-4" /> MENUNGGU SCAN QR</span>;
            case 'INITIALIZING':
                return <span className="bg-blue-100 text-blue-800 border border-blue-200 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> MENGINISIALISASI...</span>;
            case 'DISCONNECTED':
                return <span className="bg-red-100 text-red-800 border border-red-200 px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> TERPUTUS</span>;
            default:
                return <span className="bg-slate-100 text-slate-800 px-3 py-1 rounded-full text-sm font-bold">TIDAK DIKETAHUI</span>;
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold tracking-tight">Pengaturan WhatsApp Bot</h1>
                <p className="text-muted-foreground">Kelola koneksi bot WhatsApp (wabot_admin_report) untuk otomatisasi pengiriman Laporan Shift Harian.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">

                {/* Status Card */}
                <Card className="md:col-span-7 border-slate-200 shadow-sm">
                    <CardHeader className="bg-slate-50 border-b pb-4">
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
                            <div className="flex justify-between py-2 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">Status Internal</span>
                                <span className="font-bold text-slate-800">{status}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-dashed border-slate-200">
                                <span className="text-slate-500 font-medium">Kesiapan Kirim Pesan</span>
                                <span className={isReady ? 'font-bold text-emerald-600' : 'font-bold text-red-600'}>
                                    {isReady ? 'Siap' : 'Belum Siap'}
                                </span>
                            </div>
                        </div>

                        <div className="bg-blue-50 p-4 border border-blue-100 rounded-lg text-sm text-blue-800 flex gap-3">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            <p>
                                <strong>Catatan:</strong> WhatsApp bot akan mengirim laporan harian ke WhatsApp Group sesuai dengan variabel <code>WHATSAPP_REPORT_GROUP_ID</code> di server.
                                Anda bisa mengecek ID Group dengan mengirim pesan <code>!getgroupid</code> di grup tujuan saat bot aktif.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-slate-50 border-t flex justify-between gap-4 p-4">
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
                <Card className="md:col-span-5 border-slate-200 shadow-sm">
                    <CardHeader className="bg-slate-50 border-b pb-4 text-center">
                        <CardTitle className="text-lg">Tautkan Perangkat</CardTitle>
                        <CardDescription>Buka WhatsApp di HP Anda, masuk ke Perangkat Tertaut / Linked Devices</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-8 min-h-[300px]">

                        {status === 'WAITING_QR' && qrCode ? (
                            <div className="space-y-6 flex flex-col items-center w-full">
                                <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm transition-transform hover:scale-105">
                                    <QRCodeSVG
                                        value={qrCode}
                                        size={220}
                                        bgColor={"#ffffff"}
                                        fgColor={"#0f172a"}
                                        level={"L"}
                                        includeMargin={false}
                                    />
                                </div>
                                <p className="text-sm font-medium text-slate-500 animate-pulse">Menunggu pindaian Anda...</p>
                            </div>
                        ) : status === 'CONNECTED' || status === 'AUTHENTICATED' ? (
                            <div className="flex flex-col items-center gap-4 text-emerald-600">
                                <CheckCircle2 className="w-24 h-24 text-emerald-500" />
                                <h3 className="text-xl font-bold text-center">Bot Sudah Terhubung!</h3>
                                <p className="text-sm text-center text-slate-500 mt-2">Tidak perlu scan QR code. Sistem sudah mengingat sesi WhatsApp sebelumnya via cache.</p>
                            </div>
                        ) : status === 'INITIALIZING' ? (
                            <div className="flex flex-col items-center gap-4 text-slate-500">
                                <Loader2 className="w-16 h-16 animate-spin text-indigo-500" />
                                <h3 className="font-semibold text-center mt-2 text-indigo-900">Chrome sedang disiapkan...</h3>
                                <p className="text-xs text-center">Biasanya butuh waktu hingga 15-30 detik jika mesin agak lambat.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4 text-slate-500">
                                <Smartphone className="w-20 h-20 opacity-20" />
                                <h3 className="font-semibold text-center mt-2">Memuat QR Code...</h3>
                                <p className="text-xs text-center">Silakan klik "Logout & Restart" jika QR tidak muncul lebih dari 1 menit.</p>
                            </div>
                        )}

                    </CardContent>
                </Card>

                {/* Setup & Commands Documentation Card */}
                <Card className="md:col-span-12 border-slate-200 shadow-sm mt-4">
                    <CardHeader className="bg-slate-50 border-b pb-4">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <FileText className="text-emerald-500 w-5 h-5" />
                            Panduan & Daftar Perintah (Command)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">

                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800">1. Konfigurasi Grup Laporan (Penting)</h3>
                            <p className="text-slate-600 text-sm leading-relaxed">
                                Agar sistem dapat mengirim laporan shift secara otomatis, sistem harus mengetahui "ID Grup WhatsApp".
                                <br /><br />
                                <strong>Langkah Pengaturan Awal:</strong>
                                <ol className="list-decimal ml-5 mt-2 space-y-1">
                                    <li>Masukkan nomor bot ini (yang baru saja Anda Scan QR-nya) ke dalam Grup WhatsApp tujuan pelaporan.</li>
                                    <li>Ketikkan <code>!getgroupid</code> di dalam grup tersebut.</li>
                                    <li>Bot akan membalas dengan sederet angka berakhiran <code>@g.us</code>.</li>
                                    <li>Salin ID tersebut dan pastikan sudah dimasukkan ke variabel <code>WHATSAPP_REPORT_GROUP_ID</code> di server/komputer Anda, lalu restart server (npm run dev).</li>
                                </ol>
                            </p>
                        </div>

                        <div className="space-y-3">
                            <h3 className="font-bold text-slate-800">2. Daftar Perintah Bot Terdaftar</h3>
                            <div className="bg-slate-50 border rounded-lg p-0 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 border-b text-slate-700">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">Perintah (Command)</th>
                                            <th className="px-4 py-3 font-semibold">Fungsi / Respons</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 text-slate-600">
                                        <tr>
                                            <td className="px-4 py-3 font-mono text-indigo-600 font-medium">!getgroupid</td>
                                            <td className="px-4 py-3">Mendapatkan ID unik dari grup WhatsApp saat ini (Hanya merespons jika diketik di dalam sebuah Grup).</td>
                                        </tr>
                                        <tr>
                                            <td className="px-4 py-3 font-mono text-indigo-600 font-medium">!botadmin status</td>
                                            <td className="px-4 py-3">Mengecek koneksi server dan memastikan apakah Bot POS Online dan merespons.</td>
                                        </tr>
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
