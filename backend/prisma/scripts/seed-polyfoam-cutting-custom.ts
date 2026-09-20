/**
 * Tambah produk "Polyfoam Cutting Custom (Tanpa Stiker)".
 *
 * Papan Polyfoam 5mm dipotong bebas sesuai ukuran/pola — TANPA cetak stiker.
 * Basis harga AREA_BASED per m² (sama seperti "Stiker Polyfoam" id 202) supaya
 * kasir cukup input P×L dan sistem hitung luasnya sendiri.
 *
 * Jasa laser SENGAJA TIDAK dibundel di sini — tagih terpisah pakai produk
 * "Jasa Laser (per menit)" (id 87, varian LAS-002-BQN @Rp3.000/menit).
 *
 * Dua harga (Umum vs Member) dibuat sebagai DUA VARIAN, bukan priceTier:
 * VariantPriceTier itu tier per-KUANTITAS dan di transactions.service.ts hanya
 * dipakai saat pricingMode === 'UNIT' — tidak berlaku untuk AREA_BASED.
 *
 * Idempotent: kalau produk dgn nama sama sudah ada, script berhenti tanpa ubah apa pun.
 *
 * Run:
 *   cd backend && npx ts-node prisma/scripts/seed-polyfoam-cutting-custom.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const NAMA = 'Polyfoam Cutting Custom (Tanpa Stiker)';

// Modal bahan: Bahan Polyfoam 5mm (id 88) = Rp63.000 / lembar 2x1m (2 m²) → Rp31.500/m².
const HPP_PER_M2 = 31500;
const HARGA_UMUM = 75000;   // markup ±2,4x — setara markup Stiker Polyfoam Outdoor (170rb vs modal 68,7rb)
const HARGA_MEMBER = 60000; // diskon 20% dari harga umum

const DESKRIPSI = `✂️ POLYFOAM CUTTING CUSTOM — POTONG BEBAS, TANPA STIKER! ✂️
Papan Polyfoam 5mm dipotong sesuai ukuran atau pola yang kamu mau — polos tanpa cetak stiker. Tinggal pakai, tempel, atau finishing sendiri.

🎨 PILIHAN: potong bebas ukuran (P×L) maupun mengikuti pola desain.
✅ KUALITAS: tepian rapi & presisi, permukaan rata, tidak mudah penyok.
🧱 BAHAN & KETAHANAN: Polyfoam 5mm — ringan, kaku, dan kuat untuk display indoor.
💰 HARGA: Rp ${HARGA_UMUM.toLocaleString('id-ID')} /m² (customer umum) · Rp ${HARGA_MEMBER.toLocaleString('id-ID')} /m² (member/reseller). Contoh 50x50 cm (0,25 m²) umum = Rp ${(HARGA_UMUM / 4).toLocaleString('id-ID')}.
⚡ JASA LASER TERPISAH: potong pola pakai laser ditagih sendiri via "Jasa Laser (per menit)" Rp 3.000/menit.
🎯 COCOK UNTUK: backing display, mockup, prakarya, alas signage, huruf timbul, properti booth.
🛒 CARA ORDER:
1. Kirim ukuran (cm) atau file pola.
2. Pilih harga umum / member.
3. Konfirmasi luas & biaya, kami produksi.

⏱️ Estimasi 1-3 hari kerja. 📌 Butuh cetak full color? Pakai produk "Stiker Polyfoam".`;

async function main() {
    const existing = await prisma.product.findFirst({ where: { name: NAMA } });
    if (existing) {
        console.log(`⏭️  Produk "${NAMA}" sudah ada (id ${existing.id}) — tidak ada perubahan.`);
        return;
    }

    const kategori = await prisma.category.findFirst({ where: { name: 'Produk Custom' } });
    const unit = await prisma.unit.findFirst({ where: { name: 'Cm' } });
    if (!kategori) throw new Error('Kategori "Produk Custom" tidak ditemukan.');
    if (!unit) throw new Error('Unit "Cm" tidak ditemukan.');

    const produk = await prisma.product.create({
        data: {
            name: NAMA,
            description: DESKRIPSI,
            categoryId: kategori.id,
            unitId: unit.id,
            pricingMode: 'AREA_BASED',
            areaUnit: 'M2',
            pricePerUnit: HARGA_UMUM,
            requiresProduction: false,
            trackStock: false, // sama seperti Stiker Polyfoam — stok dipotong dari bahan, bukan produk jadi
            isActive: true,
            variants: {
                create: [
                    {
                        sku: 'PLYCUT-5MM-UMUM',
                        variantName: '5mm · Customer Umum',
                        price: HARGA_UMUM,
                        hpp: HPP_PER_M2,
                        stock: 0,
                    },
                    {
                        sku: 'PLYCUT-5MM-MEMBER',
                        variantName: '5mm · Member / Reseller',
                        price: HARGA_MEMBER,
                        hpp: HPP_PER_M2,
                        stock: 0,
                    },
                ],
            },
        },
        include: { variants: true, category: true, unit: true },
    });

    console.log(`✅ Produk dibuat: #${produk.id} ${produk.name}`);
    console.log(`   Kategori: ${produk.category.name} · Unit: ${produk.unit.name} · ${produk.pricingMode} per ${produk.areaUnit}`);
    for (const v of produk.variants) {
        console.log(`   • ${v.sku} — ${v.variantName} — Rp ${Number(v.price).toLocaleString('id-ID')}/m² (HPP ${Number(v.hpp).toLocaleString('id-ID')})`);
    }
}

main()
    .catch((e) => { console.error('❌ Gagal:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
