"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    getMessageTemplates, createMessageTemplate, updateMessageTemplate,
    deleteMessageTemplate, seedDefaultTemplates,
    type MessageTemplate, TEMPLATE_CATEGORY_LABEL, type TemplateCategory,
} from "@/lib/api";
import { Plus, Edit2, Trash2, X, MessageSquare, Sparkles, Loader2, Eye, Power } from "lucide-react";

const CATEGORIES: TemplateCategory[] = [
    "GREETING", "FU_LEAD", "PROGRESS_UPDATE", "AFTER_SALES", "REPEAT_ORDER", "CUSTOM",
];

const PLACEHOLDER_HINT = [
    "{{name}} — Nama lead/customer",
    "{{phone}} — Nomor HP",
    "{{soNumber}} — Nomor Sales Order",
    "{{status}} — Status SO/lead",
    "{{estimatedDays}} — Estimasi hari sampai deadline SO",
    "{{monthsSinceLastOrder}} — Bulan sejak order terakhir customer",
];

export default function TemplatesPage() {
    const qc = useQueryClient();
    const { data: templates, isLoading } = useQuery({
        queryKey: ["crm-templates"],
        queryFn: () => getMessageTemplates(),
    });

    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<MessageTemplate | null>(null);
    const [previewing, setPreviewing] = useState<MessageTemplate | null>(null);

    const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-templates"] });

    const createMut = useMutation({
        mutationFn: createMessageTemplate,
        onSuccess: () => { invalidate(); setFormOpen(false); },
    });
    const updateMut = useMutation({
        mutationFn: ({ id, data }: { id: number; data: any }) => updateMessageTemplate(id, data),
        onSuccess: () => { invalidate(); setFormOpen(false); setEditing(null); },
    });
    const deleteMut = useMutation({
        mutationFn: deleteMessageTemplate,
        onSuccess: invalidate,
    });
    const seedMut = useMutation({
        mutationFn: seedDefaultTemplates,
        onSuccess: (r) => { invalidate(); alert(`✓ Seed ${r.inserted} template baru ditambahkan (dari ${r.total} default)`); },
    });

    const grouped = (templates ?? []).reduce<Record<string, MessageTemplate[]>>((acc, t) => {
        (acc[t.category] = acc[t.category] || []).push(t);
        return acc;
    }, {});

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-indigo-600" />
                        Message Templates
                    </h1>
                    <p className="text-sm text-gray-500">Template WhatsApp untuk follow-up, greeting, after-sales — dipakai manual (copy & paste)</p>
                </div>
                <div className="flex gap-2">
                    {(!templates || templates.length === 0) && (
                        <button
                            onClick={() => seedMut.mutate()}
                            disabled={seedMut.isPending}
                            className="px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 flex items-center gap-2"
                        >
                            <Sparkles className="h-4 w-4" /> Seed 5 Default
                        </button>
                    )}
                    <button
                        onClick={() => { setEditing(null); setFormOpen(true); }}
                        className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Template Baru
                    </button>
                </div>
            </div>

            {/* Placeholder hint */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-sm">
                <div className="font-semibold text-indigo-700 mb-1">📌 Placeholder Tersedia</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs text-gray-700">
                    {PLACEHOLDER_HINT.map((p) => (
                        <div key={p} className="font-mono">{p}</div>
                    ))}
                </div>
            </div>

            {/* List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat...
                </div>
            ) : !templates || templates.length === 0 ? (
                <div className="bg-white border rounded-xl p-12 text-center text-gray-500">
                    <MessageSquare className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>Belum ada template. Klik <strong>"Seed 5 Default"</strong> untuk dapat template starter, atau buat dari awal.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {CATEGORIES.map((cat) => {
                        const items = grouped[cat] || [];
                        if (items.length === 0) return null;
                        return (
                            <div key={cat}>
                                <h2 className="font-bold text-sm text-gray-600 uppercase mb-2">
                                    {TEMPLATE_CATEGORY_LABEL[cat]} ({items.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {items.map((t) => (
                                        <TemplateCard
                                            key={t.id}
                                            template={t}
                                            onEdit={() => { setEditing(t); setFormOpen(true); }}
                                            onDelete={() => {
                                                if (confirm(`Hapus template "${t.name}"?`)) deleteMut.mutate(t.id);
                                            }}
                                            onPreview={() => setPreviewing(t)}
                                            onToggleActive={() => updateMut.mutate({ id: t.id, data: { isActive: !t.isActive } })}
                                        />
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Form modal */}
            {formOpen && (
                <TemplateFormModal
                    initial={editing}
                    onClose={() => { setFormOpen(false); setEditing(null); }}
                    onSubmit={(data) => {
                        if (editing) updateMut.mutate({ id: editing.id, data });
                        else createMut.mutate(data);
                    }}
                    submitting={createMut.isPending || updateMut.isPending}
                />
            )}

            {/* Preview modal (rendered with dummy data) */}
            {previewing && (
                <PreviewModal template={previewing} onClose={() => setPreviewing(null)} />
            )}
        </div>
    );
}

