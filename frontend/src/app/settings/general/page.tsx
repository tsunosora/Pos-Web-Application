"use client";

import { useState, useEffect } from 'react';
import { getSettings, updateSettings, uploadLogoImage } from '@/lib/api';
import { Store, Phone, MapPin, Save, Loader2, Ruler, ToggleLeft, ToggleRight, UploadCloud, Percent, KeyRound } from 'lucide-react';

export default function GeneralSettings() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [form, setForm] = useState({
        storeName: '',
        storePhone: '',
        storeAddress: '',
        enableAdvancedPricing: false,
        enableTax: true,
        taxRate: 10,
        operatorPin: '',
    });
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);

    useEffect(() => {
        getSettings().then((data) => {
            setForm({
                storeName: data.storeName || '',
                storePhone: data.storePhone || '',
                storeAddress: data.storeAddress || '',
                enableAdvancedPricing: data.enableAdvancedPricing || false,
                enableTax: data.enableTax ?? true,
                taxRate: data.taxRate ? Number(data.taxRate) : 10,
                operatorPin: data.operatorPin || '',
            });
            setLogoUrl(data.logoImageUrl || null);
            setIsLoading(false);
        }).catch(err => {
            console.error("Gagal memuat pengaturan toko", err);
            setIsLoading(false);
        });
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await updateSettings(form);
            alert("Pengaturan Toko Berhasil Disimpan!");
        } catch (error) {
            console.error(error);
            alert("Gagal menyimpan pengaturan.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploadingLogo(true);
        try {
            const res = await uploadLogoImage(file);
            setLogoUrl(res.url);
            alert("Logo Berhasil Diunggah!");
        } catch (error) {
            console.error(error);
            alert("Gagal mengunggah Logo.");
        } finally {
            setIsUploadingLogo(false);
        }
    };

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    if (isLoading) return <div className="p-8 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

    return (
        <div className="p-6 max-w-3xl space-y-6">
            <div className="flex items-start gap-3 pb-4 border-b border-border">
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Store className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Profil Toko Umum</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">Konfigurasi dasar toko dan mode pemrosesan pesanan.</p>
                </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
                {/* Logo Upload */}
                <div className="p-5 rounded-xl border border-border bg-background/50 flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                    <div className="flex flex-col items-center justify-center w-32 h-32 border-2 border-dashed border-border rounded-xl bg-muted/20 hover:bg-muted/50 transition-colors relative group overflow-hidden shrink-0">
                        {logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={`${baseUrl}${logoUrl}`} alt="Logo Toko" className="w-full h-full object-contain p-2" />
                        ) : (
                            <div className="text-center p-2">
                                <UploadCloud className="h-8 w-8 text-muted-foreground/50 mx-auto mb-1" />
                                <span className="text-xs font-medium text-muted-foreground">Logo Toko</span>
                            </div>
                        )}

                        <div className={`absolute inset-0 bg-background/80 flex items-center justify-center opacity-0 ${logoUrl ? 'group-hover:opacity-100' : 'opacity-100 bg-transparent'} transition-opacity`}>
                            <label className="cursor-pointer px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded shadow-md hover:bg-primary/90 flex items-center gap-1">
                                {isUploadingLogo ? <Loader2 className="animate-spin h-3 w-3" /> : <UploadCloud className="h-3 w-3" />}
                                {logoUrl ? (isUploadingLogo ? "..." : "Ganti") : "Unggah"}
                                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={isUploadingLogo} />
                            </label>
                        </div>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold">Logo Nota / Struk</h2>
                        <p className="text-sm text-muted-foreground mt-1">Logo ini akan dicetak di setiap nota dan struk penjualan. Gunakan gambar kotak (1:1) dengan format PNG transparan agar hasil maksimal.</p>
                    </div>
                </div>

                <div className="p-5 rounded-xl border border-border bg-background/50 space-y-5">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Informasi Toko</h2>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Store className="h-4 w-4 text-muted-foreground" />
                            Nama Toko
                        </label>
                        <input
                            required type="text" value={form.storeName}
                            onChange={e => setForm({ ...form, storeName: e.target.value })}
                            className="w-full px-4 py-2 border border-border bg-background rounded-lg focus:ring-primary focus:border-primary transition-all outline-none text-sm"
                            placeholder="Masukkan nama toko"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            Nomor Telepon
                        </label>
                        <input
                            type="tel" value={form.storePhone}
                            onChange={e => setForm({ ...form, storePhone: e.target.value })}
                            className="w-full px-4 py-2 border border-border bg-background rounded-lg focus:ring-primary focus:border-primary transition-all outline-none text-sm"
                            placeholder="Contoh: 081234567890"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            Alamat Toko Lengkap
                        </label>
                        <textarea
                            rows={3} value={form.storeAddress}
                            onChange={e => setForm({ ...form, storeAddress: e.target.value })}
                            className="w-full px-4 py-2 border border-border bg-background rounded-lg focus:ring-primary focus:border-primary transition-all outline-none resize-none text-sm"
                            placeholder="Tambahkan alamat toko yang bisa dicetak di struk kasir"
                        />
                    </div>
                </div>

                {/* Advanced Pricing Toggle */}
                <div className="p-5 rounded-xl border border-border bg-background/50">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Mode Pricing Lanjutan</h2>

                    <div
                        className={`flex items-start gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${form.enableAdvancedPricing ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                        onClick={() => setForm({ ...form, enableAdvancedPricing: !form.enableAdvancedPricing })}
                    >
                        <div className="shrink-0 mt-0.5">
                            {form.enableAdvancedPricing
                                ? <ToggleRight className="w-7 h-7 text-primary" />
                                : <ToggleLeft className="w-7 h-7 text-muted-foreground" />
                            }
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <Ruler className="w-4 h-4 text-muted-foreground" />
                                <p className="font-semibold text-foreground">Aktifkan Mode Pricing Berdasarkan Luas</p>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.enableAdvancedPricing ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                    {form.enableAdvancedPricing ? 'Aktif' : 'Nonaktif'}
                                </span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                                Untuk <strong>Digital Printing, Percetakan, Custom Printing</strong> dll. Aktifkan ini agar produk bisa dihitung berdasarkan luas cetak (meter × meter). Di POS, kasir cukup input lebar dan tinggi, harga & pengurangan stok bahan dihitung otomatis.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Tax Configuration */}
                <div className="p-5 rounded-xl border border-border bg-background/50 space-y-5">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Konfigurasi Pajak (PPN)</h2>

                    <div
                        className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${form.enableTax ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}
                        onClick={() => setForm({ ...form, enableTax: !form.enableTax })}
                    >
                        <div>
                            <p className="font-semibold text-foreground flex items-center gap-2">
                                <Percent className="w-4 h-4 text-muted-foreground" />
                                Aktifkan PPN Global
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">Jika aktif, kasir akan otomatis mengenakan pajak pada setiap transaksi.</p>
                        </div>
                        <div className="shrink-0">
                            {form.enableTax
                                ? <ToggleRight className="w-8 h-8 text-primary" />
                                : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                            }
                        </div>
                    </div>

                    {form.enableTax && (
                        <div className="p-4 bg-muted/30 rounded-lg border border-border flex items-center gap-4">
                            <label className="text-sm font-medium whitespace-nowrap">Persentase PPN (%):</label>
                            <input
                                type="number" step="0.1" min="0" value={form.taxRate}
                                onChange={e => setForm({ ...form, taxRate: Number(e.target.value) })}
                                className="w-32 px-4 py-2 border border-border bg-background rounded-lg focus:ring-primary focus:border-primary outline-none"
                            />
                        </div>
                    )}
                </div>

                {/* Operator PIN */}
                <div className="p-5 rounded-xl border border-border bg-background/50 space-y-4">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">PIN Operator Produksi</h2>
                    <p className="text-sm text-muted-foreground">PIN 4-6 digit yang digunakan operator mesin untuk mengakses halaman antrian produksi tanpa harus login.</p>
                    <div className="space-y-2">
                        <label className="text-sm font-medium flex items-center gap-2">
                            <KeyRound className="h-4 w-4 text-muted-foreground" />
                            PIN Operator
                        </label>
                        <input
                            type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                            value={form.operatorPin}
                            onChange={e => setForm({ ...form, operatorPin: e.target.value.replace(/\D/g, '') })}
                            className="w-40 px-4 py-2 border border-border bg-background rounded-lg focus:ring-primary focus:border-primary transition-all outline-none text-sm font-mono tracking-widest"
                            placeholder="Contoh: 1234"
                        />
                        <p className="text-xs text-muted-foreground">Operator bisa akses <strong>/produksi</strong> dan masukkan PIN ini untuk melihat antrian cetak.</p>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    Simpan Perubahan
                </button>
            </form>
        </div>
    );
}
