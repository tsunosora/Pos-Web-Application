/**
 * Satu-satunya sumber keadaan lisensi di frontend.
 *
 * Mengambil `GET /saya/fitur` sekali setelah masuk, menyimpannya di cache React Query, dan
 * menyediakan `punyaFitur()` + keadaan (aktif / tenggang / hanya-baca / tanpa lisensi).
 * Semua komponen memanggil hook ini, bukan endpoint-nya — jadi berapa pun komponen yang
 * bertanya, permintaannya tetap satu.
 *
 * GAGAL-TERBUKA: `retry: false` plus `buatPunyaFitur(undefined)` di `aturan-menu.ts` berarti
 * permintaan yang gagal, lambat, atau menjawab galat sama saja dengan "semua fitur ada".
 * Tidak ada `isLoading` yang ditunggu dan tidak ada menu yang disembunyikan sementara.
 * Kasir tidak boleh kehilangan menu gara-gara satu permintaan gagal.
 *
 * Kapan disegarkan:
 * - sekali saat komponen pertama memakainya (pasca-login, karena layout dasbor perlu login),
 * - tiap 30 menit — bukan tiap pindah halaman: isi paket berubah beberapa kali setahun,
 *   sementara orang berpindah halaman ratusan kali sehari,
 * - segera setelah Pengaturan → Langganan mengubah sesuatu, lewat `segarkanKeadaanLisensi()`.
 */
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { getFiturSaya } from '@/lib/api/lisensi';
import {
    bolehLihatMenu as bolehLihatMenuAturan,
    buatPunyaFitur,
    spandukLisensi,
    type KeadaanLisensi,
    type PunyaFitur,
    type Spanduk,
} from '@/lib/lisensi/aturan-menu';

export const KUNCI_KUERI_LISENSI = ['lisensi-fitur'] as const;

const SETENGAH_JAM = 30 * 60 * 1000;

/** Buang cache keadaan lisensi supaya ditarik ulang. Dipanggil dari halaman Langganan. */
export function segarkanKeadaanLisensi(qc: QueryClient): Promise<void> {
    return qc.invalidateQueries({ queryKey: KUNCI_KUERI_LISENSI });
}

export interface HasilLisensi {
    /** Jawaban `/saya/fitur`, atau null selama belum termuat / gagal diambil. */
    keadaan: KeadaanLisensi | null;
    /** Boleh pakai fitur ini? Selalu true kalau tidak ditegakkan / data belum ada / gagal ambil. */
    punyaFitur: PunyaFitur;
    /** Menu ini tampil? Menu yang tidak dipetakan selalu true. */
    bolehLihatMenu: (href: string) => boolean;
    /** Spanduk yang perlu dipasang, atau null (termasuk saat tanpa lisensi). */
    spanduk: Spanduk | null;
    /** true kalau memang ADA kunci yang ditegakkan. false = jangan sembunyikan apa pun. */
    ditegakkan: boolean;
    status: KeadaanLisensi['status'];
    /** Sisa hari masa berlaku, null kalau tidak diketahui. */
    sisaHari: number | null;
    sisaHariTenggang: number | null;
    /** Kode paket (`produksi`, `bisnis`, …) — untuk ditampilkan, bukan untuk memutuskan izin. */
    paket: string | null;
    namaKlien: string | null;
    /** Permintaannya gagal. Hanya untuk keterangan; perilakunya tetap gagal-terbuka. */
    gagal: boolean;
}

export function useLisensi(): HasilLisensi {
    const { data, isError } = useQuery({
        queryKey: KUNCI_KUERI_LISENSI,
        queryFn: getFiturSaya,
        staleTime: SETENGAH_JAM,
        refetchInterval: SETENGAH_JAM,
        refetchOnWindowFocus: false,
        // Jangan mencoba ulang: gagal = gagal-terbuka, dan menahan sesuatu sambil mencoba ulang
        // justru membuat menu berkedip muncul-hilang.
        retry: false,
    });

    const keadaan = data ?? null;
    const punyaFitur = useMemo(() => buatPunyaFitur(keadaan), [keadaan]);
    const bolehLihatMenu = useCallback((href: string) => bolehLihatMenuAturan(href, punyaFitur), [punyaFitur]);
    const spanduk = useMemo(() => spandukLisensi(keadaan), [keadaan]);

    return {
        keadaan,
        punyaFitur,
        bolehLihatMenu,
        spanduk,
        ditegakkan: keadaan?.ditegakkan ?? false,
        status: keadaan?.status ?? 'tanpa_lisensi',
        sisaHari: keadaan?.sisaHari ?? null,
        sisaHariTenggang: keadaan?.sisaHariTenggang ?? null,
        paket: keadaan?.paket ?? null,
        namaKlien: keadaan?.namaKlien ?? null,
        gagal: isError,
    };
}

/** Versi ringkas untuk komponen yang cuma butuh `punyaFitur` (Sidebar, SubNav, Pengaturan). */
export function usePunyaFitur(): PunyaFitur {
    return useLisensi().punyaFitur;
}

/** Dipakai halaman yang perlu `useQueryClient` sendiri untuk menyegarkan keadaan lisensi. */
export function useSegarkanLisensi(): () => Promise<void> {
    const qc = useQueryClient();
    return useCallback(() => segarkanKeadaanLisensi(qc), [qc]);
}