function TemplateCard({ template, onEdit, onDelete, onPreview, onToggleActive }: {
    template: MessageTemplate;
    onEdit: () => void;
    onDelete: () => void;
    onPreview: () => void;
    onToggleActive: () => void;
}) {
    return (
        <div className={`bg-white border rounded-xl p-4 ${!template.isActive ? "opacity-60" : ""}`}>
            <div className="flex items-start justify-between mb-2">
                <div className="font-bold text-gray-800 flex-1 truncate">{template.name}</div>
                {!template.isActive && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-semibold">NONAKTIF</span>
                )}
            </div>
            <p className="text-xs text-gray-600 whitespace-pre-wrap line-clamp-4 mb-3 bg-gray-50 p-2 rounded">{template.bodyTemplate}</p>
            <div className="flex gap-1 flex-wrap">
                <button onClick={onPreview} className="px-2 py-1 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Preview
                </button>
                <button onClick={onEdit} className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-1">
                    <Edit2 className="h-3 w-3" /> Edit
                </button>
                <button onClick={onToggleActive} className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded hover:bg-amber-200 flex items-center gap-1">
                    <Power className="h-3 w-3" /> {template.isActive ? "Nonaktifkan" : "Aktifkan"}
                </button>
                <button onClick={onDelete} className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 flex items-center gap-1">
                    <Trash2 className="h-3 w-3" /> Hapus
                </button>
            </div>
        </div>
    );
}

function TemplateFormModal({ initial, onClose, onSubmit, submitting }: {
    initial?: MessageTemplate | null;
    onClose: () => void;
    onSubmit: (data: any) => void;
    submitting: boolean;
}) {
    const [form, setForm] = useState({
        name: initial?.name ?? "",
        category: initial?.category ?? "GREETING",
        bodyTemplate: initial?.bodyTemplate ?? "",
        isActive: initial?.isActive ?? true,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(form);
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-[200] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-5 py-3 flex items-center justify-between">
                    <h2 className="font-bold text-lg">{initial ? "Edit Template" : "Template Baru"}</h2>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-5 space-y-3">
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Nama Template *</label>
                        <input
                            required
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                            placeholder="mis. Greeting Lead Baru WA"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Kategori *</label>
                        <select
                            value={form.category}
                            onChange={(e) => setForm({ ...form, category: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                            {CATEGORIES.map((c) => (
                                <option key={c} value={c}>{TEMPLATE_CATEGORY_LABEL[c]}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Body Template *</label>
                        <textarea
                            required
                            rows={8}
                            value={form.bodyTemplate}
                            onChange={(e) => setForm({ ...form, bodyTemplate: e.target.value })}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono"
                            placeholder={`Pakai placeholder {{name}}, {{soNumber}}, dll.\n\nContoh:\nHalo kak {{name}} 🙌\nUntuk SO {{soNumber}}, status sekarang: {{status}}...`}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Lihat panel "Placeholder Tersedia" di halaman utama untuk daftar lengkap.
                        </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.isActive}
                            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                        />
                        Aktif (tampil di pilihan template saat copy WA)
                    </label>

                    <div className="flex gap-2 pt-3">
                        <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm">Batal</button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="flex-1 px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {submitting ? "Menyimpan..." : initial ? "Simpan" : "Buat Template"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function PreviewModal({ template, onClose }: { template: MessageTemplate; onClose: () => void }) {
    // Render dengan dummy data untuk preview
    const dummy: Record<string, string> = {
        name: "Andi Pratama",
        phone: "081234567890",
        soNumber: "SO-20260503-001",
        status: "PRINTING",
        estimatedDays: "3",
        monthsSinceLastOrder: "4",
    };
    let rendered = template.bodyTemplate;
    for (const [k, v] of Object.entries(dummy)) {
        rendered = rendered.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "gi"), v);
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[300] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl p-5 max-w-md w-full">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-lg">Preview: {template.name}</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="text-xs text-gray-500 mb-2">Render dengan data dummy:</div>
                <pre className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm whitespace-pre-wrap font-sans text-gray-800">{rendered}</pre>
                <p className="text-[10px] text-gray-400 mt-2">
                    Saat di-render dari halaman lead/customer, placeholder akan terisi data asli.
                </p>
                <button onClick={onClose} className="mt-3 w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold">
                    Tutup
                </button>
            </div>
        </div>
    );
}
