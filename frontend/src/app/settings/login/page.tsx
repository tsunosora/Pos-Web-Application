'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings, uploadLoginBgImage, uploadLoginLogo } from '@/lib/api';
import { Upload, X, Plus, GripVertical, Image as ImageIcon, Trash2, Paintbrush, Loader2, Palette } from 'lucide-react';

export default function LoginAppearancePage() {
    const qc = useQueryClient();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const fileRef = useRef<HTMLInputElement>(null);

    const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

    const [bgImages, setBgImages] = useState<string[]>([]);
    const [taglines, setTaglines] = useState<string[]>([]);
    const [newTagline, setNewTagline] = useState('');
    const [loginLogoUrl, setLoginLogoUrl] = useState<string | null>(null);
    const [themeMode, setThemeMode] = useState<'SOLID' | 'GRADIENT'>('SOLID');
    const [themePrimaryColor, setThemePrimaryColor] = useState('#4F46E5');
    const [themeSecondaryColor, setThemeSecondaryColor] = useState('#7C3AED');
    const [themeGradientDirection, setThemeGradientDirection] = useState('135deg');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [saved, setSaved] = useState(false);
    const logoFileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!settings) return;
        try { setBgImages(settings.loginBgImages ? JSON.parse(settings.loginBgImages) : []); } catch { setBgImages([]); }
        try { setTaglines(settings.loginTaglines ? JSON.parse(settings.loginTaglines) : []); } catch { setTaglines([]); }
        setLoginLogoUrl(settings.loginLogoUrl ?? null);
        setThemeMode((settings.themeMode as any) ?? 'SOLID');
        setThemePrimaryColor(settings.themePrimaryColor ?? '#4F46E5');
        setThemeSecondaryColor(settings.themeSecondaryColor ?? '#7C3AED');
        setThemeGradientDirection(settings.themeGradientDirection ?? '135deg');
    }, [settings]);

    const save = async () => {
        setSaving(true);
        try {
            await updateSettings({
                loginBgImages: JSON.stringify(bgImages),
                loginTaglines: JSON.stringify(taglines),
                loginLogoUrl,
                themeMode,
                themePrimaryColor,
                themeSecondaryColor,
                themeGradientDirection,
            });
            qc.invalidateQueries({ queryKey: ['settings'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
    };

    const handleLogoUpload = async (file: File | null) => {
        if (!file) return;
        setUploadingLogo(true);
        try {
            const res = await uploadLoginLogo(file);
            setLoginLogoUrl(res.url);
            qc.invalidateQueries({ queryKey: ['settings'] });
        } finally {
            setUploadingLogo(false);
            if (logoFileRef.current) logoFileRef.current.value = '';
        }
    };

    const removeLogo = async () => {
        if (!confirm('Hapus logo login? Animasi Voliko default akan dipakai kembali.')) return;
        setLoginLogoUrl(null);
        await updateSettings({ loginLogoUrl: null });
        qc.invalidateQueries({ queryKey: ['settings'] });
    };

    const handleUpload = async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        setUploading(true);
        try {
            for (const file of Array.from(files)) {
                const res = await uploadLoginBgImage(file);
                setBgImages(prev => [...prev, res.url]);
            }
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = '';
        }
    };

    const removeImage = (idx: number) => setBgImages(prev => prev.filter((_, i) => i !== idx));

    const addTagline = () => {
        const t = newTagline.trim();
        if (!t) return;
        setTaglines(prev => [...prev, t]);
        setNewTagline('');
    };

    const removeTagline = (idx: number) => setTaglines(prev => prev.filter((_, i) => i !== idx));

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    return (
        <div className="p-6 space-y-6 max-w-3xl">
            <div className="flex items-start gap-3 pb-4 border-b border-border">
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Paintbrush className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Tampilan Halaman Login</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        Atur logo, gambar latar, tagline, dan warna tema. Klik <strong>Simpan</strong> di bawah untuk apply perubahan.
                    </p>
                </div>
            </div>

            {/* Logo Login (replace animasi Voliko centerpiece) */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        Logo Login (Centerpiece)
                    </h3>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                    Gambar yang muncul di tengah panel login. Support SVG, PNG, JPG. Kalau di-upload akan menggantikan animasi Voliko default.
                </p>

                <div className="flex items-start gap-4 flex-wrap">
                    {loginLogoUrl ? (
                        <div className="relative group w-40 h-40 bg-slate-900 rounded-xl overflow-hidden border-2 border-emerald-300 flex items-center justify-center">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`${base}${loginLogoUrl}`} alt="Login Logo" className="max-w-full max-h-full object-contain" />
                            <button
                                onClick={removeLogo}
                                className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                title="Hapus logo"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                            </button>
                            <span className="absolute bottom-1 left-2 text-emerald-400 text-xs font-semibold opacity-0 group-hover:opacity-100">
                                Aktif
                            </span>
                        </div>
                    ) : (
                        <div className="w-40 h-40 border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center text-center text-muted-foreground text-xs p-2">
                            <ImageIcon className="h-8 w-8 mb-1" />
                            <span>Animasi Voliko default</span>
                        </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                        <input
                            ref={logoFileRef}
                            type="file"
                            accept="image/*,.svg"
                            className="hidden"
                            onChange={e => handleLogoUpload(e.target.files?.[0] ?? null)}
                        />
                        <button
                            onClick={() => logoFileRef.current?.click()}
                            disabled={uploadingLogo}
                            className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
                        >
                            <Upload className="h-4 w-4" />
                            {uploadingLogo ? 'Mengupload...' : (loginLogoUrl ? 'Ganti Logo' : 'Upload Logo')}
                        </button>
                        <p className="text-xs text-muted-foreground">
                            Rekomendasi: PNG/SVG dengan background transparent, rasio 1:1 (square), min. 400×400px.
                        </p>
                    </div>
                </div>
            </section>

            {/* Theme color */}
            <section className="space-y-4 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                        <Palette className="h-4 w-4 text-primary" />
                        Warna Tema Aplikasi
                    </h3>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                    Diaplikasikan ke background login page &amp; tersedia sebagai CSS variable <code>--theme-primary</code>, <code>--theme-bg</code> untuk component lain.
                </p>

                {/* Mode toggle */}
                <div className="grid grid-cols-2 gap-2 max-w-sm">
                    {(['SOLID', 'GRADIENT'] as const).map((m) => {
                        const active = themeMode === m;
                        return (
                            <button
                                key={m}
                                type="button"
                                onClick={() => setThemeMode(m)}
                                className={`px-3 py-2 rounded-lg border-2 text-sm font-semibold transition-colors ${active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
                            >
                                {m === 'SOLID' ? '🎨 Solid' : '🌈 Gradient'}
                            </button>
                        );
                    })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                            {themeMode === 'GRADIENT' ? 'Warna 1' : 'Warna Utama'}
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={themePrimaryColor}
                                onChange={e => setThemePrimaryColor(e.target.value)}
                                className="w-12 h-10 rounded cursor-pointer border border-border"
                            />
                            <input
                                type="text"
                                value={themePrimaryColor}
                                onChange={e => setThemePrimaryColor(e.target.value)}
                                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono uppercase"
                                placeholder="#4F46E5"
                                maxLength={7}
                            />
                        </div>
                    </div>

                    {themeMode === 'GRADIENT' && (
                        <>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Warna 2</label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={themeSecondaryColor}
                                        onChange={e => setThemeSecondaryColor(e.target.value)}
                                        className="w-12 h-10 rounded cursor-pointer border border-border"
                                    />
                                    <input
                                        type="text"
                                        value={themeSecondaryColor}
                                        onChange={e => setThemeSecondaryColor(e.target.value)}
                                        className="flex-1 px-3 py-2 border border-border rounded-lg text-sm font-mono uppercase"
                                        placeholder="#7C3AED"
                                        maxLength={7}
                                    />
                                </div>
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Arah Gradient</label>
                                <div className="grid grid-cols-4 gap-1.5">
                                    {[
                                        { v: '0deg',   l: '↑ Atas' },
                                        { v: '90deg',  l: '→ Kanan' },
                                        { v: '180deg', l: '↓ Bawah' },
                                        { v: '270deg', l: '← Kiri' },
                                        { v: '45deg',  l: '↗' },
                                        { v: '135deg', l: '↘' },
                                        { v: '225deg', l: '↙' },
                                        { v: '315deg', l: '↖' },
                                    ].map(d => {
                                        const active = themeGradientDirection === d.v;
                                        return (
                                            <button
                                                key={d.v}
                                                type="button"
                                                onClick={() => setThemeGradientDirection(d.v)}
                                                className={`px-2 py-1.5 rounded border text-xs ${active ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border text-muted-foreground'}`}
                                            >
                                                {d.l}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Live preview */}
                <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Preview</label>
                    <div
                        className="w-full h-32 rounded-xl border border-border flex items-center justify-center text-white font-bold text-lg shadow-inner"
                        style={{
                            background: themeMode === 'GRADIENT'
                                ? `linear-gradient(${themeGradientDirection}, ${themePrimaryColor}, ${themeSecondaryColor})`
                                : themePrimaryColor,
                        }}
                    >
                        Theme Preview
                    </div>
                </div>
            </section>

            {/* Background Images */}
            <section className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        Gambar Latar
                    </h3>
                    <span className="text-xs text-muted-foreground">{bgImages.length} gambar</span>
                </div>

                {bgImages.length === 0 ? (
                    <div className="border-2 border-dashed border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
                        Belum ada gambar. Upload gambar untuk mengaktifkan slideshow dengan efek Ken Burns.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {bgImages.map((img, i) => (
                            <div key={i} className="relative group aspect-video rounded-lg overflow-hidden border border-border">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={`${base}${img}`}
                                    alt={`bg-${i + 1}`}
                                    className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
                                <button
                                    onClick={() => removeImage(i)}
                                    className="absolute top-1.5 right-1.5 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    title="Hapus gambar"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                                <span className="absolute bottom-1 left-1.5 text-white/70 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                    #{i + 1}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                <div>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => handleUpload(e.target.files)}
                    />
                    <button
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
                    >
                        <Upload className="h-4 w-4" />
                        {uploading ? 'Mengupload...' : 'Upload Gambar'}
                    </button>
                    <p className="text-xs text-muted-foreground mt-1.5">
                        Mendukung JPG, PNG, WEBP. Setiap gambar akan tampil dengan efek zoom Ken Burns otomatis.
                        Slideshow berpindah setiap 6 detik.
                    </p>
                </div>
            </section>

            {/* Taglines */}
            <section className="space-y-4">
                <h3 className="font-semibold">Tagline / Slogan</h3>
                <p className="text-sm text-muted-foreground -mt-2">
                    Teks yang berganti-ganti di bagian bawah panel login.
                </p>

                {taglines.length === 0 ? (
                    <div className="text-sm text-muted-foreground italic">
                        Belum ada tagline. Default: &ldquo;Solusi POS Terpadu untuk Bisnis Anda&rdquo;
                    </div>
                ) : (
                    <ul className="space-y-2">
                        {taglines.map((t, i) => (
                            <li key={i} className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg group">
                                <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="flex-1 text-sm">{t}</span>
                                <button
                                    onClick={() => removeTagline(i)}
                                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTagline}
                        onChange={e => setNewTagline(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addTagline()}
                        placeholder="Tambah tagline baru..."
                        className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                    <button
                        onClick={addTagline}
                        disabled={!newTagline.trim()}
                        className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Tambah
                    </button>
                </div>
            </section>

            {/* Save */}
            <div className="flex items-center gap-3 pt-2 border-t border-border">
                <button
                    onClick={save}
                    disabled={saving}
                    className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                    {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
                {saved && (
                    <span className="text-sm text-emerald-500 font-medium">Tersimpan!</span>
                )}
            </div>
        </div>
    );
}
