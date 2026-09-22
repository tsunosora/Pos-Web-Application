import { redirect } from 'next/navigation';

// Akses Menu Role pindah ke Pengaturan → Tim & Cabang (22 Sep 2026). Tautan lama tetap jalan.
export default function AksesMenuLama() {
    redirect('/settings/akses-menu');
}
