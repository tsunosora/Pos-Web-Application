"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getTaskGroups, createTaskGroup, updateTaskGroup, deleteTaskGroup, getUsers,
    type TaskGroup,
} from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Users, Plus, Loader2, X, Trash2, Pencil, ArrowLeft } from "lucide-react";

type UserLite = { id: number; name: string | null };

export default function GrupTimPage() {
    const { canAssignTasks, currentUser } = useCurrentUser();
    const qc = useQueryClient();
    const [editing, setEditing] = useState<TaskGroup | null>(null);
    const [creating, setCreating] = useState(false);

    const { data: groups = [], isLoading } = useQuery({
        queryKey: ["task-groups"],
        queryFn: getTaskGroups,
        enabled: canAssignTasks,
    });

    const invalidate = () => qc.invalidateQueries({ queryKey: ["task-groups"] });
    const delMut = useMutation({ mutationFn: (id: number) => deleteTaskGroup(id), onSuccess: invalidate });

    if (currentUser === undefined) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }
    if (!canAssignTasks) {
        return (
            <div className="p-4 max-w-2xl mx-auto text-center py-20 text-muted-foreground">
                <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Hanya owner/manajer yang dapat mengelola grup tim.</p>
                <Button variant="outline" size="sm" asChild className="mt-4"><Link href="/tugas"><ArrowLeft className="h-4 w-4" /> Kembali ke Papan Tugas</Link></Button>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-4xl mx-auto">
            <PageHeader
                title="Grup Tim"
                description="Kelompokkan karyawan jadi tim agar mudah diberi tugas sekaligus."
                icon={Users}
                actions={<Button size="sm" onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Grup Baru</Button>}
            />

            {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : groups.length === 0 ? (
                <div className="text-center py-20 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">Belum ada grup tim.</p>
                    <p className="text-xs mt-1">Buat grup untuk memberi tugas ke beberapa karyawan sekaligus.</p>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {groups.map((g) => (
                        <div key={g.id} className="rounded-lg border border-border bg-card p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="font-semibold text-foreground">{g.name}</div>
                                <div className="flex gap-1">
                                    <button onClick={() => setEditing(g)} className="text-muted-foreground hover:text-foreground p-1"><Pencil className="h-4 w-4" /></button>
                                    <button onClick={() => { if (confirm(`Hapus grup "${g.name}"?`)) delMut.mutate(g.id); }} className="text-muted-foreground hover:text-red-500 p-1"><Trash2 className="h-4 w-4" /></button>
                                </div>
                            </div>
                            <div className="text-xs text-muted-foreground mb-1">{g.members.length} anggota</div>
                            <div className="flex flex-wrap gap-1">
                                {g.members.slice(0, 8).map((m) => (
                                    <span key={m.id} className="text-[11px] rounded-full border border-border px-2 py-0.5 text-foreground">{m.user?.name || `#${m.userId}`}</span>
                                ))}
                                {g.members.length > 8 && <span className="text-[11px] text-muted-foreground px-1">+{g.members.length - 8}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {creating && <GroupModal onClose={() => setCreating(false)} onSaved={() => { invalidate(); setCreating(false); }} />}
            {editing && <GroupModal group={editing} onClose={() => setEditing(null)} onSaved={() => { invalidate(); setEditing(null); }} />}
        </div>
    );
}

function GroupModal({ group, onClose, onSaved }: { group?: TaskGroup; onClose: () => void; onSaved: () => void }) {
    const [name, setName] = useState(group?.name ?? "");
    const [memberIds, setMemberIds] = useState<number[]>(group?.members.map((m) => m.userId) ?? []);
    const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: getUsers });

    const toggle = (id: number) => setMemberIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

    const saveMut = useMutation({
        mutationFn: () => group
            ? updateTaskGroup(group.id, { name, memberIds })
            : createTaskGroup({ name, memberIds }),
        onSuccess: onSaved,
    });

    const sorted = useMemo(() => (users as UserLite[]).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")), [users]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
            <div className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-lg font-bold text-foreground">{group ? "Ubah Grup" : "Grup Baru"}</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
                </div>
                <label className="block text-xs font-medium text-foreground mb-1">Nama grup *</label>
                <input value={name} onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm mb-3" placeholder="mis. Tim Produksi Cabang A" />

                <label className="block text-xs font-medium text-foreground mb-1">Anggota ({memberIds.length})</label>
                <div className="rounded-md border border-border max-h-60 overflow-y-auto divide-y divide-border mb-4">
                    {sorted.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent/50">
                            <input type="checkbox" checked={memberIds.includes(u.id)} onChange={() => toggle(u.id)} className="accent-primary" />
                            <span className="text-foreground">{u.name || `User #${u.id}`}</span>
                        </label>
                    ))}
                </div>

                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={onClose}>Batal</Button>
                    <Button size="sm" onClick={() => saveMut.mutate()} disabled={!name.trim() || saveMut.isPending}>
                        {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Simpan
                    </Button>
                </div>
            </div>
        </div>
    );
}
