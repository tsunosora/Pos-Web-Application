"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BellRing } from "lucide-react";
import {
    getReminderConfigs, setReminderConfig, listWaChannels, listWaTemplates,
    REMINDER_EVENT_LABEL, type WaReminderConfig, type ReminderEvent, type WaTemplate,
} from "@/lib/api/whatsapp-cloud";

const HINTS: Record<ReminderEvent, string> = {
    ORDER_READY: "Terkirim otomatis saat titipan/pesanan ditandai SIAP AMBIL.",
    PAYMENT_DUE: "Terkirim saat follow-up bertipe pembayaran jatuh tempo (cron 15 menit).",
    FOLLOWUP_DUE: "Terkirim saat follow-up umum jatuh tempo (cron 15 menit).",
};

export default function WhatsappRemindersPage() {
    const qc = useQueryClient();
    const { data: configs = [] } = useQuery({ queryKey: ["wa-reminder-config"], queryFn: getReminderConfigs });
    const { data: channels = [] } = useQuery({ queryKey: ["wa-channels"], queryFn: listWaChannels });
    const { data: templates = [] } = useQuery({
        queryKey: ["wa-templates-approved"], queryFn: listWaTemplates,
        select: (all: WaTemplate[]) => all.filter((t) => t.status === "APPROVED"),
    });

    const saveMut = useMutation({
        mutationFn: ({ eventType, patch }: { eventType: ReminderEvent; patch: Partial<WaReminderConfig> }) =>
            setReminderConfig(eventType, patch),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-reminder-config"] }),
        onError: (e: unknown) => alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || "Gagal menyimpan"),
    });
    const save = (eventType: ReminderEvent, patch: Partial<WaReminderConfig>) => saveMut.mutate({ eventType, patch });

    return (
        <div className="max-w-3xl mx-auto p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Link href="/crm/whatsapp" className="p-1.5 rounded-lg hover:bg-muted"><ArrowLeft className="w-4 h-4" /></Link>
                <BellRing className="w-5 h-5 text-emerald-500" />
                <h1 className="text-lg font-semibold">Reminder Otomatis</h1>
            </div>
            <p className="text-sm opacity-60">
                Kirim <b>template</b> otomatis untuk event POS. Perlu template <b>APPROVED</b> &amp; channel aktif.
                Kontak opt-out otomatis dilewati, dan tiap event hanya dikirim sekali per transaksi/follow-up.
            </p>

            <div className="space-y-3">
                {configs.map((c: WaReminderConfig) => (
                    <div key={c.eventType} className="rounded-2xl border border-border bg-card/60 p-4 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <div className="font-medium">{REMINDER_EVENT_LABEL[c.eventType]}</div>
                                <div className="text-xs opacity-60">{HINTS[c.eventType]}</div>
                            </div>
                            <label className="flex items-center gap-2 text-sm shrink-0">
                                <input type="checkbox" checked={c.enabled} onChange={(e) => save(c.eventType, { enabled: e.target.checked })} />
                                Aktif
                            </label>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                            <label className="text-sm">Channel
                                <select value={c.channelId ?? ""} onChange={(e) => save(c.eventType, { channelId: e.target.value ? +e.target.value : null })}
                                    className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                    <option value="">Pilih channel…</option>
                                    {channels.map((ch) => <option key={ch.id} value={ch.id}>{ch.label}</option>)}
                                </select>
                            </label>
                            <label className="text-sm">Template (APPROVED)
                                <select value={c.templateId ?? ""} onChange={(e) => save(c.eventType, { templateId: e.target.value ? +e.target.value : null })}
                                    className="mt-1 w-full rounded-lg bg-muted/60 px-3 py-2 outline-none">
                                    <option value="">Pilih template…</option>
                                    {templates.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.language})</option>)}
                                </select>
                            </label>
                        </div>
                        {c.enabled && (!c.channelId || !c.templateId) && (
                            <div className="text-xs text-amber-600">Pilih channel &amp; template agar reminder ini berfungsi.</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
