"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Check, X, Eye, EyeOff, UserCheck, UserX, Palette } from "lucide-react";
import { getDesigners, createDesigner, updateDesigner, deleteDesigner, type Designer } from "@/lib/api/designers";

export default function DesignersSettingsPage() {
    const qc = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [editId, setEditId] = useState<number | null>(null);
    const [name, setName] = useState("");
    const [pin, setPin] = useState("");
    const [branchName, setBranchName] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    const { data: designers = [], isLoading } = useQuery<Designer[]>({
        queryKey: ["designers"],
        queryFn: getDesigners,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["designers"] });

    const createMut = useMutation({
        mutationFn: (d: Parameters<typeof createDesigner>[0]) => createDesigner(d),
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
    });

    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateDesigner(id, data),
        onSuccess: () => { invalidate(); resetForm(); },
        onError: (e: any) => setError(e?.response?.data?.message || "Gagal menyimpan"),
    });

    const deleteMut = useMutation({
        mutationFn: deleteDesigner,
        onSuccess: () => { invalidate(); setDeleteConfirm(null); },
    });

    const toggleActiveMut = useMutation({
        mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) => updateDesigner(id, { isActive }),
        onSuccess: invalidate,
    });

    function resetForm() {
        setShowForm(false); setEditId(null); setName(""); setPin(""); setBranchName(""); setError(null);
    }

    function startEdit(d: Designer) {
        setEditId(d.id); setName(d.name); setPin(""); setBranchName((d as any).branchName || ""); setShowForm(true); setError(null);
    }

    function handleSave() {
        setError(null);
        if (!name.trim()) { setError("Nama wajib diisi"); return; }
        if (!editId && !pin.trim()) { setError("PIN wajib diisi saat tambah desainer baru"); return; }
        if (editId) {
            const upd: any = { name: name.trim(), branchName: branchName.trim() || null };
            if (pin.trim()) upd.pin = pin.trim();
            updateMut.mutate({ id: editId, data: upd });
        } else {
            if (pin.length < 4) { setError("PIN minimal 4 karakter"); return; }
            createMut.mutate({ name: name.trim(), pin: pin.trim(), branchName: branchName.trim() || undefined });
        }
    }

    const isSaving = createMut.isPending || updateMut.isPending;

    return (
        <div className="p-6 space-y-5 max-w-3xl">
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                        <Palette className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Kelola Desainer</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Daftar desainer yang bisa akses portal SO via PIN tanpa login akun.
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => { resetForm(); setShowForm(true); }}
                    className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
                >
                    <Plus className="h-4 w-4" /> Tambah Desainer
                </button>
            </div>

            {/* Form tambah / edit */}
            {showForm && (
                <div className="bg-card border border-border rounded-lg p-4 space-y-3">
                    <h2 className="text-sm font-semibold">{editId ? "Edit Desainer" : "Tambah Desainer Baru"}</h2>
                    {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded px-3 py-2">{error}</div>}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">Nama *</label>
                            <input value={name} onChange={e => setName(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                                placeholder="Nama desainer" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">
                                PIN {editId && <span className="text-muted-foreground font-normal">(kosongkan = tidak ubah)</span>}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPin ? "text" : "password"}
                                    value={pin}
                                    onChange={e => setPin(e.target.value)}
                                    className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background pr-9 tracking-widest"
                                    placeholder={editId ? "Biarkan kosong" : "Min. 4 karakter"}
                                    maxLength={10}
                                />
                                <button onClick={() => setShowPin(p => !p)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>
                        <div className="col-span-2">
                            <label className="text-xs font-medium text-muted-foreground block mb-1">
                                Nama Cabang <span className="font-normal">(opsional — kosongkan jika desainer di Pusat)</span>
                            </label>
                            <input value={branchName} onChange={e => setBranchName(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background"
                                placeholder="Contoh: Cabang Ngasem, Cabang Bantul..." />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={resetForm} className="px-3 py-1.5 text-sm border border-border rounded-md hover:bg-muted">Batal</button>
                        <button onClick={handleSave} disabled={isSaving}
                            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-sm hover:opacity-90 disabled:opacity-50">
                            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                            Simpan
                        </button>
                    </div>
                </div>
            )}

            {/* Daftar */}
            <div className="bg-card border border-border rounded-lg overflow-hidden">
                {isLoading ? (
                    <div className="p-10 flex justify-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : designers.length === 0 ? (
                    <div className="p-10 text-center text-muted-foreground text-sm">
                        Belum ada desainer terdaftar. Klik &ldquo;Tambah Desainer&rdquo; untuk memulai.
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                            <tr>
                                <th className="px-4 py-2 text-left font-medium">Nama</th>
                                <th className="px-4 py-2 text-left font-medium">Cabang</th>
                                <th className="px-4 py-2 text-left font-medium">PIN</th>
                                <th className="px-4 py-2 text-center font-medium">Status</th>
                                <th className="px-4 py-2 text-right font-medium">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {designers.map(d => (
                                <tr key={d.id} className={`hover:bg-muted/20 ${!d.isActive ? "opacity-50" : ""}`}>
                                    <td className="px-4 py-2 font-medium">{d.name}</td>
                                    <td className="px-4 py-2 text-sm text-muted-foreground">
                                        {(d as any).branchName ? (
                                            <span className="bg-blue-50 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">{(d as any).branchName}</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50">Pusat</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-2 font-mono text-xs tracking-widest text-muted-foreground">
                                        {"•".repeat(d.pin.length)}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${d.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>
                                            {d.isActive ? "Aktif" : "Nonaktif"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2">
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => toggleActiveMut.mutate({ id: d.id, isActive: !d.isActive })}
                                                className={`p-1.5 rounded hover:bg-muted ${d.isActive ? "text-amber-600" : "text-emerald-600"}`}
                                                title={d.isActive ? "Nonaktifkan" : "Aktifkan"}
                                            >
                                                {d.isActive ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                                            </button>
                                            <button onClick={() => startEdit(d)}
                                                className="p-1.5 rounded hover:bg-muted text-slate-600" title="Edit">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            {deleteConfirm === d.id ? (
                                                <div className="flex gap-1">
                                                    <button onClick={() => deleteMut.mutate(d.id)}
                                                        className="p-1.5 rounded bg-red-100 text-red-600 hover:bg-red-200">
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={() => setDeleteConfirm(null)}
                                                        className="p-1.5 rounded hover:bg-muted text-slate-500">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setDeleteConfirm(d.id)}
                                                    className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Hapus">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                <strong>Cara akses:</strong> Desainer buka <code className="bg-blue-100 px-1 rounded">/so-designer</code> di browser, pilih nama & masukkan PIN → langsung bisa buat Surat Order tanpa login akun. Sesi tersimpan hanya selama tab browser terbuka.
            </div>
        </div>
    );
}
