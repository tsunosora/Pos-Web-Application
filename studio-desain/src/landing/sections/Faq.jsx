import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { CONFIG } from '../../config.js';

const FAQS = [
  {
    q: `Apa bedanya ${CONFIG.brandName} dengan Canva atau Photoshop?`,
    a: `Canva dan Photoshop adalah editor — kamu harus tahu desain dulu, atur layer satu per satu. ${CONFIG.brandName} adalah studio otomatis — kamu cukup isi brief, hasilnya langsung jadi visual siap upload tanpa edit manual.`,
  },
  {
    q: 'Apakah saya butuh skill desain untuk pakai ini?',
    a: `Tidak. Itu justru masalah yang ${CONFIG.brandName} selesaikan. Cukup pilih kategori industri, isi nama produk, pilih warna brand — selebihnya engine yang kerjain. Pemula total pun bisa pakai hari pertama.`,
  },
  {
    q: 'Format dan rasio apa saja yang bisa dihasilkan?',
    a: 'Semua format komersial yang biasa dipakai: feed Instagram 1:1, story / reels / TikTok / shorts 9:16, thumbnail YouTube 16:9, dan typography ads 4:5. Tinggal pilih sesuai kebutuhan upload.',
  },
  {
    q: 'Apakah ada biaya bulanan?',
    a: `Tidak. ${CONFIG.brandName} adalah sekali bayar — Rp ${CONFIG.price} selama early access — akses penuh seumur hidup. Tidak ada paywall, tidak ada limit harian.`,
  },
  {
    q: 'Apakah saya dapat update mode baru di masa depan?',
    a: 'Iya. Semua mode dan kategori baru yang kami rilis akan otomatis tersedia di akunmu tanpa biaya tambahan. Itu makna lifetime sesungguhnya.',
  },
  {
    q: 'Bagaimana cara akses setelah bayar?',
    a: 'Setelah pembayaran terkonfirmasi, kamu akan menerima email berisi akses masuk ke studio. Buka tautannya, langsung masuk, dan mulai bikin design.',
  },
  {
    q: 'Berapa banyak design yang bisa saya hasilkan?',
    a: 'Unlimited. Tidak ada quota, tidak ada throttle per hari. Mau bikin 5 atau 500 visual sehari — sama saja, gratis selamanya.',
  },
  {
    q: 'Apakah hasilnya bisa untuk pemakaian komersial?',
    a: `Iya. Semua design yang kamu hasilkan lewat ${CONFIG.brandName} bebas dipakai untuk iklan berbayar, konten brand, ads test, listing marketplace, sampai cetak fisik.`,
  },
  {
    q: 'Saya pemula total, beneran bisa pakai?',
    a: `Bisa. ${CONFIG.brandName} dirancang dengan asumsi user tidak pernah buka Canva sekalipun. Pilih kategori, isi nama produk, klik salin design. Selesai dalam 30 detik.`,
  },
  {
    q: 'Apakah hasilnya bisa di-custom sesuai brand kita?',
    a: 'Sangat bisa. Kamu input warna brand, gaya komunikasi, dan persona produk — engine otomatis menyesuaikan komposisi, palette, dan tone visual agar tetap on-brand.',
  },
];

export default function Faq() {
  const [open, setOpen] = useState(0);

  return (
    <section id="faq" className="relative py-24">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center reveal">
          <span className="eyebrow"><span className="dot" /> pertanyaan umum</span>
          <h2 className="h-section mt-4">
            Yang sering <span className="text-grad-red">ditanyakan</span> sebelum order.
          </h2>
        </div>

        <div className="mt-12 space-y-2.5">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={i}
                className={`soft-border overflow-hidden transition-all ${isOpen ? 'border-border-strong' : ''}`}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? -1 : i)}
                  className="w-full px-5 py-4 flex items-start justify-between gap-4 text-left"
                >
                  <span className="flex items-start gap-3">
                    <span className="text-[10px] mono text-accent shrink-0 mt-1 tracking-widest">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="text-sm font-semibold text-text">{f.q}</span>
                  </span>
                  <span className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all ${isOpen ? 'bg-accent text-white rotate-180' : 'bg-bg-deep text-text-mut'}`}>
                    {isOpen ? <Minus className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </span>
                </button>
                <div
                  className="grid transition-all duration-300"
                  style={{ gridTemplateRows: isOpen ? '1fr' : '0fr' }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 pt-0 text-xs text-text-mut leading-relaxed pl-12">
                      {f.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
