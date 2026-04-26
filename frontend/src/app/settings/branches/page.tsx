'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from '@/lib/api/client';
import Link from 'next/link';
import { Building2, Plus, Pencil, Trash2, Check, X, Settings2 } from 'lucide-react';

interface Branch {
    id: number;
    name: string;
    code: string | null;
    address: string | null;
    phone: string | null;
    notaHeader: string | null;
    notaFooter: string | null;
    logoUrl: string | null;
    isActive: boolean;
    createdAt: string;
}

const fetchBranches = () =>
    axios.get<Branch[]>('/company-branches').then(r => r.data);

export default function BranchesSettingsPage() {
    const qc = useQueryClient();
    const { data: branches = [], isLoading } = useQuery({
        queryKey: ['company-branches'],
        queryFn: fetchBranches,
    });

    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    // Catatan: form halaman ini SENGAJA hanya menangani identitas tenant (name, code, isActive).
    // Alamat, telepon, logo, header/footer nota, PIN operator, WA group — dikelola di
    // /settings/branch-config (tabel BranchSettings) karena itu yang dibaca nota & POS.
    const [form, setForm] = useState({ name: '', code: '' });
    const [deleteId, setDeleteId] = useState<number | null>(null);
    const [error, setError] = useState('');

    const createMut = useMutation({
        mutationFn: (d: { name: string; code?: string | null }) =>
            axios.post('/company-branches', d).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['company-branches'] });
            // Ganti code/name cabang ikut dipakai BranchSettings.getOne — invalidate supaya POS & nota refresh.
            qc.invalidateQueries({ queryKey: ['branch-settings'] });
            qc.invalidateQueries({ queryKey: ['branches'] });
            resetForm();
        },
        onError: (e: any) => setError(e?.response?.data?.message || 'Gagal menyimpan'),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, d }: { id: number; d: any }) =>
            axios.patch(`/company-branches/${id}`, d).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['company-branches'] });
            // Ganti code/name cabang ikut dipakai BranchSettings.getOne — invalidate supaya POS & nota refresh.
            qc.invalidateQueries({ queryKey: ['branch-settings'] });
            qc.invalidateQueries({ queryKey: ['branches'] });
            resetForm();
        },
        onError: (e: any) => setError(e?.response?.data?.message || 'Gagal menyimpan'),
    });

    const deleteMut = useMutation({
        mutationFn: (id: number) =>
            axios.delete(`/company-branches/${id}`).then(r => r.data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['company-branches'] }); setDeleteId(null); },
        onError: (e: any) => setError(e?.response?.data?.message || 'Gagal menghapus'),
    });

    const toggleActiveMut = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
            axios.patch(`/company-branches/${id}`, { isActive }).then(r => r.data),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['company-branches'] });
            qc.invalidateQueries({ queryKey: ['branch-settings'] });
            qc.invalidateQueries({ queryKey: ['branches'] });
        },
    });

    function resetForm() {
        setShowForm(false);
        setEditId(null);
        setForm({ name: '', code: '' });
        setError('');
    }

    function startEdit(b: Branch) {
        setEditId(b.id);
        setForm({ name: b.name, code: b.code ?? '' });
        setShowForm(true);
        setError('');
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!form.name.trim()) { setError('Nama cabang wajib diisi'); return; }
        const payload: any = {
            name: form.name.trim(),
            code: form.code.trim() || null,
        };
        if (editId) {
            updateMut.mutate({ id: editId, d: payload });
        } else {
            createMut.mutate(payload);
        }
    }

    const isSaving = createMut.isPending || updateMut.isPending;

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                        <Building2 className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Kelola Cabang Perusahaan</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Daftar cabang/outlet untuk multi-tenant scoping data operasional.
                        </p>
                    </div>
                </div>
                {!showForm && (
                    <button
                        onClick={() => { setShowForm(true); setError(''); }}
                        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
                    >
                        <Plus className="h-4 w-4" /> Tambah Cabang
                    </button>
                )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 flex gap-2">
                <Settings2 className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                    Halaman ini hanya untuk <strong>identitas cabang</strong> (nama, kode, aktif/nonaktif).
                    Untuk mengatur <strong>alamat, telepon, logo, header/footer nota, PIN operator, dan WhatsApp group</strong>,
                    buka <Link href="/settings/branch-config" className="underline font-medium">Pengaturan Per Cabang</Link>.
                </div>
            </div>

            {showForm && (
                <form onSubmit={handleSubmit} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <h3 className="font-medium text-gray-700">{editId ? 'Edit Cabang' : 'Cabang Baru'}</h3>
                    {error && <p className="text-red-600 text-sm">{error}</p>}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                            <label className="block text-xs text-gray-500 mb-1">Nama Cabang *</label>
                            <input
                                value={form.name}
                                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                                placeholder="cth: Cabang Bantul"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">Kode</label>
                            <input
                                value={form.code}
                                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                                maxLength={20}
                                className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm uppercase"
                                placeholder="cth: BTL"
                            />
                        </div>
                    </div>
                    <p className="text-xs text-gray-500">
                        Setelah menyimpan, lanjutkan ke{' '}
                        <Link href="/settings/branch-config" className="underline text-blue-600">
                            Pengaturan Per Cabang
                        </Link>{' '}
                        untuk mengisi alamat, HP, logo, dan nota cetak.
                    </p>
                    <div className="flex gap-2 pt-1">
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                            {isSaving ? 'Menyimpan...' : 'Simpan'}
                        </button>
                        <button type="button" onClick={resetForm} className="text-sm text-gray-500 hover:text-gray-700">
                            Batal
                        </button>
                    </div>
                </form>
            )}

            {error && !showForm && <p className="text-red-600 text-sm">{error}</p>}

            {isLoading ? (
                <p className="text-gray-500 text-sm">Memuat...</p>
            ) : branches.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Belum ada cabang terdaftar.</p>
            ) : (
                <div className="space-y-2">
                    {branches.map(b => (
                        <div key={b.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${b.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <div>
                                    <p className="font-medium text-gray-800 text-sm flex items-center gap-2">
                                        {b.name}
                                        {b.code && (
                                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                                {b.code}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {b.isActive ? 'Aktif' : 'Nonaktif'} · ID: {b.id}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Link
                                    href="/settings/branch-config"
                                    title="Pengaturan nota, alamat, PIN, WA"
                                    className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg"
                                >
                                    <Settings2 className="w-4 h-4" />
                                </Link>
                                <button
                                    onClick={() => toggleActiveMut.mutate({ id: b.id, isActive: !b.isActive })}
                                    title={b.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                                    className={`p-1.5 rounded-lg text-xs ${b.isActive ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                                >
                                    {b.isActive ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => startEdit(b)}
                                    title="Edit nama/kode"
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => { setDeleteId(b.id); setError(''); }}
                                    title="Hapus cabang"
                                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete confirm modal */}
            {deleteId && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full">
                        <h3 className="font-semibold text-gray-800 mb-2">Hapus Cabang?</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Cabang tidak dapat dihapus jika masih memiliki work order aktif (Antrian/Proses).
                        </p>
                        {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setError(''); deleteMut.mutate(deleteId); }}
                                disabled={deleteMut.isPending}
                                className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleteMut.isPending ? 'Menghapus...' : 'Hapus'}
                            </button>
                            <button
                                onClick={() => { setDeleteId(null); setError(''); }}
                                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm hover:bg-gray-50"
                            >
                                Batal
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
