import { Star, Quote } from 'lucide-react';
import SafeImage from '../primitives/SafeImage.jsx';
import { TESTI_AVATARS } from '../data/galleryManifest.js';

const TESTIS = [
  { name: 'Rendra A.',  role: 'Owner brand skincare',  body: 'Biasanya brief ke designer 3 hari kelar, sekarang sore racik design — malamnya udah jalanin Meta Ads. Game changer buat tim kecil.' },
  { name: 'Aulia M.',   role: 'YouTuber 240k subs',    body: 'Thumbnail mode-nya ngeselin di awal (kenapa enak banget), sekarang gak pernah lagi mikir layout dari nol.' },
  { name: 'Bagas D.',   role: 'Performance marketer',  body: 'Buat 30 variant creative test pagi, malamnya udah ada winning ads. ROAS naik 1.8x dalam dua minggu.' },
  { name: 'Kirana S.',  role: 'Course creator',        body: 'Banner promo kelas, e-book cover, slide cover — semua dari satu studio. Brand jadi keliatan konsisten.' },
  { name: 'Yoga P.',    role: 'UMKM kopi specialty',   body: 'Awalnya skeptis, tapi setelah lihat hasil typography mode-nya... ya udah, langsung lifetime.' },
  { name: 'Dinda L.',   role: 'Agency partner',        body: 'Margin proyek visual naik karena waktu produksi ke-cut drastis. Klien gak tau bedanya, dan itu poinnya.' },
];

export default function Testimonials() {
  const items = [...TESTIS, ...TESTIS];

  return (
    <section className="relative py-24 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mb-10">
        <div className="max-w-2xl reveal">
          <span className="eyebrow"><span className="dot" /> dari user batch awal</span>
          <h2 className="h-section mt-4">
            Yang sudah pakai <span className="text-grad-red">nggak balik lagi</span> ke cara lama.
          </h2>
        </div>
      </div>

      <div className="marquee-mask marquee-pause overflow-hidden">
        <div className="marquee-track marquee-medium">
          {items.map((t, i) => (
            <div key={i} className="shrink-0 w-[340px] sm:w-[380px] px-3">
              <div className="soft-border p-5 h-full bg-bg-panel relative">
                <Quote className="absolute top-4 right-4 w-6 h-6 text-accent/15" />
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, k) => (
                    <Star key={k} className="w-3.5 h-3.5 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-text leading-relaxed">{t.body}</p>
                <div className="mt-4 flex items-center gap-3 pt-4 border-t border-border">
                  <div className="w-9 h-9 rounded-full overflow-hidden border border-border bg-bg-deep shrink-0">
                    <SafeImage
                      src={TESTI_AVATARS[i % TESTI_AVATARS.length]}
                      alt={t.name}
                      className="w-full h-full object-cover"
                      fallback={
                        <div className="w-full h-full bg-accent-sm flex items-center justify-center text-[11px] font-bold text-accent">
                          {t.name.split(' ').map(w => w[0]).join('')}
                        </div>
                      }
                    />
                  </div>
                  <div className="leading-tight">
                    <div className="text-xs font-semibold text-text">{t.name}</div>
                    <div className="text-[10px] text-text-dim mono uppercase tracking-widest">{t.role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
