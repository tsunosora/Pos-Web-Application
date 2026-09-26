/**
 * `GET /saya/fitur` — isi kunci lisensi instalasi ini, untuk dipakai menyembunyikan menu.
 *
 * Yang tidak pernah ikut ke browser: kunci mentah (`q1.…`) dan token instalasi. Backend yang
 * memegang keduanya. Kalau suatu hari ada yang menambahkan salah satunya ke jawaban endpoint
 * ini "supaya frontend bisa memeriksa sendiri", itu langkah mundur: verifikasi di browser bisa
 * dimatikan siapa pun lewat DevTools, dan kunci yang sudah ada di browser gampang tersalin ke
 * pemasangan lain.
 */
import api from './client';
import type { KeadaanLisensi } from '@/lib/lisensi/aturan-menu';

export const getFiturSaya = async (): Promise<KeadaanLisensi> => (await api.get('/saya/fitur')).data;
