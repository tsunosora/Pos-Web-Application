"use client";

import { useQuery } from "@tanstack/react-query";
import { getUsers, getRoles, getTaskGroups, type TaskGroup } from "@/lib/api";

export type TaskTarget = {
    type: "user" | "group" | "role" | "all";
    assigneeId: string;
    groupId: string;
    targetRole: string;
};

export const emptyTarget = (): TaskTarget => ({ type: "user", assigneeId: "", groupId: "", targetRole: "" });

/** Turunkan payload API dari pilihan target. */
export function targetPayload(t: TaskTarget) {
    return {
        assigneeId: t.type === "user" && t.assigneeId ? Number(t.assigneeId) : null,
        groupId: t.type === "group" && t.groupId ? Number(t.groupId) : null,
        targetRole: t.type === "role" && t.targetRole ? t.targetRole : null,
        targetAll: t.type === "all",
    };
}

export function targetValid(t: TaskTarget) {
    if (t.type === "user") return !!t.assigneeId;
    if (t.type === "group") return !!t.groupId;
    if (t.type === "role") return !!t.targetRole;
    return true; // all
}

/** Rekonstruksi state target dari objek schedule (untuk edit). */
export function targetFromSchedule(s: {
    assigneeId: number | null;
    groupId: number | null;
    targetRole: string | null;
    targetAll: boolean;
}): TaskTarget {
    if (s.assigneeId) return { type: "user", assigneeId: String(s.assigneeId), groupId: "", targetRole: "" };
    if (s.groupId) return { type: "group", assigneeId: "", groupId: String(s.groupId), targetRole: "" };
    if (s.targetRole) return { type: "role", assigneeId: "", groupId: "", targetRole: s.targetRole };
    if (s.targetAll) return { type: "all", assigneeId: "", groupId: "", targetRole: "" };
    return emptyTarget();
}

export function TargetSelector({ target, setTarget }: { target: TaskTarget; setTarget: (t: TaskTarget) => void }) {
    const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: getUsers });
    const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: getRoles });
    const { data: groups = [] } = useQuery({ queryKey: ["task-groups"], queryFn: getTaskGroups });

    return (
        <div>
            <label className="block text-xs font-medium text-foreground mb-1">Diberikan ke</label>
            <div className="grid grid-cols-4 gap-1.5 mb-2">
                {([["user", "Karyawan"], ["group", "Grup"], ["role", "Divisi"], ["all", "Semua"]] as const).map(([v, l]) => (
                    <button key={v} type="button" onClick={() => setTarget({ ...target, type: v })}
                        className={`text-xs py-1.5 rounded-md border transition ${target.type === v ? "border-primary bg-accent text-accent-foreground font-medium" : "border-border text-muted-foreground"}`}>{l}</button>
                ))}
            </div>
            {target.type === "user" && (
                <select value={target.assigneeId} onChange={(e) => setTarget({ ...target, assigneeId: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="">— Pilih karyawan —</option>
                    {users.map((u: { id: number; name: string | null }) => <option key={u.id} value={u.id}>{u.name || `User #${u.id}`}</option>)}
                </select>
            )}
            {target.type === "group" && (
                <select value={target.groupId} onChange={(e) => setTarget({ ...target, groupId: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="">— Pilih grup —</option>
                    {groups.map((g: TaskGroup) => <option key={g.id} value={g.id}>{g.name} ({g.members.length})</option>)}
                </select>
            )}
            {target.type === "role" && (
                <select value={target.targetRole} onChange={(e) => setTarget({ ...target, targetRole: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm">
                    <option value="">— Pilih divisi —</option>
                    {roles.map((r: { id: number; name: string }) => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
            )}
            {target.type === "all" && (
                <p className="text-[11px] text-muted-foreground">Tiap karyawan aktif akan menerima kartu tugasnya sendiri.</p>
            )}
        </div>
    );
}
