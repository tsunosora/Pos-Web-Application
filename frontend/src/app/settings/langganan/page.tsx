'use client';

/**
 * Pengaturan → Langganan.
 *
 * Halaman ini memanggil BACKEND POS (`/langganan/*`), yang meneruskannya ke qendali.com sambil
 * menempelkan token instalasi dari env. Token tidak pernah lewat sini — lihat `lib/api/langganan.ts`.
 *
 * Dua aturan yang menentukan bentuk halaman ini, dua-duanya dari `docs/lisensi.md`:
 * 1. SEMUA ANGKA DATANG DARI API. Selisih prorata, tanggal berlaku, alasan penolakan — semuanya
 *    sudah dihitung penerbit dan dikirim sebagai kalimat siap tampil (`rincian`). Halaman ini
 *    tidak menghitung apa pun. Kalau dua sisi menghitung sendiri, suatu hari jawabannya beda.
 * 2. "Saya sudah transfer" TIDAK MELUNASKAN apa pun. Yang melunaskan cuma Qendali setelah
 *    mengecek mutasi bank. Tulisannya di layar harus jujur soal ini.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    AlertTriangle, ArrowRight, Ban, CheckCircle2, CreditCard, Gauge, Globe, Info, Loader2, Package,
    PlugZap, RefreshCw, Send, Wallet,
} from 'lucide-react';
import {
    batalkanPerubahan, gantiPaket, getLangganan, lepasDomain, lepasTambahan, pasangDomain,
    pasangTambahan, periksaDomain, pesanGalat, rupiah, segarkanLisensi, sudahTransfer, tanggal,
    type PilihanPaket, type PilihanTambahan, type RingkasanLangganan, type Tagihan,
} from '@/lib/api/langganan';
import { segarkanKeadaanLisensi, useLisensi } from '@/hooks/useLisensi';
import { barisPemakaian, type BarisPemakaian } from '@/lib/lisensi/pemakaian-batas';

/** Tagihan yang masih menunggu uang. Sisanya masuk riwayat. */
const TAGIHAN_TERBUKA = new Set(['terkirim', 'menunggu_verifikasi', 'telat']);

const KATA_STATUS: Record<string, string> = {
    terkirim: 'Belum dibayar',
    menunggu_verifikasi: 'Menunggu dicek Qendali',
    telat: 'Lewat jatuh tempo',
    lunas: 'Lunas',
    batal: 'Batal',
};

function Bagian({ judul, ikon: Ikon, anak, keterangan }: {
    judul: string; ikon: typeof Package; keterangan?: string; anak: React.ReactNode;
}) {
    return (
        <section className="rounded-xl border border-border bg-background/40">
            <header className="flex items-start gap-2.5 px-4 py-3 border-b border-border">
                <Ikon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                    <h2 className="text-sm font-bold leading-tight">{judul}</h2>
                    {keterangan && <p className="text-xs text-muted-foreground mt-0.5">{keterangan}</p>}
                </div>
            </header>
            <div className="p-4">{anak}</div>
        </section>
    );
}

/** Kalimat akibat dari API + jumlah yang harus dibayar. Tidak pernah dikarang di sini. */
function Akibat({ rincian, jumlah }: { rincian: string[]; jumlah: number }) {
    if (!rincian.length && !jumlah) return null;
    return (
        <div className="mt-2 space-y-1">
            {rincian.map((r, i) => (
                <p key={i} className="text-xs text-muted-foreground leading-snug">{r}</p>
            ))}
            {jumlah > 0 && (
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-500">
                    Perlu dibayar sekarang: {rupiah(jumlah)}
                </p>
            )}
        </div>
    );
}

