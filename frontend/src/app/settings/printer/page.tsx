'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/api/client';
import {
    listPrinterDevices,
    createPrinterDevice,
    deletePrinterDevice,
    rotatePrinterToken,
    updatePrinterDevice,
    type PrinterDeviceDTO,
} from '@/lib/api/printer-relay';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Printer, Usb, Bluetooth, RotateCw, Trash2, Copy, Plus, Wifi, WifiOff, Download } from 'lucide-react';

interface Branch {
    id: number;
    name: string;
    code?: string | null;
}

const fetchBranches = () => axios.get<Branch[]>('/company-branches/active').then((r) => r.data);

// Base URL backend untuk perintah agen. NEXT_PUBLIC_API_URL bila diset, else origin app.
const backendUrl = (
    process.env.NEXT_PUBLIC_API_URL ||
    (typeof window !== 'undefined' ? window.location.origin : '')
).replace(/\/$/, '');

const agentCmd = (d: PrinterDeviceDTO) =>
    `python agent.py --url ${backendUrl} --token ${d.token} ` +
    (d.connection === 'bluetooth' ? '--mac <MAC_PRINTER>' : '--com COM5');

// Bangun start-agent.bat yang: cek Python, pasang pyserial, unduh agent.py, lalu
// jalan — token/URL/target sudah terisi. Di komputer toko cukup dobel-klik.
// Selalu berakhir di :end + pause supaya jendela TAK menutup sendiri saat error.
const buildBat = (d: PrinterDeviceDTO): string => {
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const isBt = d.connection === 'bluetooth';
    const target = d.target || (isBt ? '<MAC_PRINTER>' : 'COM5');
    const runArg = isBt ? '--mac %TARGET%' : '--com %TARGET%';
    const safeName = d.name.replace(/[^\w \-]/g, '').slice(0, 50) || 'Printer';
    return [
        '@echo off',
        'setlocal',
        `title Print Relay Agent - ${safeName}`,
        'cd /d "%~dp0"',
        '',
        `REM Printer ${safeName} (cabang ${d.branchId}). Dobel-klik di komputer yang colok printer.`,
        isBt
            ? 'REM Bluetooth: kalau perlu, ganti TARGET dgn MAC printer (atau COM outgoing di Windows).'
            : 'REM USB: kalau COM5 salah, ganti TARGET dgn COM port printer Anda.',
        '',
        `set "URL=${backendUrl}"`,
        `set "TOKEN=${d.token}"`,
        `set "TARGET=${target}"`,
        `set "AGENT_SRC=${appOrigin}/print-agent/agent.py"`,
        '',
        `echo === Print Relay Agent: ${safeName} ===`,
        'echo.',
        'where python >nul 2>nul',
        'if errorlevel 1 (',
        '  echo [ERROR] Python belum terinstal.',
        '  echo Install dari https://www.python.org/downloads/ - centang "Add Python to PATH" - lalu jalankan ulang file ini.',
        '  goto :end',
        ')',
        'python -c "import serial" >nul 2>nul',
        'if errorlevel 1 (',
        '  echo Memasang pyserial...',
        '  python -m pip install pyserial',
        ')',
        'if not exist "agent.py" (',
        '  echo Mengunduh agent.py...',
        `  powershell -NoProfile -Command "try{ Invoke-WebRequest -Uri '%AGENT_SRC%' -OutFile 'agent.py' }catch{ exit 1 }"`,
        '  if errorlevel 1 (',
        '    echo [ERROR] Gagal mengunduh agent.py dari %AGENT_SRC%',
        '    goto :end',
        '  )',
        ')',
        'echo Menjalankan agen... biarkan jendela ini TETAP TERBUKA.',
        'echo.',
        `python agent.py --url %URL% --token %TOKEN% ${runArg}`,
        '',
        ':end',
        'echo.',
        'pause',
        '',
    ].join('\r\n');
};

