"use client";

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/lib/api';
import { Plus, Pencil, Trash2, Check, X, ChevronRight, FolderOpen, Folder, FolderPlus, FolderTree, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/responsive-table';

interface Category {
    id: number;
    name: string;
    parentId: number | null;
    parent: { id: number; name: string } | null;
    children: { id: number; name: string; parentId: number }[];
}

export default function CategoriesPage() {
    const queryClient = useQueryClient();

    // Form tambah baru
    const [newName, setNewName] = useState('');
    const [newParentId, setNewParentId] = useState<string>('');

    // Edit state
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState('');
    const [editingParentId, setEditingParentId] = useState<string>('');

    // Expand/collapse parent rows
    const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

    // Sub-kategori inline form per parent
    const [addSubFor, setAddSubFor] = useState<number | null>(null);
    const [subName, setSubName] = useState('');

    // Confirm hapus
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const { data: categoriesRaw = [], isLoading } = useQuery({ queryKey: ['categories'], queryFn: getCategories });

    const categories: Category[] = categoriesRaw;

    // Pisahkan parent (tanpa parentId) dan sub-kategori
    const parents = useMemo(() => categories.filter((c: Category) => !c.parentId), [categories]);
    const getChildren = (parentId: number) => categories.filter((c: Category) => c.parentId === parentId);

    // Opsi parent untuk select (hanya parent-level)
    const parentOptions = parents;

    const createMutation = useMutation({
        mutationFn: createCategory,
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setNewName(''); setNewParentId(''); }
    });

    const createSubMutation = useMutation({
        mutationFn: createCategory,
        onSuccess: (_, vars) => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            setAddSubFor(null);
            setSubName('');
            if (vars.parentId) setExpandedIds(prev => new Set([...prev, vars.parentId!]));
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: { name: string; parentId?: number | null } }) => updateCategory(id, data),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setEditingId(null); }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: number) => deleteCategory(id),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categories'] }); setDeletingId(null); }
    });

    const handleCreate = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;
        createMutation.mutate({ name: newName.trim(), parentId: newParentId ? Number(newParentId) : null });
    };

    const handleCreateSub = (e: React.FormEvent, parentId: number) => {
        e.preventDefault();
        if (!subName.trim()) return;
        createSubMutation.mutate({ name: subName.trim(), parentId });
    };

    const startEdit = (cat: Category) => {
        setEditingId(cat.id);
        setEditingName(cat.name);
        setEditingParentId(cat.parentId ? String(cat.parentId) : '');
        setDeletingId(null);
    };

    const saveEdit = () => {
        if (!editingId || !editingName.trim()) return;
        updateMutation.mutate({
            id: editingId,
            data: { name: editingName.trim(), parentId: editingParentId ? Number(editingParentId) : null }
        });
    };

    const toggleExpand = (id: number) => {
        setExpandedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const totalCount = categories.length;
    const parentCount = parents.length;
    const subCount = categories.filter((c: Category) => !!c.parentId).length;

    return (
        <div className="max-w-3xl mx-auto">
            <PageHeader
                title="Manajemen Kategori"
                description={`${totalCount} kategori · ${parentCount} utama, ${subCount} sub-kategori`}
                icon={FolderTree}
                breadcrumbs={[
                    { label: 'Inventori', href: '/inventory' },
                    { label: 'Kategori' },
                ]}
            />

            {/* Form Tambah Kategori */}
            <form onSubmit={handleCreate} className="mb-5 rounded-xl border border-border bg-card p-4 shadow-sm space-y-3">
                <p className="text-sm font-semibold text-foreground">Tambah Kategori</p>
                <div className="flex gap-3">
                    <div className="flex-1 space-y-2">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="Nama kategori baru..."
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary focus:border-primary outline-none text-sm"
                            required
                        />
                        <select
                            value={newParentId}
                            onChange={e => setNewParentId(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-sm appearance-none"
                        >
                            <option value="">— Kategori Utama (tanpa parent) —</option>
                            {parentOptions.map((p: Category) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>
                    <button type="submit" disabled={createMutation.isPending || !newName.trim()}
                        className="self-start flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors text-sm">
                        <Plus className="w-4 h-4" /> Tambah
                    </button>
                </div>
                {newParentId && (
                    <p className="text-[11px] text-muted-foreground">
                        Akan dibuat sebagai sub-kategori dari <strong>{parentOptions.find(p => String(p.id) === newParentId)?.name}</strong>
                    </p>
                )}
            </form>

            {/* Daftar Kategori — Tree View */}
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="px-5 py-10 text-center text-muted-foreground">
                        <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </div>
                ) : parents.length === 0 ? (
                    <EmptyState
                        icon={FolderTree}
                        title="Belum ada kategori"
                        description="Buat kategori utama dulu lewat form di atas, lalu tambah sub-kategori dengan tombol folder+."
                    />
                ) : (
                    <div className="divide-y divide-border/50">
                        {parents.map((cat: Category) => {
                            const children = getChildren(cat.id);
                            const isExpanded = expandedIds.has(cat.id);
                            const isEditing = editingId === cat.id;
                            const isDeleting = deletingId === cat.id;
                            const isAddingSub = addSubFor === cat.id;

                            return (
                                <div key={cat.id}>
                                    {/* Baris Parent */}
                                    <div className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group ${isEditing ? 'bg-primary/5' : ''}`}>
                                        {/* Toggle expand jika ada children */}
                                        <button type="button" onClick={() => children.length > 0 && toggleExpand(cat.id)}
                                            className={`shrink-0 transition-colors ${children.length > 0 ? 'text-muted-foreground hover:text-foreground cursor-pointer' : 'text-muted-foreground/30 cursor-default'}`}>
                                            {children.length > 0
                                                ? (isExpanded ? <FolderOpen className="w-5 h-5 text-primary" /> : <Folder className="w-5 h-5" />)
                                                : <Folder className="w-5 h-5" />
                                            }
                                        </button>

                                        {/* Nama / Edit input */}
                                        <div className="flex-1 min-w-0">
                                            {isEditing ? (
                                                <div className="flex gap-2">
                                                    <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                                                        className="flex-1 px-2 py-1 bg-background border border-primary rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                                    <select value={editingParentId} onChange={e => setEditingParentId(e.target.value)}
                                                        className="px-2 py-1 bg-background border border-border rounded-md text-xs outline-none">
                                                        <option value="">Kategori Utama</option>
                                                        {parentOptions.filter(p => p.id !== cat.id).map((p: Category) => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-semibold text-foreground">{cat.name}</span>
                                                    {children.length > 0 && (
                                                        <button type="button" onClick={() => toggleExpand(cat.id)}
                                                            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors">
                                                            <ChevronRight className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                                            {children.length} sub
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Aksi */}
                                        <div className="flex items-center gap-1 shrink-0">
                                            {isEditing ? (
                                                <>
                                                    <button onClick={saveEdit} disabled={updateMutation.isPending}
                                                        className="p-1.5 rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors" title="Simpan">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setEditingId(null)}
                                                        className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors" title="Batal">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : isDeleting ? (
                                                <>
                                                    <span className="text-xs text-destructive">Hapus?</span>
                                                    <button onClick={() => deleteMutation.mutate(cat.id)} disabled={deleteMutation.isPending}
                                                        className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                                                        <Check className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setDeletingId(null)}
                                                        className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors">
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => { setAddSubFor(isAddingSub ? null : cat.id); setSubName(''); setExpandedIds(prev => new Set([...prev, cat.id])); }}
                                                        className={`p-1.5 rounded-md transition-colors ${isAddingSub ? 'bg-primary/20 text-primary' : 'opacity-0 group-hover:opacity-100 bg-primary/10 text-primary hover:bg-primary/20'}`}
                                                        title="Tambah sub-kategori">
                                                        <FolderPlus className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => startEdit(cat)}
                                                        className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Edit">
                                                        <Pencil className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={() => setDeletingId(cat.id)}
                                                        className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                                        title="Hapus">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Inline form tambah sub-kategori */}
                                    {isAddingSub && (
                                        <form onSubmit={e => handleCreateSub(e, cat.id)}
                                            className="flex items-center gap-2 pl-12 pr-4 py-2 bg-primary/5 border-t border-primary/20">
                                            <FolderPlus className="w-4 h-4 text-primary shrink-0" />
                                            <input autoFocus type="text" value={subName} onChange={e => setSubName(e.target.value)}
                                                placeholder={`Sub-kategori baru di "${cat.name}"...`}
                                                className="flex-1 px-2.5 py-1.5 bg-background border border-primary/40 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                            <button type="submit" disabled={createSubMutation.isPending || !subName.trim()}
                                                className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
                                                Tambah
                                            </button>
                                            <button type="button" onClick={() => setAddSubFor(null)}
                                                className="p-1.5 text-muted-foreground hover:text-foreground">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </form>
                                    )}

                                    {/* Sub-kategori (expanded) */}
                                    {isExpanded && children.length > 0 && (
                                        <div className="bg-muted/20 divide-y divide-border/30">
                                            {children.map((child: any) => {
                                                const isEditingChild = editingId === child.id;
                                                const isDeletingChild = deletingId === child.id;
                                                return (
                                                    <div key={child.id}
                                                        className={`flex items-center gap-3 pl-12 pr-4 py-2.5 hover:bg-muted/40 transition-colors group ${isEditingChild ? 'bg-primary/5' : ''}`}>
                                                        <div className="w-1.5 h-1.5 rounded-full bg-border shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            {isEditingChild ? (
                                                                <div className="flex gap-2">
                                                                    <input autoFocus value={editingName} onChange={e => setEditingName(e.target.value)}
                                                                        onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                                                                        className="flex-1 px-2 py-1 bg-background border border-primary rounded-md text-sm outline-none focus:ring-2 focus:ring-primary/30" />
                                                                    <select value={editingParentId} onChange={e => setEditingParentId(e.target.value)}
                                                                        className="px-2 py-1 bg-background border border-border rounded-md text-xs outline-none">
                                                                        <option value="">Jadikan Kategori Utama</option>
                                                                        {parentOptions.filter(p => p.id !== child.id).map((p: Category) => (
                                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            ) : (
                                                                <span className="text-sm text-foreground">{child.name}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {isEditingChild ? (
                                                                <>
                                                                    <button onClick={saveEdit} disabled={updateMutation.isPending}
                                                                        className="p-1.5 rounded-md bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors">
                                                                        <Check className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => setEditingId(null)}
                                                                        className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors">
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </>
                                                            ) : isDeletingChild ? (
                                                                <>
                                                                    <span className="text-xs text-destructive">Hapus?</span>
                                                                    <button onClick={() => deleteMutation.mutate(child.id)} disabled={deleteMutation.isPending}
                                                                        className="p-1.5 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors">
                                                                        <Check className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => setDeletingId(null)}
                                                                        className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors">
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <button onClick={() => startEdit(child)}
                                                                        className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
                                                                        title="Edit sub-kategori">
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button onClick={() => setDeletingId(child.id)}
                                                                        className="p-1.5 rounded-md bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                                                        title="Hapus sub-kategori">
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
