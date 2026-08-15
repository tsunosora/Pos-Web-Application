"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRoles, updateRoleMenuAccess, type AppRole } from "@/lib/api";
import {
    configurableSections, presetHrefsFor, MINIMAL_HREFS, MENU_PRESETS,
} from "@/components/layout/nav-config";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Lock, Loader2, Save, RotateCcw, Check, ArrowLeft, Info } from "lucide-react";

const OWNER_KEYWORDS = ["owner", "superadmin", "super_admin", "super admin", "pemilik"];
const MANAGER_KEYWORDS = ["admin", "manajer", "manager", "supervisor", "kepala"];
const isFullAccessRole = (name: string) => {
    const n = name.toLowerCase();
    return OWNER_KEYWORDS.includes(n) || MANAGER_KEYWORDS.some((k) => n.includes(k));
};

const ALWAYS_ON = "/beranda"; // selalu boleh dilihat tiap staf

export default function AksesMenuPage() {
    const { isOwner, currentUser } = useCurrentUser();
    const qc = useQueryClient();
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const { data: roles = [], isLoading } = useQuery({ queryKey: ["roles"], queryFn: getRoles, enabled: isOwner });

    const groups = useMemo(() => configurableSections(), []);
    const selected = roles.find((r) => r.id === selectedId) || null;

    if (currentUser === undefined) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
    }
    if (!isOwner) {
        return (
            <div className="p-4 max-w-2xl mx-auto text-center py-20 text-muted-foreground">
                <Lock className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="text-sm">Halaman ini khusus owner.</p>
                <Button variant="outline" size="sm" asChild className="mt-4"><Link href="/"><ArrowLeft className="h-4 w-4" /> Kembali</Link></Button>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-[80rem] mx-auto">
            <PageHeader
                title="Akses Menu per Role"
                description="Batasi menu yang dilihat tiap divisi agar staf tidak bingung dengan fitur yang bukan tugasnya."
                icon={Lock}
            />

            <div className="mb-4 rounded-lg border border-border bg-accent/40 px-4 py-3 text-xs text-muted-foreground flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 mt-0.5" />
                <span>Role <b>Owner &amp; Manajer/Admin</b> selalu melihat semua menu (tak bisa dibatasi). Role lain yang belum diatur otomatis memakai <b>preset divisi</b> (Kasir/CS/Desainer/Operator) atau set minimal (Beranda, Tugas, Leaderboard) bila tak cocok preset.</span>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : (
                <div className="grid md:grid-cols-[220px_1fr] gap-4">
                    {/* Daftar role */}
                    <div className="rounded-lg border border-border bg-card p-2 h-fit">
                        <div className="text-[11px] font-medium text-muted-foreground px-2 py-1">Pilih role</div>
                        <ul className="space-y-0.5">
                            {roles.map((r) => {
                                const full = isFullAccessRole(r.name);
                                const custom = r.menuAccess != null;
                                return (
                                    <li key={r.id}>
                                        <button
                                            onClick={() => setSelectedId(r.id)}
                                            className={`w-full text-left rounded-md px-2.5 py-2 text-sm transition flex items-center justify-between gap-2 ${selectedId === r.id ? "bg-accent text-accent-foreground font-medium" : "hover:bg-accent/50 text-foreground"}`}
                                        >
                                            <span className="truncate">{r.name}</span>
                                            <span className={`shrink-0 text-[9px] rounded-full px-1.5 py-0.5 border ${full ? "border-border text-muted-foreground" : custom ? "border-primary/40 text-primary" : "border-border text-muted-foreground"}`}>
                                                {full ? "Semua" : custom ? "Kustom" : "Preset"}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    {/* Editor akses */}
                    <div>
                        {!selected ? (
                            <div className="rounded-lg border border-border bg-card px-4 py-16 text-center text-sm text-muted-foreground">
                                Pilih role di kiri untuk mengatur menunya.
                            </div>
                        ) : isFullAccessRole(selected.name) ? (
                            <div className="rounded-lg border border-border bg-card px-4 py-16 text-center text-sm text-muted-foreground">
                                <b className="text-foreground">{selected.name}</b> adalah role owner/manajer — otomatis melihat <b>semua menu</b> dan tidak bisa dibatasi.
                            </div>
                        ) : (
                            <RoleEditor
                                key={selected.id}
                                role={selected}
                                groups={groups}
                                onSaved={() => qc.invalidateQueries({ queryKey: ["roles"] })}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

function RoleEditor({ role, groups, onSaved }: {
    role: AppRole;
    groups: { key: string; label: string; items: { name: string; href: string }[] }[];
    onSaved: () => void;
}) {
    // Set efektif awal: kalau sudah dikonfigurasi pakai itu, kalau belum pakai preset/minimal.
    const initial = useMemo<string[]>(
        () => role.menuAccess ?? presetHrefsFor(role.name) ?? MINIMAL_HREFS,
        [role],
    );
    const [checked, setChecked] = useState<Set<string>>(new Set(initial));
    useEffect(() => setChecked(new Set(initial)), [initial]);

    const presetLabel = MENU_PRESETS.find((p) => p.match(role.name.toLowerCase()))?.label;

    const toggle = (href: string) => setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(href)) next.delete(href); else next.add(href);
        next.add(ALWAYS_ON); // beranda selalu aktif
        return next;
    });
    const toggleGroup = (items: { href: string }[], on: boolean) => setChecked((prev) => {
        const next = new Set(prev);
        for (const it of items) { if (on) next.add(it.href); else next.delete(it.href); }
        next.add(ALWAYS_ON);
        return next;
    });

    const saveMut = useMutation({
        mutationFn: (hrefs: string[] | null) => updateRoleMenuAccess(role.id, hrefs),
        onSuccess: onSaved,
    });

    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                    <div className="font-semibold text-foreground">{role.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                        {role.menuAccess != null ? "Diatur manual (kustom)" : `Belum diatur — pakai preset ${presetLabel ?? "minimal"}`}
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => saveMut.mutate(null)} disabled={saveMut.isPending}
                        title="Kembalikan ke preset divisi otomatis">
                        <RotateCcw className="h-4 w-4" /> Reset preset
                    </Button>
                    <Button size="sm" onClick={() => saveMut.mutate(Array.from(checked))} disabled={saveMut.isPending}>
                        {saveMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Simpan
                    </Button>
                </div>
            </div>

            <div className="space-y-4">
                {groups.map((g) => {
                    const allOn = g.items.every((it) => checked.has(it.href));
                    return (
                        <div key={g.key}>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-semibold text-foreground">{g.label}</span>
                                <button onClick={() => toggleGroup(g.items, !allOn)}
                                    className="text-[11px] text-primary hover:underline">
                                    {allOn ? "Kosongkan" : "Pilih semua"}
                                </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {g.items.map((it) => {
                                    const on = checked.has(it.href);
                                    const locked = it.href === ALWAYS_ON;
                                    return (
                                        <button key={it.href} onClick={() => !locked && toggle(it.href)} disabled={locked}
                                            className={`flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs text-left transition ${on ? "border-primary/50 bg-primary/5 text-foreground" : "border-border text-muted-foreground hover:bg-accent/40"} ${locked ? "opacity-70 cursor-default" : ""}`}>
                                            <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}>
                                                {on && <Check className="h-3 w-3" />}
                                            </span>
                                            <span className="truncate">{it.name}{locked && " (wajib)"}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
