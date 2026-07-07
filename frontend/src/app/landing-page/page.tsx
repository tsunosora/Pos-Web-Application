'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    getLandingAdmin, updateLanding, publishLanding, unpublishLanding,
    uploadWorkOrderImage, resolvePhotoUrl,
} from '@/lib/api';
import {
    LayoutTemplate, Save, Loader2, CheckCircle2, ExternalLink, Globe, Search,
    Rocket, EyeOff, Image as ImageIcon, Info,
} from 'lucide-react';
import { badgeToneClass } from '@/components/ui/status-badge';

export default function LandingPageAdmin() {
    const queryClient = useQueryClient();
    const { data, isLoading } = useQuery({ queryKey: ['landing-admin'], queryFn: getLandingAdmin });

    const [form, setForm] = useState({ seoTitle: '', seoDescription: '', faviconUrl: '', customDomain: '' });
    const [saved, setSaved] = useState(false);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState('');
    const faviconRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (data) setForm({
            seoTitle: data.seoTitle ?? '',
            seoDescription: data.seoDescription ?? '',
            faviconUrl: data.faviconUrl ?? '',
            customDomain: data.customDomain ?? '',
        });
    }, [data]);

    const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

    const save = useMutation({
        mutationFn: () => updateLanding(form),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landing-admin'] }); setSaved(true); setTimeout(() => setSaved(false), 3000); },
    });

    const doPublish = async () => {
        setBusy(true);
        try { await updateLanding(form); await publishLanding(); queryClient.invalidateQueries({ queryKey: ['landing-admin'] }); flash('🚀 Landing diterbitkan'); }
        catch (e: any) { flash('❌ ' + (e?.response?.data?.message || e?.message || e)); }
        finally { setBusy(false); }
    };
    const doUnpublish = async () => {
        setBusy(true);
        try { await unpublishLanding(); queryClient.invalidateQueries({ queryKey: ['landing-admin'] }); flash('Landing disembunyikan'); }
        catch (e: any) { flash('❌ ' + (e?.response?.data?.message || e?.message || e)); }
        finally { setBusy(false); }
    };

    const uploadFavicon = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]; if (!f) return;
        try { const url = await uploadWorkOrderImage(f); setForm(s => ({ ...s, faviconUrl: url })); }
        catch (err: any) { alert('Upload gagal: ' + (err?.message || err)); }
        finally { if (faviconRef.current) faviconRef.current.value = ''; }
    };

    if (isLoading) return <div className="p-8 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;

    const published = !!data?.published;
    const faviconSrc = form.faviconUrl ? (resolvePhotoUrl(form.faviconUrl) || form.faviconUrl) : null;

    return (
        <div className="max-w-3xl space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-border">
                <div className="flex items-start gap-3">
                    <div className="hidden sm:flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><LayoutTemplate className="h-5 w-5" /></div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight">Landing Page</h1>
                        <p className="text-sm text-muted-foreground mt-0.5">Atur SEO, domain, status terbit, dan buka editor drag-and-drop.</p>
                    </div>
                </div>
                <button onClick={() => save.mutate()} disabled={save.isPending} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
                    {save.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : saved ? <><CheckCircle2 className="w-4 h-4" /> Tersimpan!</> : <><Save className="w-4 h-4" /> Simpan</>}
                </button>
            </div>

            {/* Status & aksi */}
            <div className="bg-card border border-border rounded-xl p-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center border px-2.5 py-1 rounded-full text-xs font-bold ${badgeToneClass[published ? 'success' : 'neutral']}`}>
                        {published ? '● Terbit' : '○ Draft (belum terbit)'}
                    </span>
                    {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Link href="/landing-builder" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700"><LayoutTemplate className="w-4 h-4" /> Buka Editor</Link>
                    <a href="/landing" target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted"><ExternalLink className="w-4 h-4" /> Lihat</a>
                    {published
                        ? <button onClick={doUnpublish} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50"><EyeOff className="w-4 h-4" /> Sembunyikan</button>
                        : <button onClick={doPublish} disabled={busy} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"><Rocket className="w-4 h-4" /> Terbitkan</button>}
                </div>
            </div>

            {/* SEO */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-muted/40 border-b">
                    <Search className="w-4 h-4 text-primary" />
                    <div><h2 className="font-semibold text-sm">SEO</h2><p className="text-xs text-muted-foreground">Judul & deskripsi yang muncul di Google / tab browser.</p></div>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Judul Halaman (title)</label>
                        <input value={form.seoTitle} onChange={e => setForm(s => ({ ...s, seoTitle: e.target.value }))} placeholder="VOLIKO IMOGIRI — Konveksi Jersey" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Deskripsi (meta description)</label>
                        <textarea rows={3} value={form.seoDescription} onChange={e => setForm(s => ({ ...s, seoDescription: e.target.value }))} placeholder="Vendor jersey & konveksi terdekat..." className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background" />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Favicon</label>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded border border-border flex items-center justify-center bg-muted/40 overflow-hidden">
                                {faviconSrc
                                    // eslint-disable-next-line @next/next/no-img-element
                                    ? <img src={faviconSrc} alt="favicon" className="w-full h-full object-contain" />
                                    : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                            </div>
                            <input ref={faviconRef} type="file" accept="image/*" onChange={uploadFavicon} className="hidden" />
                            <button onClick={() => faviconRef.current?.click()} className="px-3 py-1.5 rounded-lg text-sm border border-border hover:bg-muted">Unggah</button>
                            {form.faviconUrl && <button onClick={() => setForm(s => ({ ...s, faviconUrl: '' }))} className="text-xs text-red-600">Hapus</button>}
                        </div>
                    </div>
                </div>
            </div>

            {/* Domain */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-5 py-3 bg-muted/40 border-b">
                    <Globe className="w-4 h-4 text-primary" />
                    <div><h2 className="font-semibold text-sm">Domain Custom</h2><p className="text-xs text-muted-foreground">Domain tempat landing tampil ke publik.</p></div>
                </div>
                <div className="p-5 space-y-3">
                    <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Domain Landing</label>
                        <input value={form.customDomain} onChange={e => setForm(s => ({ ...s, customDomain: e.target.value }))} placeholder="www.tokokamu.com" className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background font-mono" />
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-800 flex gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                            Agar domain ini menyajikan landing, perlu 2 langkah di sisi server (di luar aplikasi):
                            <ol className="list-decimal ml-4 mt-1 space-y-0.5">
                                <li>Set environment <code className="bg-blue-100 px-1 rounded">NEXT_PUBLIC_LANDING_DOMAIN=https://{form.customDomain || 'www.tokokamu.com'}</code> lalu restart frontend.</li>
                                <li>Arahkan DNS domain + reverse proxy (nginx/Cloudflare) ke aplikasi ini.</li>
                            </ol>
                            Domain POS (mis. app.tokokamu.com) tetap ke dashboard seperti biasa.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
