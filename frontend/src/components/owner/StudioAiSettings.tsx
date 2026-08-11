"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Check, X, Plug, Save } from "lucide-react";
import {
    getStudioAiConfig, updateStudioAiConfig, testStudioAi,
    type StudioAiConfig,
} from "@/lib/api/studioAi";

/**
 * Panel Owner: kelola AI Studio Desain (Asisten "Isi Otomatis").
 * Base URL + Token + Model + toggle Aktif. Token disimpan server-side,
 * TIDAK ditampilkan utuh (hanya masked). Lihat memory studio-ai-autofill.
 */
export function StudioAiSettings() {
    const qc = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ["studio-ai-config"], queryFn: getStudioAiConfig });

    const [form, setForm] = useState<{ enabled: boolean; chatEnabled: boolean; aiName: string; aiGreeting: string; aiAvatar: string; baseUrl: string; model: string; apiKey: string }>({
        enabled: false, chatEnabled: true, aiName: "", aiGreeting: "", aiAvatar: "", baseUrl: "", model: "", apiKey: "",
    });
    const [dirtyKey, setDirtyKey] = useState(false); // true = user mengetik token baru
    const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);

    // Sinkron form saat data termuat (jangan timpa ketik token).
    useEffect(() => {
        if (!data) return;
        setForm((f) => ({
            enabled: data.enabled,
            chatEnabled: data.chatEnabled,
            aiName: data.aiName || "",
            aiGreeting: data.aiGreeting || "",
            aiAvatar: data.aiAvatar || "",
            baseUrl: data.baseUrl || "",
            model: data.model || "",
            apiKey: dirtyKey ? f.apiKey : "",
        }));
    }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

    const saveMut = useMutation({
        mutationFn: () => updateStudioAiConfig({
            enabled: form.enabled,
            chatEnabled: form.chatEnabled,
            aiName: form.aiName,
            aiGreeting: form.aiGreeting,
            aiAvatar: form.aiAvatar,
            baseUrl: form.baseUrl,
            model: form.model,
            ...(dirtyKey && form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
        }),
        onSuccess: (res: StudioAiConfig) => {
            setDirtyKey(false); setTest(null);
            qc.setQueryData(["studio-ai-config"], res);
            qc.invalidateQueries({ queryKey: ["studio-ai-config"] });
        },
    });

    const testMut = useMutation({
        mutationFn: testStudioAi,
        onSuccess: (res) => setTest(res),
        onError: (e: any) => setTest({ ok: false, message: e?.response?.data?.message || e?.message || "Gagal tes." }),
    });

    return (
        <div className="rounded-xl glass-card p-4 sm:p-5">
            <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">AI Studio Desain</h3>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">asisten isi brief otomatis</span>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
                Aktifkan asisten AI (isi brief otomatis + saran ide). Isi <b>Base URL</b> endpoint OpenAI-compatible + <b>Token</b>,
                lalu Simpan &amp; Tes Koneksi. Pilihan Base URL: <b>(a)</b> 9router di server yang sama →{" "}
                <code>http://localhost:20128/v1</code> (paling aman, tak perlu dipublik); <b>(b)</b> 9router di PC → IP Tailscale PC{" "}
                (<code>http://100.x.x.x:20128/v1</code>); <b>(c)</b> OpenRouter → <code>https://openrouter.ai/api/v1</code>.
                Jangan pakai URL publik Cloudflare di sini (server panggil via internal). Matikan kapan saja lewat sakelar.
            </p>

            {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Memuat…</div>
            ) : (
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={form.enabled}
                            onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                            className="w-4 h-4 accent-primary"
                        />
                        <span className="text-sm font-medium text-foreground">
                            AI aktif {form.enabled ? "" : "(nonaktif)"}
                        </span>
                    </label>

                    <label className={`flex items-center gap-3 cursor-pointer select-none ${form.enabled ? "" : "opacity-50"}`}>
                        <input
                            type="checkbox"
                            checked={form.chatEnabled}
                            disabled={!form.enabled}
                            onChange={(e) => setForm({ ...form, chatEnabled: e.target.checked })}
                            className="w-4 h-4 accent-primary"
                        />
                        <span className="text-sm text-foreground">
                            Chat Asisten di POS (harga/HPP) {form.chatEnabled ? "" : "— dimatikan"}
                            <span className="block text-[11px] text-muted-foreground">Widget chat mengambang untuk staf. Matikan kapan saja tanpa mematikan fitur AI lain.</span>
                        </span>
                    </label>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Nama Asisten AI</label>
                        <input
                            type="text"
                            value={form.aiName}
                            onChange={(e) => setForm({ ...form, aiName: e.target.value })}
                            placeholder="Asisten VolikoPrint"
                            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                        />
                        <span className="text-[11px] text-muted-foreground">Nama yang tampil di widget chat & dipakai AI saat memperkenalkan diri.</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Sapaan Pembuka</label>
                        <textarea
                            value={form.aiGreeting}
                            onChange={(e) => setForm({ ...form, aiGreeting: e.target.value })}
                            rows={2}
                            placeholder="Halo! Saya bantu seputar produk, harga, HPP, dan penggunaan aplikasi ini."
                            className="rounded-lg border border-border bg-background px-3 py-2 text-sm resize-y"
                        />
                        <span className="text-[11px] text-muted-foreground">Muncul di layar chat saat masih kosong.</span>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">Avatar (emoji atau URL gambar)</label>
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-border flex items-center justify-center overflow-hidden shrink-0 text-xl">
                                {/^(https?:\/\/|\/)/.test(form.aiAvatar.trim())
                                    ? <img src={form.aiAvatar.trim()} alt="" className="w-full h-full object-cover" />
                                    : (form.aiAvatar.trim() || "🤖")}
                            </div>
                            <input
                                type="text"
                                value={form.aiAvatar}
                                onChange={(e) => setForm({ ...form, aiAvatar: e.target.value })}
                                placeholder="🤖  atau  https://…/avatar.png"
                                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                            {["🤖", "🖨️", "🧑‍💼", "💁", "✨", "🎨", "🛒", "📦"].map((e) => (
                                <button key={e} type="button" onClick={() => setForm({ ...form, aiAvatar: e })}
                                    className="w-8 h-8 rounded-lg border border-border hover:border-primary text-lg leading-none">
                                    {e}
                                </button>
                            ))}
                            <button type="button" onClick={() => setForm({ ...form, aiAvatar: "" })}
                                className="px-2 h-8 rounded-lg border border-border hover:border-primary text-[11px] text-muted-foreground">
                                Default
                            </button>
                        </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Base URL (endpoint 9router)</label>
                            <input
                                type="text"
                                value={form.baseUrl}
                                onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                                placeholder="http://100.x.x.x:20128/v1"
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </div>
                        <div className="flex flex-col gap-1">
                            <label className="text-xs font-medium text-muted-foreground">Model</label>
                            <input
                                type="text"
                                value={form.model}
                                onChange={(e) => setForm({ ...form, model: e.target.value })}
                                placeholder="cc/claude-sonnet-4-5"
                                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-muted-foreground">
                            Token 9router {data?.apiKeySet && !dirtyKey && <span className="text-muted-foreground">(tersimpan: {data.apiKeyMasked})</span>}
                        </label>
                        <input
                            type="password"
                            value={form.apiKey}
                            onChange={(e) => { setForm({ ...form, apiKey: e.target.value }); setDirtyKey(true); }}
                            placeholder={data?.apiKeySet ? "•••• (kosongkan = tetap pakai yang tersimpan)" : "tempel token dari dashboard 9router"}
                            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
                            autoComplete="off"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                            onClick={() => saveMut.mutate()}
                            disabled={saveMut.isPending}
                            className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                            {saveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Simpan
                        </button>
                        <button
                            onClick={() => testMut.mutate()}
                            disabled={testMut.isPending}
                            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium disabled:opacity-50"
                        >
                            {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
                            Tes Koneksi
                        </button>
                        {saveMut.isSuccess && !saveMut.isPending && <span className="text-xs text-green-600 inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Tersimpan</span>}
                    </div>

                    {test && (
                        <div className={`text-xs inline-flex items-start gap-1.5 rounded-lg px-3 py-2 ${test.ok ? "bg-green-500/10 text-green-600" : "bg-red-500/10 text-red-600"}`}>
                            {test.ok ? <Check className="w-3.5 h-3.5 mt-0.5" /> : <X className="w-3.5 h-3.5 mt-0.5" />}
                            <span>{test.message}</span>
                        </div>
                    )}
                    {saveMut.isError && <p className="text-xs text-red-600">Gagal menyimpan. Coba lagi.</p>}
                </div>
            )}
        </div>
    );
}