export default function LanggananPage() {
    const qc = useQueryClient();
    const { data, isLoading, error } = useQuery({ queryKey: ['langganan'], queryFn: getLangganan, retry: false });
    // Batas & pemakaian datang dari kunci lisensi (`/saya/fitur`), BUKAN dari penerbit: yang
    // menegakkannya backend ini juga, jadi angka yang tampil harus angka yang sama dengan yang
    // menolak. Hook-nya di atas semua `return` awal karena hook tidak boleh dipanggil bersyarat.
    const { keadaan } = useLisensi();

    const [galat, setGalat] = useState('');
    const [kabar, setKabar] = useState('');
    // Langkah konfirmasi: WAJIB untuk perubahan yang menagih uang (jumlah > 0).
    const [konfirmasi, setKonfirmasi] = useState<
        { judul: string; rincian: string[]; jumlah: number; jalankan: () => void } | null
    >(null);
    const [catatan, setCatatan] = useState<Record<number, string>>({});
    const [domainBaru, setDomainBaru] = useState('');

    /**
     * Muat ulang ringkasan langganan DAN keadaan lisensi. Yang kedua penting: begitu sebuah
     * perubahan langsung berlaku, backend ikut menarik kunci baru — kalau cache `/saya/fitur`
     * tidak dibuang, menu barunya baru muncul setengah jam kemudian dan orangnya mengira
     * pembeliannya gagal.
     */
    const segar = async () => {
        await qc.invalidateQueries({ queryKey: ['langganan'] });
        await segarkanKeadaanLisensi(qc);
    };

    /** Satu pembungkus untuk semua aksi: pesan galat dari server ditampilkan apa adanya. */
    const aksi = useMutation({
        mutationFn: async (fn: () => Promise<unknown>) => fn(),
        onMutate: () => { setGalat(''); setKabar(''); },
        onSuccess: async (hasil) => {
            const status = (hasil as { status?: string })?.status;
            if (status === 'menunggu_bayar') setKabar('Tagihannya sudah dibuat. Perubahan berlaku begitu tagihan itu lunas.');
            else if (status === 'terjadwal') setKabar('Perubahan dijadwalkan. Kamu masih bisa membatalkannya sebelum berlaku.');
            else if (status === 'diterapkan') setKabar('Perubahan langsung berlaku. Lisensi ikut disegarkan.');
            else setKabar('Beres.');
            setKonfirmasi(null);
            await segar();
        },
        onError: (e) => { setGalat(pesanGalat(e)); setKonfirmasi(null); },
    });

    /** Perubahan berbayar minta konfirmasi dulu; yang gratis langsung jalan. */
    const ajukan = (judul: string, p: { rincian: string[]; jumlah: number }, fn: () => Promise<unknown>) => {
        if (p.jumlah > 0) {
            setKonfirmasi({ judul, rincian: p.rincian, jumlah: p.jumlah, jalankan: () => aksi.mutate(fn) });
            return;
        }
        aksi.mutate(fn);
    };

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-6 max-w-3xl">
                <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                    <div className="text-sm">
                        <p className="font-semibold">Belum bisa memuat data langganan.</p>
                        <p className="text-muted-foreground mt-1">{pesanGalat(error)}</p>
                        <p className="text-muted-foreground mt-1">Kasir tetap jalan seperti biasa — ini cuma halaman langganannya.</p>
                    </div>
                </div>
            </div>
        );
    }

    // ── Instalasi yang belum tersambung ke qendali.com ─────────────────────────────────
    // Keadaan NORMAL untuk instalasi lama & lingkungan pengembangan. Jangan dibuat
    // seperti kerusakan: tidak ada yang perlu dilakukan pemakai.
    if (!data.tersambung) {
        return (
            <div className="p-6 max-w-3xl space-y-4">
                <Kepala />
                <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
                    <PlugZap className="h-5 w-5 shrink-0 text-muted-foreground mt-0.5" />
                    <div className="text-sm">
                        <p className="font-semibold">Instalasi ini belum tersambung ke akun Qendali.</p>
                        <p className="text-muted-foreground mt-1">{data.pesan}</p>
                    </div>
                </div>
                {/* Belum tersambung tapi kuncinya sudah ada? Batasnya tetap berlaku, jadi tetap
                    ditampilkan. Kalau tidak ada kunci, bagian ini merender null sendiri. */}
                <PemakaianPaket keadaan={keadaan} />
            </div>
        );
    }

    const d: RingkasanLangganan = data;
    const { langganan: l, alamat, perubahanTertunda: tertunda } = d;
    const terbuka = d.tagihan.filter((t) => TAGIHAN_TERBUKA.has(t.status));
    const riwayat = d.tagihan.filter((t) => !TAGIHAN_TERBUKA.has(t.status)).slice(0, 5);

    return (
        <div className="p-6 max-w-3xl space-y-5">
            <Kepala nama={d.klien.nama} />

            {galat && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                    <p>{galat}</p>
                </div>
            )}
            {kabar && (
                <div className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <p>{kabar}</p>
                </div>
            )}

            {/* ── Paket sekarang ───────────────────────────────────────────────────── */}
            <Bagian judul="Paket sekarang" ikon={Package} anak={
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <Nilai label="Paket" isi={l.paket.nama ?? l.paket.kode} tebal />
                    <Nilai label="Harga per bulan" isi={rupiah(l.hargaBulanan)} catatan={l.hargaKhusus ? 'harga khusus' : undefined} />
                    <Nilai label="Status" isi={l.status} />
                    <Nilai label="Dibayar sampai" isi={tanggal(l.dibayarSampai)} />
                    <Nilai label="Fitur aktif" isi={`${d.fitur.length} fitur`} />
                    <Nilai label="Produk" isi={d.produk} />
                </div>
            } />

            {/* ── Pemakaian vs batas paket ─────────────────────────────────────────── */}
            <PemakaianPaket keadaan={keadaan} />

            {/* ── Perubahan tertunda ───────────────────────────────────────────────── */}
            {tertunda && (
                <Bagian judul="Perubahan yang sedang berjalan" ikon={ArrowRight} anak={
                    <div className="space-y-2">
                        <p className="text-sm font-medium">{tertunda.uraian}</p>
                        <p className="text-xs text-muted-foreground">
                            Status: <span className="font-semibold">{tertunda.statusTeks}</span>
                            {tertunda.berlakuPada && <> · berlaku {tanggal(tertunda.berlakuPada)}</>}
                        </p>
                        {tertunda.rincian.map((r, i) => (
                            <p key={i} className="text-xs text-muted-foreground">{r}</p>
                        ))}
                        <button
                            onClick={() => aksi.mutate(() => batalkanPerubahan())}
                            disabled={aksi.isPending}
                            className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                        >
                            <Ban className="h-3.5 w-3.5" /> Batalkan perubahan ini
                        </button>
                    </div>
                } />
            )}

            {/* ── Tagihan ──────────────────────────────────────────────────────────── */}
            <Bagian
                judul="Tagihan"
                ikon={Wallet}
                keterangan="Tombol di bawah cuma memberi tahu Qendali. Yang menandai LUNAS tetap Qendali, setelah mengecek mutasi bank."
                anak={
                    <div className="space-y-3">
                        {d.pembayaran.rekening?.nomor ? (
                            <p className="text-xs text-muted-foreground">
                                Transfer ke <span className="font-semibold text-foreground">{d.pembayaran.rekening.bank} {d.pembayaran.rekening.nomor}</span>
                                {d.pembayaran.rekening.nama && <> a.n. {d.pembayaran.rekening.nama}</>}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">{d.pembayaran.catatan}</p>
                        )}

                        {terbuka.length === 0 && (
                            <p className="text-sm text-muted-foreground">Tidak ada tagihan yang menunggu. </p>
                        )}

                        {terbuka.map((t) => (
                            <div key={t.id} className="rounded-lg border border-border p-3 space-y-2">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold">{t.nomor} · {rupiah(t.jumlah)}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {tanggal(t.periodeMulai)} – {tanggal(t.periodeSampai)} · jatuh tempo {tanggal(t.jatuhTempo)}
                                        </p>
                                        {t.rincian.map((r, i) => (
                                            <p key={i} className="text-xs text-muted-foreground">{r}</p>
                                        ))}
                                    </div>
                                    <LencanaStatus status={t.status} />
                                </div>

                                {t.status === 'menunggu_verifikasi' ? (
                                    <p className="text-xs text-muted-foreground">
                                        Sudah kamu tandai transfer. Tinggal menunggu Qendali mengecek mutasinya.
                                    </p>
                                ) : (
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            value={catatan[t.id] ?? ''}
                                            onChange={(e) => setCatatan((c) => ({ ...c, [t.id]: e.target.value }))}
                                            placeholder="Catatan, mis. TRF BCA 26/9 a.n. Budi"
                                            className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                                        />
                                        <button
                                            onClick={() => aksi.mutate(() => sudahTransfer(t.id, catatan[t.id] ?? ''))}
                                            disabled={aksi.isPending}
                                            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                        >
                                            <Send className="h-3.5 w-3.5" /> Saya sudah transfer
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}

                        {riwayat.length > 0 && (
                            <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                    Riwayat tagihan ({riwayat.length})
                                </summary>
                                <ul className="mt-2 space-y-1">
                                    {riwayat.map((t) => (
                                        <li key={t.id} className="flex justify-between gap-3 text-muted-foreground">
                                            <span>{t.nomor} · {tanggal(t.periodeMulai)}</span>
                                            <span>{rupiah(t.jumlah)} · {KATA_STATUS[t.status] ?? t.status}</span>
                                        </li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                }
            />

            {/* ── Ubah paket ───────────────────────────────────────────────────────── */}
            <Bagian
                judul="Ubah paket"
                ikon={CreditCard}
                keterangan="Naik paket berlaku setelah tagihan selisihnya lunas. Turun paket berlaku di akhir masa yang sudah dibayar."
                anak={
                    <div className="space-y-2">
                        {d.pilihanPaket.map((p) => (
                            <KartuPilihan
                                key={p.kode}
                                nama={p.nama}
                                harga={p.harga === 0 ? 'Gratis' : `${rupiah(p.harga)}/bln`}
                                sorot={p.sorot}
                                pilihan={p}
                                sibuk={aksi.isPending}
                                labelTombol={p.arah === 'naik' ? 'Naik ke sini' : 'Pindah ke sini'}
                                onPilih={() => ajukan(`Pindah ke paket ${p.nama}`, p, () => gantiPaket(p.kode))}
                                dilepas={p.dilepas}
                            />
                        ))}
                    </div>
                }
            />

            {/* ── Add-on ───────────────────────────────────────────────────────────── */}
            {d.tambahan.length > 0 && (
                <Bagian judul="Tambahan (add-on)" ikon={Package} anak={
                    <div className="space-y-2">
                        {d.tambahan.map((t) => (
                            <KartuPilihan
                                key={t.kode}
                                nama={t.nama}
                                harga={t.harga ? `${rupiah(t.harga)} ${t.bentuk}` : t.bentuk}
                                pilihan={t}
                                sibuk={aksi.isPending}
                                terpasang={t.terpasang}
                                labelTombol={t.aksi === 'pasang' ? 'Pasang' : 'Lepas'}
                                onPilih={() =>
                                    ajukan(
                                        `${t.aksi === 'pasang' ? 'Pasang' : 'Lepas'} ${t.nama}`,
                                        t,
                                        () => (t.aksi === 'pasang' ? pasangTambahan(t.kode) : lepasTambahan(t.kode)),
                                    )
                                }
                            />
                        ))}
                    </div>
                } />
            )}

            {/* ── Alamat & domain ──────────────────────────────────────────────────── */}
            <Bagian judul="Alamat aplikasi" ikon={Globe} anak={
                <div className="space-y-3">
                    <Nilai label="Alamat utama" isi={alamat.utama} tebal />

                    {!alamat.bolehDomainSendiri ? (
                        <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                            <p>
                                Paket {l.paket.nama ?? l.paket.kode} memakai subdomain {alamat.domainInduk} saja. Domain
                                sendiri ada di paket yang lebih tinggi — lihat bagian &ldquo;Ubah paket&rdquo; di atas.
                            </p>
                        </div>
                    ) : alamat.domainSendiri ? (
                        <div className="rounded-lg border border-border p-3 space-y-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                <p className="text-sm font-semibold">{alamat.domainSendiri.nama}</p>
                                <LencanaStatus status={alamat.domainSendiri.status} />
                            </div>
                            {alamat.domainSendiri.pesan && (
                                <p className="text-xs text-muted-foreground">{alamat.domainSendiri.pesan}</p>
                            )}
                            <div className="rounded-md bg-muted/60 p-2.5 text-xs font-mono space-y-0.5">
                                <p className="font-sans font-semibold text-muted-foreground mb-1">
                                    Pasang record ini di penyedia domainmu:
                                </p>
                                <p>Tipe: {alamat.domainSendiri.dns.jenis}</p>
                                <p>Nama: {alamat.domainSendiri.dns.namaRecord}</p>
                                <p>Tujuan: {alamat.domainSendiri.dns.tujuan}</p>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                                <button
                                    onClick={() => aksi.mutate(() => periksaDomain())}
                                    disabled={aksi.isPending}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" /> Periksa DNS
                                </button>
                                <button
                                    onClick={() => aksi.mutate(() => lepasDomain())}
                                    disabled={aksi.isPending}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                                >
                                    <Ban className="h-3.5 w-3.5" /> Lepas domain
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <p className="text-xs text-muted-foreground">
                                Punya domain sendiri? Beli di penyedia mana pun, lalu arahkan satu record CNAME ke
                                alamat di atas. Kami tidak menjual domain.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-2">
                                <input
                                    value={domainBaru}
                                    onChange={(e) => setDomainBaru(e.target.value)}
                                    placeholder="kasir.tokokamu.com"
                                    className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm"
                                />
                                <button
                                    onClick={() => aksi.mutate(() => pasangDomain(domainBaru.trim()))}
                                    disabled={aksi.isPending || !domainBaru.trim()}
                                    className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                                >
                                    Pasang domain
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            } />

            {/* Tombol manual: penyegaran OTOMATIS sudah dilakukan backend begitu sebuah perubahan
                langsung berlaku. Yang ini untuk kasus "Qendali baru menandai tagihanku lunas" —
                supaya pemilik tidak perlu menunggu penyegaran harian jam 03.37. */}
            <div className="flex items-center justify-between gap-3 flex-wrap pt-1">
                <p className="text-xs text-muted-foreground">
                    Baru dinyatakan lunas oleh Qendali? Tarik lisensi terbarunya sekarang.
                </p>
                <button
                    onClick={() => aksi.mutate(async () => { await segarkanLisensi(); return { status: 'segar' }; })}
                    disabled={aksi.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                >
                    <RefreshCw className={`h-3.5 w-3.5 ${aksi.isPending ? 'animate-spin' : ''}`} /> Segarkan lisensi
                </button>
            </div>

            {/* ── Langkah konfirmasi (wajib kalau menagih uang) ─────────────────────── */}
            {konfirmasi && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl space-y-3">
                        <h3 className="text-base font-bold">{konfirmasi.judul}</h3>
                        <div className="space-y-1">
                            {konfirmasi.rincian.map((r, i) => (
                                <p key={i} className="text-sm text-muted-foreground leading-snug">{r}</p>
                            ))}
                        </div>
                        <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3">
                            <p className="text-sm font-semibold">Tagihan yang dibuat: {rupiah(konfirmasi.jumlah)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                                Perubahan ini baru berlaku setelah tagihannya lunas. Belum ada uang yang ditarik
                                sekarang — tagihannya muncul di bagian Tagihan untuk kamu transfer.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                onClick={() => setKonfirmasi(null)}
                                className="rounded-lg border border-border px-3 py-1.5 text-sm font-semibold hover:bg-muted"
                            >
                                Batal
                            </button>
                            <button
                                onClick={konfirmasi.jalankan}
                                disabled={aksi.isPending}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            >
                                {aksi.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                Ya, buat tagihannya
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Potongan kecil ─────────────────────────────────────────────────────────────────────

function Kepala({ nama }: { nama?: string }) {
    return (
        <div className="flex items-start gap-3 pb-4 border-b border-border">
            <div className="hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CreditCard className="h-5 w-5" />
            </div>
            <div>
                <h1 className="text-xl font-bold tracking-tight">Langganan</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                    {nama ? <>Paket, tagihan, dan alamat untuk {nama}.</> : 'Paket, tagihan, dan alamat aplikasi.'}
                </p>
            </div>
        </div>
    );
}

/**
 * "Pengguna: 4 dari 5" — pemakaian vs batas paket.
 *
 * Aturannya di `lib/lisensi/pemakaian-batas.ts` (murni & ada tesnya); di sini cuma tampilan.
 * Tidak merender apa pun kalau tidak ada batas yang berlaku — instalasi tanpa kunci dan paket
 * tanpa batas tidak perlu melihat bagian ini sama sekali.
 *
 * SENGAJA tidak ada tombol apa pun di sini. Bagian ini keterangan, bukan penjagaan: yang
 * menolak penambahan adalah backend, dan mematikan tombol "Tambah pengguna" dari sini berarti
 * satu permintaan `/saya/fitur` yang gagal bisa mengunci pemilik dari halaman karyawannya.
 */
function PemakaianPaket({ keadaan }: { keadaan: Parameters<typeof barisPemakaian>[0] }) {
    const baris = barisPemakaian(keadaan);
    if (baris.length === 0) return null;

    return (
        <Bagian
            judul="Pemakaian paket"
            ikon={Gauge}
            keterangan="Yang dihitung hanya yang aktif — karyawan yang sudah keluar dan cabang yang ditutup tidak ikut."
            anak={<div className="space-y-3">{baris.map((b) => <BarisPakai key={b.kode} b={b} />)}</div>}
        />
    );
}

function BarisPakai({ b }: { b: BarisPemakaian }) {
    // Amber untuk dua-duanya, bukan merah: klien yang penuh bukan klien yang rusak, dan warna
    // genting di halaman tagihan cuma membuat orang menelepon panik.
    const warnaBar =
        b.nada === 'penuh' ? 'bg-amber-600' : b.nada === 'dekat' ? 'bg-amber-500' : 'bg-primary/60';
    const warnaAngka = b.nada === 'biasa' ? '' : 'text-amber-700 dark:text-amber-500';
    // Lebih dari batas tetap digambar penuh, tidak melimpah keluar kotaknya.
    const persen = b.batas > 0 ? Math.min(100, Math.round((b.pemakaian / b.batas) * 100)) : 100;

    return (
        <div>
            <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">{b.nama}</p>
                <p className={`text-sm font-semibold tabular-nums ${warnaAngka}`}>{b.teks}</p>
            </div>
            <div
                className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                role="img"
                aria-label={`${b.nama}: ${b.teks}`}
            >
                <div className={`h-full rounded-full ${warnaBar}`} style={{ width: `${persen}%` }} />
            </div>
            {b.catatan && <p className="mt-1 text-xs text-muted-foreground">{b.catatan}</p>}
        </div>
    );
}

function Nilai({ label, isi, tebal, catatan }: { label: string; isi: string; tebal?: boolean; catatan?: string }) {
    return (
        <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className={`text-sm truncate ${tebal ? 'font-bold' : 'font-medium'}`} title={isi}>{isi}</p>
            {catatan && <p className="text-[11px] text-muted-foreground">{catatan}</p>}
        </div>
    );
}

function LencanaStatus({ status }: { status: string }) {
    const warna =
        status === 'lunas' || status === 'aktif'
            ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
            : status === 'telat'
              ? 'bg-destructive/15 text-destructive'
              : 'bg-amber-500/15 text-amber-700 dark:text-amber-500';
    return (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${warna}`}>
            {KATA_STATUS[status] ?? status.replace(/_/g, ' ')}
        </span>
    );
}

/** Kartu satu paket / add-on. `alasan` dari API menggantikan tombol kalau tidak boleh. */
function KartuPilihan({ nama, harga, sorot, pilihan, onPilih, labelTombol, sibuk, terpasang, dilepas }: {
    nama: string;
    harga: string;
    sorot?: string[];
    pilihan: PilihanPaket | PilihanTambahan;
    onPilih: () => void;
    labelTombol: string;
    sibuk: boolean;
    terpasang?: boolean;
    dilepas?: string[];
}) {
    return (
        <div className="rounded-lg border border-border p-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                    <p className="text-sm font-semibold">
                        {nama}
                        {terpasang && <span className="ml-2 text-[11px] font-medium text-emerald-600">terpasang</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{harga}</p>
                    {sorot && sorot.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">{sorot.join(' · ')}</p>
                    )}
                </div>
                {pilihan.boleh ? (
                    <button
                        onClick={onPilih}
                        disabled={sibuk}
                        className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
                    >
                        {labelTombol}
                    </button>
                ) : (
                    // Alasannya datang dari API — jangan ditebak sendiri di sini.
                    <span className="shrink-0 max-w-[16rem] text-right text-xs text-muted-foreground">
                        {pilihan.alasan ?? 'Belum bisa dipilih.'}
                    </span>
                )}
            </div>
            {pilihan.boleh && <Akibat rincian={pilihan.rincian} jumlah={pilihan.jumlah} />}
            {dilepas && dilepas.length > 0 && (
                <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-500">
                    Ikut hilang: {dilepas.join(', ')}
                </p>
            )}
        </div>
    );
}
