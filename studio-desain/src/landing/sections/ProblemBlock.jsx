import { Clock, Wallet, Repeat, Sparkles } from 'lucide-react';
import ScanlineGrid from '../primitives/ScanlineGrid.jsx';

const PAINS = [
  {
    icon: Clock,
    title: 'Revisi designer berhari-hari',
    body: 'Brief masuk Senin, file final baru kelar Kamis. Padahal momen iklan udah lewat duluan.',
  },
  {
    icon: Wallet,
    title: 'Biaya tool desain numpuk',
    body: 'Langganan Canva Pro, stok foto, plugin Photoshop — habis sebelum konten cuan.',
  },
  {
    icon: Repeat,
    title: 'Output AI gak konsisten',
    body: 'Tool AI sembarangan ujungnya hasil aneh, warna meleset, layout berantakan.',
  },
  {
    icon: Sparkles,
    title: 'Gak ngerti istilah desain',
    body: 'Tipografi? Composition? Color grading? Kamu cuma mau hasil yang clean dan jualan.',
  },
];

export default function ProblemBlock() {
  return (
    <section className="relative py-24 overflow-hidden">
      <ScanlineGrid />
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl reveal">
          <span className="eyebrow"><span className="dot" /> kenapa harus berubah</span>
          <h2 className="h-section mt-4">
            Bikin satu banner saja, <span className="text-grad-red">drama-nya banyak</span>.
          </h2>
          <p className="mt-4 text-text-mut">
            Konten harian, promo flash sale, thumbnail YouTube, story TikTok —
            semua butuh visual. Tapi proses pembuatannya selalu sama: lambat,
            mahal, dan bikin pusing.
          </p>
        </div>

        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PAINS.map((p, i) => {
            const Icon = p.icon;
            return (
              <div
                key={p.title}
                className="soft-border card-lift p-5 relative overflow-hidden reveal"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div className="corner-stripe opacity-60" />
                <div className="inline-flex w-10 h-10 rounded-lg items-center justify-center bg-accent-sm border border-border mb-4">
                  <Icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold text-sm text-text">{p.title}</h3>
                <p className="mt-2 text-xs text-text-mut leading-relaxed">{p.body}</p>
                <div className="absolute top-3 right-3 text-[9px] mono text-text-dim opacity-50">
                  {String(i + 1).padStart(2, '0')}/04
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
