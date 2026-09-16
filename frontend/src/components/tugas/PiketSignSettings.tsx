"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSignature, Loader2, Plus, Save, X } from "lucide-react";
import { getPiketSignatures, getRoles, getUsers, setPiketSignatures, type PiketSignSlot } from "@/lib/api";
import { useCurrentUser } from "@/hooks/useCurrentUser";

const DEFAULT_SLOTS: PiketSignSlot[] = [
    { label: "Dibuat oleh", userId: null, roleId: null },
    { label: "Mengetahui", userId: null, roleId: null },
];
const MAX_SLOT = 3;

const valueOf = (s: PiketSignSlot) => (s.userId ? `u:${s.userId}` : s.roleId ? `r:${s.roleId}` : "");

/**
 * Tanda tangan di PDF jadwal piket — owner/manajer memilih orang atau jabatan.
 * Kosong = dicetak titik-titik untuk tanda tangan manual.
 */
export function PiketSignSettings() {
    const { canAssignTasks } = useCurrentUser();
    const qc = useQueryClient();
    const { data } = useQuery({ queryKey: ["piket-sign"], queryFn: getPiketSignatures, enabled: canAssignTasks });
    const { data: users = [] } = useQuery<{ id: number; name: string | null }[]>({
        queryKey: ["users"], queryFn: getUsers, enabled: canAssignTasks,
    });
    const { data: roles = [] } = useQuery<{ id: number; name: string }[]>({
        queryKey: ["roles"], queryFn: getRoles, enabled: canAssignTasks,
    });
    const [edited, setEdited] = useState<PiketSignSlot[] | null>(null);

    const mut = useMutation({
        mutationFn: (list: PiketSignSlot[]) => setPiketSignatures(list),
        onSuccess: (res) => {
            setEdited(null);
            qc.setQueryData(["piket-sign"], res);
        },
    });

    if (!canAssignTasks) return null;

    const slots = edited ?? (data?.signatures?.length ? data.signatures : DEFAULT_SLOTS);
    const patch = (i: number, next: Partial<PiketSignSlot>) =>
        setEdited(slots.map((s, x) => (x === i ? { ...s, ...next } : s)));
    const pick = (i: number, v: string) =>
        patch(i, {
            userId: v.startsWith("u:") ? Number(v.slice(2)) : null,
            roleId: v.startsWith("r:") ? Number(v.slice(2)) : null,
        });
    const errMsg = (mut.error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message;

    return (
        <div className="p-5 rounded-xl border border-border bg-background/50 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Tanda Tangan PDF Jadwal Piket</h2>
            <p className="text-sm text-muted-foreground">
                Siapa yang tanda tangan di kertas jadwal piket (tombol <strong>Unduh jadwal (PDF)</strong> di Papan Piket).
                Pilih <strong>orang</strong> atau <strong>jabatan</strong> — kalau dikosongkan, dicetak titik-titik untuk tanda tangan manual.
            </p>

            <div className="space-y-2">
                {slots.map((s, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2">
                        <input
                            value={s.label}
                            maxLength={40}
                            onChange={(e) => patch(i, { label: e.target.value })}
                            placeholder="Mis. Mengetahui"
                            className="w-40 px-3 py-2 text-sm border border-border bg-background rounded-lg outline-none focus:ring-primary focus:border-primary"
                            aria-label={`Label tanda tangan ${i + 1}`}
                        />
                        <select
                            value={valueOf(s)}
                            onChange={(e) => pick(i, e.target.value)}
                            className="flex-1 min-w-[12rem] px-3 py-2 text-sm border border-border bg-background rounded-lg outline-none focus:ring-primary focus:border-primary"
                            aria-label={`Penanda tangan ${i + 1}`}
                        >
                            <option value="">— Titik-titik (tanda tangan manual) —</option>
                            <optgroup label="Orang">
                                {users.map((u) => (
                                    <option key={`u${u.id}`} value={`u:${u.id}`}>{u.name || `Akun #${u.id}`}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Jabatan">
                                {roles.map((r) => (
                                    <option key={`r${r.id}`} value={`r:${r.id}`}>{r.name}</option>
                                ))}
                            </optgroup>
                        </select>
                        {slots.length > 1 && (
                            <button
                                type="button"
                                onClick={() => setEdited(slots.filter((_, x) => x !== i))}
                                className="rounded-lg border border-border p-2 text-muted-foreground transition hover:bg-accent"
                                aria-label={`Hapus tanda tangan ${i + 1}`}
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                {slots.length < MAX_SLOT && (
                    <button
                        type="button"
                        onClick={() => setEdited([...slots, { label: "Tanda tangan", userId: null, roleId: null }])}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-accent"
                    >
                        <Plus className="h-4 w-4" /> Tambah tanda tangan
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => mut.mutate(slots)}
                    disabled={mut.isPending}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
                >
                    {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan tanda tangan
                </button>
                {mut.isSuccess && !edited && <span className="text-xs font-medium text-emerald-600">Tersimpan.</span>}
                {mut.isError && <span className="text-xs font-medium text-rose-600">{errMsg || "Gagal menyimpan."}</span>}
                <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <FileSignature className="h-4 w-4" /> Berlaku untuk PDF yang diunduh berikutnya
                </span>
            </div>
        </div>
    );
}
