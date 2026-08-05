import { Store, Megaphone, GraduationCap, Camera, Building2, Briefcase } from 'lucide-react';
import { CONFIG } from '../../config.js';

const PERSONAS = [
  {
    icon: Store,
    title: 'UMKM & Brand Owner',
    body: 'Konten produk harian tanpa harus hire designer freelance tiap minggu.',
    tag: 'PALING COCOK',
  },
  {
    icon: Megaphone,
    title: 'Performance Marketer',
    body: 'Bikin 20 variasi creative test untuk A/B Meta Ads dalam satu sore.',
  },
  {
    icon: Camera,
    title: 'Content Creator',
    body: 'Thumbnail YouTube dan cover TikTok yang konsisten gaya, gak mati ide.',
  },
  {
    icon: GraduationCap,
    title: 'Course Creator & Mentor',
    body: 'Banner promosi kelas, ebook cover, slide pembuka — semua dari satu studio.',
  },
  {
    icon: Building2,
    title: 'Agency & Freelancer',
    body: 'Brief klien masuk pagi, mockup ready siang. Margin proyek naik tajam.',
  },
  {
    icon: Briefcase,
    title: 'Reseller & Dropshipper',
    body: 'Asset visual untuk tiap SKU baru tanpa nambah biaya produksi konten.',
  },
];

export default function AudienceCards() {
  return (
    <section className="relative py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl reveal">
          <span className="eyebrow"><span className="dot" /> dipakai oleh</span>
          <h2 className="h-section mt-4">
            {CONFIG.brandName} dibuat untuk <span className="text-grad-red">enam tipe orang</span> ini.
          </h2>
          <p className="mt-4 text-text-mut">
            Kalau salah satu deskripsi di bawah terdengar seperti kamu — {CONFIG.brandName}
            akan langsung kepake hari pertama akses.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PERSONAS.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="soft-border card-lift p-5 relative reveal"
                style={{ animationDelay: `${i * 70}ms` }}
              >
                {p.tag && (
                  <span className="absolute top-3 right-3 text-[8px] mono uppercase tracking-widest bg-accent text-white px-1.5 py-0.5 rounded">
                    {p.tag}
                  </span>
                )}
                <div className="inline-flex w-10 h-10 rounded-lg items-center justify-center bg-accent-sm border border-border mb-3">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-sm font-bold text-text">{p.title}</h3>
                <p className="mt-1.5 text-xs text-text-mut leading-relaxed">{p.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
