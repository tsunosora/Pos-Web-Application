'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getSettings, updateSettings, uploadLoginBgImage } from '@/lib/api';
import { Upload, X, Plus, GripVertical, Image as ImageIcon, Trash2, Paintbrush, Loader2 } from 'lucide-react';

export default function LoginAppearancePage() {
    const qc = useQueryClient();
    const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const fileRef = useRef<HTMLInputElement>(null);

    const { data: settings, isLoading } = useQuery({ queryKey: ['settings'], queryFn: getSettings });

    const [bgImages, setBgImages] = useState<string[]>([]);
    const [taglines, setTaglines] = useState<string[]>([]);
    const [newTagline, setNewTagline] = useState('');
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!settings) return;
        try { setBgImages(settings.loginBgImages ? JSON.parse(settings.loginBgImages) : []); } catch { setBgImages([]); }
        try { setTaglines(settings.loginTaglines ? JSON.parse(settings.loginTaglines) : []); } catch { setTaglines([]); }
    }, [settings]);

    const save = async () => {
        setSaving(true);
        try {
            await updateSettings({
                loginBgImages: JSON.stringify(bgImages),
                loginTaglines: JSON.stringify(taglines),
            });
            qc.invalidateQueries({ queryKey: ['settings'] });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setSaving(false);
        }
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
                        Atur gambar latar dan tagline panel kiri halaman login. Logo mengikuti pengaturan Profil Toko.
                    </p>
                </div>
            </div>

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
