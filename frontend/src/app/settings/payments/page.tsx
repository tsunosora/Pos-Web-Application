"use client";

import { useState, useEffect } from "react";
import { getSettings, uploadQrisImage, getBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } from "@/lib/api";
import { Loader2, UploadCloud, Plus, Settings2, Trash2, CreditCard } from "lucide-react";
import Image from "next/image";

export default function PaymentSettings() {
    const [qrisUrl, setQrisUrl] = useState<string | null>(null);
    const [banks, setBanks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);

    // Form
    const [showBankForm, setShowBankForm] = useState(false);
    const [bankForm, setBankForm] = useState({ id: 0, bankName: '', accountNumber: '', accountOwner: '', isActive: true });

    const loadData = async () => {
        try {
            const [settings, bankData] = await Promise.all([getSettings(), getBankAccounts()]);
            setQrisUrl(settings.qrisImageUrl || null);
            setBanks(bankData);
        } catch (error) {
            console.error("Gagal memuat pengaturan pembayaran", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleQrisUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const res = await uploadQrisImage(file);
            setQrisUrl(res.url); // Returns the URL to the public folder
            alert("QRIS Berhasil Diunggah!");
        } catch (error) {
            console.error(error);
            alert("Gagal mengunggah QRIS.");
        } finally {
            setIsUploading(false);
        }
    };

    const handleSaveBank = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (bankForm.id) {
                await updateBankAccount(bankForm.id, bankForm);
            } else {
                await createBankAccount({ ...bankForm, id: undefined });
            }
            setShowBankForm(false);
            setBankForm({ id: 0, bankName: '', accountNumber: '', accountOwner: '', isActive: true });
            loadData();
        } catch (error) {
            console.error(error);
            alert("Gagal menyimpan bank.");
        }
    };

    const handleDeleteBank = async (id: number) => {
        if (!confirm("Hapus rekening ini?")) return;
        try {
            await deleteBankAccount(id);
            loadData();
        } catch (error) {
            console.error(error);
            alert("Gagal menghapus rekening.");
        }
    };

    if (isLoading) return <div className="p-8 flex justify-center text-muted-foreground"><Loader2 className="animate-spin" /></div>;

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    return (
        <div className="p-6">
            <div className="flex items-start gap-3 pb-4 mb-6 border-b border-border">
                <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                    <CreditCard className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight">Metode Pembayaran</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">QRIS toko & daftar rekening bank yang ditampilkan di kasir.</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 items-start">

                {/* QRIS SECTION */}
                <div className="rounded-xl p-6 border border-border bg-background/50">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <UploadCloud className="h-5 w-5 text-primary" />
                        Kode QRIS Toko
                    </h2>
                    <p className="text-sm text-muted-foreground mb-4">Unggah gambar QRIS aktif toko yang nantinya akan ditampilkan ke pelanggan saat mereka memilih metode pembayaran QRIS di kasir.</p>

                    <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-border rounded-xl bg-muted/20 hover:bg-muted/50 transition-colors relative group overflow-hidden">
                        {qrisUrl ? (
                            <div className="w-full flex items-center justify-center">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={`${baseUrl}${qrisUrl}`} alt="QRIS" className="w-48 h-48 object-contain rounded-lg shadow-sm" />
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <UploadCloud className="h-10 w-10 text-muted-foreground/50 mx-auto mb-2" />
                                <span className="text-sm font-medium text-muted-foreground">Pilih gambar JPEG/PNG</span>
                            </div>
                        )}

                        <div className={`absolute inset-0 bg-background/80 flex items-center justify-center opacity-0 ${qrisUrl ? 'group-hover:opacity-100' : 'opacity-100 bg-transparent'} transition-opacity`}>
                            <label className="cursor-pointer px-4 py-2 bg-primary text-primary-foreground font-semibold rounded-lg shadow-md hover:bg-primary/90 transition-transform active:scale-95 flex items-center gap-2">
                                {isUploading ? <Loader2 className="animate-spin h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
                                {qrisUrl ? "Ganti QRIS" : "Unggah QRIS"}
                                <input type="file" accept="image/*" className="hidden" onChange={handleQrisUpload} disabled={isUploading} />
                            </label>
                        </div>
                    </div>
                </div>

                {/* BANK TRANSFER SECTION */}
                <div className="rounded-xl p-6 border border-border bg-background/50 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            <Settings2 className="h-5 w-5 text-primary" />
                            Transfer Bank
                        </h2>
                        <button
                            onClick={() => {
                                setBankForm({ id: 0, bankName: '', accountNumber: '', accountOwner: '', isActive: true });
                                setShowBankForm(true);
                            }}
                            className="bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground p-1.5 rounded-lg transition-colors"
                            title="Tambah Rekening"
                        >
                            <Plus className="h-5 w-5" />
                        </button>
                    </div>

                    <div className="flex-1 space-y-3">
                        {banks.length === 0 ? (
                            <p className="text-sm text-center py-4 text-muted-foreground">Belum ada rekening bank yang ditambahkan.</p>
                        ) : (
                            banks.map(bank => (
                                <div key={bank.id} className="flex items-center justify-between p-3 border border-border bg-background rounded-xl">
                                    <div>
                                        <p className="font-bold text-foreground text-sm uppercase">{bank.bankName}</p>
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground">{bank.accountNumber}</span>
                                            <span>a.n {bank.accountOwner}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => {
                                                setBankForm(bank);
                                                setShowBankForm(true);
                                            }}
                                            className="text-xs font-semibold px-2 py-1 rounded bg-muted hover:bg-muted/80 transition-colors"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDeleteBank(bank.id)}
                                            className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 p-1 rounded transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Bank Form Modal */}
            {showBankForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
                    <div className="bg-card w-full max-w-sm rounded-xl border border-border shadow-lg overflow-hidden">
                        <div className="p-4 border-b border-border">
                            <h3 className="font-bold">{bankForm.id ? "Edit Rekening" : "Tambah Rekening Baru"}</h3>
                        </div>
                        <form onSubmit={handleSaveBank} className="p-4 space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nama Bank</label>
                                <input required type="text" value={bankForm.bankName} onChange={e => setBankForm({ ...bankForm, bankName: e.target.value })} placeholder="BCA / Mandiri / BNI" className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm uppercase" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">No. Rekening</label>
                                <input required type="text" value={bankForm.accountNumber} onChange={e => setBankForm({ ...bankForm, accountNumber: e.target.value })} placeholder="0987654321" className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm font-mono" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Nama Pemilik (atas nama)</label>
                                <input required type="text" value={bankForm.accountOwner} onChange={e => setBankForm({ ...bankForm, accountOwner: e.target.value })} placeholder="John Doe" className="w-full px-3 py-2 bg-background border border-border rounded-lg outline-none focus:border-primary text-sm uppercase" />
                            </div>

                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setShowBankForm(false)} className="px-4 py-2 text-sm font-semibold rounded-lg bg-muted hover:bg-muted/80">Batal</button>
                                <button type="submit" className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90">Simpan Detail</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