export default function PrinterSettingsPage() {
    const qc = useQueryClient();
    const { data: branches = [] } = useQuery({
        queryKey: ['company-branches-active'],
        queryFn: fetchBranches,
    });

    const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
    useEffect(() => {
        if (activeBranchId == null && branches.length > 0) setActiveBranchId(branches[0].id);
    }, [branches, activeBranchId]);

    const { data: devices = [], refetch } = useQuery({
        queryKey: ['printer-devices', activeBranchId],
        queryFn: () => listPrinterDevices(activeBranchId ?? undefined),
        enabled: activeBranchId != null,
        refetchInterval: 10_000, // segarkan status online berkala
    });

    const [name, setName] = useState('');
    const [connection, setConnection] = useState<'usb' | 'bluetooth'>('usb');
    const [target, setTarget] = useState('');

    const invalidate = () => qc.invalidateQueries({ queryKey: ['printer-devices', activeBranchId] });

    const createMut = useMutation({
        mutationFn: () =>
            createPrinterDevice({
                branchId: activeBranchId!,
                name: name.trim() || 'Printer',
                connection,
                target: target.trim() || null,
            }),
        onSuccess: () => {
            setName('');
            setTarget('');
            invalidate();
        },
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || e.message}`),
    });

    const rotateMut = useMutation({
        mutationFn: (id: number) => rotatePrinterToken(id),
        onSuccess: invalidate,
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || e.message}`),
    });

    const deleteMut = useMutation({
        mutationFn: (id: number) => deletePrinterDevice(id),
        onSuccess: invalidate,
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || e.message}`),
    });

    const toggleMut = useMutation({
        mutationFn: (d: PrinterDeviceDTO) => updatePrinterDevice(d.id, { isActive: !d.isActive }),
        onSuccess: invalidate,
        onError: (e: any) => alert(`❌ ${e?.response?.data?.message || e.message}`),
    });

    const copy = (text: string) => {
        navigator.clipboard?.writeText(text).then(
            () => {},
            () => {},
        );
    };

    const downloadBat = (d: PrinterDeviceDTO) => {
        const blob = new Blob([buildBat(d)], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `start-agent-${d.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'printer'}.bat`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-start gap-3 pb-4 border-b border-border">
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Printer className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Printer Struk (Printer Server)</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Daftarkan 1 printer per cabang di komputer utama. Semua kasir yang login bisa
                        cetak tanpa pairing — cukup jalankan agen di komputer itu.
                    </p>
                </div>
            </div>

            {/* Pilih cabang */}
            {branches.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {branches.map((b) => (
                        <button
                            key={b.id}
                            onClick={() => setActiveBranchId(b.id)}
                            className={
                                'px-3 py-1.5 rounded-lg text-sm border transition-colors ' +
                                (b.id === activeBranchId
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background border-border hover:bg-muted')
                            }
                        >
                            {b.name}
                        </button>
                    ))}
                </div>
            )}

            {/* Tambah printer */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <h2 className="font-semibold text-sm">Tambah Printer</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Nama printer</Label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="mis. Kasir Depan"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Koneksi ke printer</Label>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setConnection('usb')}
                                className={
                                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm transition-colors ' +
                                    (connection === 'usb'
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-background border-border hover:bg-muted')
                                }
                            >
                                <Usb className="w-4 h-4" /> USB (kabel)
                            </button>
                            <button
                                type="button"
                                onClick={() => setConnection('bluetooth')}
                                className={
                                    'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm transition-colors ' +
                                    (connection === 'bluetooth'
                                        ? 'bg-primary/10 border-primary text-primary'
                                        : 'bg-background border-border hover:bg-muted')
                                }
                            >
                                <Bluetooth className="w-4 h-4" /> Bluetooth
                            </button>
                        </div>
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label>
                        {connection === 'usb' ? 'COM port (opsional)' : 'MAC printer (opsional)'}
                    </Label>
                    <Input
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        placeholder={connection === 'usb' ? 'mis. COM5' : 'mis. 66:32:5C:C4:3B:32'}
                    />
                </div>
                <Button
                    onClick={() => createMut.mutate()}
                    disabled={activeBranchId == null || createMut.isPending}
                >
                    <Plus className="w-4 h-4 mr-1" /> Tambah Printer
                </Button>
            </div>

            {/* Daftar printer */}
            <div className="space-y-3">
                {devices.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                        Belum ada printer terdaftar untuk cabang ini.
                    </p>
                )}
                {devices.map((d) => (
                    <div key={d.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                                {d.connection === 'bluetooth' ? (
                                    <Bluetooth className="w-4 h-4 text-muted-foreground shrink-0" />
                                ) : (
                                    <Usb className="w-4 h-4 text-muted-foreground shrink-0" />
                                )}
                                <span className="font-semibold truncate">{d.name}</span>
                                <span
                                    className={
                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ' +
                                        (d.online
                                            ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                            : 'bg-muted text-muted-foreground border border-border')
                                    }
                                >
                                    {d.online ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                    {d.online ? 'Online' : 'Offline'}
                                </span>
                                {!d.isActive && (
                                    <span className="px-2 py-0.5 rounded-full text-[11px] bg-red-500/10 text-red-600 border border-red-500/20">
                                        Nonaktif
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => toggleMut.mutate(d)}
                                    title={d.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                >
                                    {d.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (confirm('Buat token baru? Agen lama harus diperbarui tokennya.'))
                                            rotateMut.mutate(d.id);
                                    }}
                                    title="Ganti token"
                                >
                                    <RotateCw className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        if (confirm(`Hapus printer "${d.name}"?`)) deleteMut.mutate(d.id);
                                    }}
                                    title="Hapus"
                                >
                                    <Trash2 className="w-4 h-4 text-red-600" />
                                </Button>
                            </div>
                        </div>

                        {/* Cara pasang agen di komputer toko */}
                        <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2.5">
                            <p className="text-xs font-medium">Pasang di komputer toko (yang colok printer):</p>
                            <ol className="text-[11px] text-muted-foreground list-decimal ml-4 space-y-0.5">
                                <li>Install Python sekali dari python.org (centang &quot;Add Python to PATH&quot;).</li>
                                <li>Klik tombol di bawah untuk unduh file <code className="font-mono">.bat</code> (token &amp; URL sudah terisi).</li>
                                <li>Dobel-klik file <code className="font-mono">.bat</code> itu di komputer toko. Selesai — biarkan jendelanya terbuka.</li>
                            </ol>
                            <Button size="sm" onClick={() => downloadBat(d)}>
                                <Download className="w-4 h-4 mr-1.5" /> Download agen (start-agent.bat)
                            </Button>
                            <p className="text-[11px] text-muted-foreground">
                                {d.connection === 'usb'
                                    ? 'File .bat otomatis pasang pyserial & unduh agent.py. Kalau COM port bukan COM5, buka file .bat dgn Notepad & ganti baris TARGET.'
                                    : 'File .bat otomatis pasang pyserial & unduh agent.py. Buka .bat dgn Notepad & isi TARGET dengan MAC printer (atau COM outgoing di Windows).'}
                            </p>
                            <details className="text-[11px]">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Cara manual (Linux / mahir)
                                </summary>
                                <div className="flex items-start gap-2 mt-2">
                                    <code className="flex-1 font-mono break-all bg-background rounded px-2 py-1.5 border border-border">
                                        {agentCmd(d)}
                                    </code>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => copy(agentCmd(d))}
                                        title="Salin perintah"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </details>
                        </div>
                    </div>
                ))}
            </div>

            <p className="text-xs text-muted-foreground">
                Agen ada di <code className="font-mono">tools/print-bridge/agent.py</code> (butuh Python +{' '}
                <code className="font-mono">pip install pyserial</code>). Di Windows bisa pakai{' '}
                <code className="font-mono">start-agent.bat</code>.
            </p>
        </div>
    );
}
