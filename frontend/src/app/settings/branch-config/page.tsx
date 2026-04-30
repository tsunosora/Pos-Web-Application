'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Save } from 'lucide-react';

interface Branch {
    id: number;
    name: string;
    code?: string | null;
}

interface BranchSettings {
    operatorPin?: string | null;
    waReportGroupId?: string | null;
    waBroadcastGroups?: string[] | null;
    waDesignGroupId?: string | null;
    storeName?: string | null;
    storeAddress?: string | null;
    storePhone?: string | null;
    notaHeader?: string | null;
    notaFooter?: string | null;
    logoUrl?: string | null;
    titipanFeePercent?: number | null;
}

const fetchBranches = () => axios.get<Branch[]>('/company-branches/active').then(r => r.data);

export default function BranchConfigPage() {
    const qc = useQueryClient();
    const { data: branches = [] } = useQuery({
        queryKey: ['company-branches-active'],
        queryFn: fetchBranches,
    });

    const [activeBranchId, setActiveBranchId] = useState<number | null>(null);
    useEffect(() => {
        if (activeBranchId == null && branches.length > 0) setActiveBranchId(branches[0].id);
    }, [branches, activeBranchId]);

    const { data: detail } = useQuery({
        queryKey: ['branch-settings', activeBranchId],
        queryFn: () => axios.get(`/branch-settings/${activeBranchId}`).then(r => r.data),
        enabled: activeBranchId != null,
    });

    const [form, setForm] = useState<BranchSettings>({});
    const [waBroadcastRaw, setWaBroadcastRaw] = useState<string>('');

    useEffect(() => {
        if (detail?.settings) {
            setForm(detail.settings);
            const groups = (detail.settings.waBroadcastGroups || []) as string[];
            setWaBroadcastRaw(Array.isArray(groups) ? groups.join('\n') : '');
        } else if (detail) {
            setForm({});
            setWaBroadcastRaw('');
        }
    }, [detail]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const groups = waBroadcastRaw
                .split('\n')
                .map(s => s.trim())
                .filter(Boolean);
            const payload: BranchSettings = { ...form, waBroadcastGroups: groups };
            return axios.put(`/branch-settings/${activeBranchId}`, payload).then(r => r.data);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['branch-settings', activeBranchId] });
            alert('✅ Pengaturan cabang tersimpan');
        },
        onError: (err: any) => {
            alert(`❌ Gagal: ${err?.response?.data?.message || err.message}`);
        },
    });

    const upd = <K extends keyof BranchSettings>(key: K, value: BranchSettings[K]) =>
        setForm(f => ({ ...f, [key]: value }));

    return (
        <div className="space-y-6 p-6">
            <div className="flex items-start gap-3 pb-4 border-b border-border">
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Building2 className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Pengaturan Per Cabang</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Operator PIN, WhatsApp group, identitas nota — diatur per cabang.
                    </p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Pilih Cabang</CardTitle>
                    <CardDescription>Setiap cabang punya konfigurasi sendiri.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {branches.map(b => (
                            <Button
                                key={b.id}
                                variant={activeBranchId === b.id ? 'default' : 'outline'}
                                onClick={() => setActiveBranchId(b.id)}
                            >
                                {b.name} {b.code ? `(${b.code})` : ''}
                            </Button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {activeBranchId != null && (
                <>
                    <Card>
                        <CardHeader>
                            <CardTitle>Operator PIN</CardTitle>
                            <CardDescription>
                                PIN yang dipakai operator untuk masuk ke halaman <code>/produksi</code>.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Label htmlFor="operatorPin">PIN Operator</Label>
                            <Input
                                id="operatorPin"
                                type="text"
                                placeholder="6 digit"
                                value={form.operatorPin ?? ''}
                                onChange={e => upd('operatorPin', e.target.value)}
                            />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Titipan Antar Cabang (Opsional)</CardTitle>
                            <CardDescription>
                                Default <strong>0%</strong> — sesuai konsep 1 owner / 1 perusahaan: cabang ganti real cost saja
                                (bahan + biaya klik), <em>tanpa margin antar cabang</em>. Hanya berlaku untuk titipan paper print
                                (yang punya biaya klik mesin) — titipan banner tidak masuk Buku Titipan, cuma tracking di
                                <a href="/reports/inter-branch-usage" className="text-primary underline ml-1">Laporan Bahan Titipan</a>.
                                Naikkan hanya kalau setup berubah jadi multi-pemilik / franchise.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Label htmlFor="titipanFeePercent">Fee Titipan Masuk (%)</Label>
                            <Input
                                id="titipanFeePercent"
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                placeholder="0"
                                value={form.titipanFeePercent ?? ''}
                                onChange={e => upd('titipanFeePercent', e.target.value === '' ? null : Number(e.target.value))}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Contoh dengan fee 0%: bahan kertas Rp 5.000 + biaya klik Rp 8.000 = hutang Rp 13.000 (real cost saja).
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>WhatsApp Group</CardTitle>
                            <CardDescription>
                                ID group WA per cabang. Laporan shift, broadcast, & desain dikirim ke group masing-masing.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <Label>Report Group ID (Shift Close)</Label>
                                <Input
                                    placeholder="120363xxxxx@g.us"
                                    value={form.waReportGroupId ?? ''}
                                    onChange={e => upd('waReportGroupId', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Broadcast Groups (1 group ID per baris)</Label>
                                <Textarea
                                    rows={4}
                                    placeholder="120363aaa@g.us&#10;120363bbb@g.us"
                                    value={waBroadcastRaw}
                                    onChange={e => setWaBroadcastRaw(e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Design Group ID</Label>
                                <Input
                                    placeholder="120363xxxxx@g.us"
                                    value={form.waDesignGroupId ?? ''}
                                    onChange={e => upd('waDesignGroupId', e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Identitas Cabang & Nota</CardTitle>
                            <CardDescription>
                                Tampil di nota cetak. Kalau kosong, fallback ke pengaturan global toko.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div>
                                <Label>Nama Toko</Label>
                                <Input
                                    value={form.storeName ?? ''}
                                    onChange={e => upd('storeName', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Alamat</Label>
                                <Textarea
                                    rows={2}
                                    value={form.storeAddress ?? ''}
                                    onChange={e => upd('storeAddress', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Telepon</Label>
                                <Input
                                    value={form.storePhone ?? ''}
                                    onChange={e => upd('storePhone', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>URL Logo</Label>
                                <Input
                                    placeholder="https://..."
                                    value={form.logoUrl ?? ''}
                                    onChange={e => upd('logoUrl', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Header Nota</Label>
                                <Textarea
                                    rows={2}
                                    placeholder="Terima kasih telah berbelanja..."
                                    value={form.notaHeader ?? ''}
                                    onChange={e => upd('notaHeader', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Footer Nota</Label>
                                <Textarea
                                    rows={2}
                                    value={form.notaFooter ?? ''}
                                    onChange={e => upd('notaFooter', e.target.value)}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end">
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={saveMutation.isPending}
                            className="gap-2"
                        >
                            <Save className="w-4 h-4" />
                            {saveMutation.isPending ? 'Menyimpan…' : 'Simpan Pengaturan'}
                        </Button>
                    </div>
                </>
            )}
        </div>
    );
}
