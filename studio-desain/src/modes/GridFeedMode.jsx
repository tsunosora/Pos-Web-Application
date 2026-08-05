import { useState } from 'react';
import { Box, PenLine, Palette, Grid3x3, Edit3, PlayCircle, ChevronDown } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import TextareaField from '../components/TextareaField.jsx';
import SelectField from '../components/SelectField.jsx';
import ColorSwatch from '../components/ColorSwatch.jsx';
import GridFeedTutorial from '../components/GridFeedTutorial.jsx';
import { CONFIG } from '../config.js';
import { GOALS, VISUAL_STYLES_GRID } from '../data/gridFeedOptions.js';

export default function GridFeedMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });
  const custom = !!state.useCustomColor;
  const [tutOpen, setTutOpen] = useState(false);   // dropdown teks
  const [animOpen, setAnimOpen] = useState(false); // modal animasi

  return (
    <div className="space-y-3">
      {/* Tutorial — dropdown teks lengkap + tombol putar animasi */}
      <div className="rounded-lg border border-accent/40 bg-accent-sm/20 overflow-hidden">
        <button type="button" onClick={() => setTutOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent-sm/30 transition">
          <span className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center shrink-0 shadow-[0_0_14px_rgba(var(--accent-rgb),0.5)]">
              <PlayCircle className="w-4 h-4 text-white" />
            </span>
            <span>
              <span className="block text-sm font-bold text-accent leading-tight">Tutorial: 9 Feed Konsisten</span>
              <span className="block text-[11px] text-text-mut">Cara pakai lengkap — Generate → ChatGPT → Auto Feeds AI → tiap feed</span>
            </span>
          </span>
          <ChevronDown className={`w-4 h-4 text-accent shrink-0 transition ${tutOpen ? 'rotate-180' : ''}`} />
        </button>

        {tutOpen && (
          <div className="px-4 pb-4 pt-3 border-t border-accent/20">
            <ol className="text-xs text-text-mut space-y-2.5 leading-relaxed list-none m-0">
              <li><b className="text-accent">1.</b> Isi info produk di bawah (atau klik <b className="text-text">Demo</b>). Klik <b className="text-text">Generate</b> → keluar konsep <b className="text-text">9 feed konsisten</b>, lalu klik <b className="text-text">Copy</b>.</li>
              <li><b className="text-accent">2.</b> Buka <a href={CONFIG.chatgptUrl} target="_blank" rel="noreferrer" className="text-accent underline font-semibold hover:text-accent-h">ChatGPT</a> → klik <b className="text-text">Buat gambar</b> → <b className="text-text">+ Tambah foto &amp; file</b> (upload foto produk) → tekan <b className="text-text">Ctrl+V</b> (paste prompt) → <b className="text-text">Kirim</b>. ChatGPT membuat <b className="text-text">1 gambar berisi 9 feed</b>.</li>
              <li><b className="text-accent">3.</b> Buka <a href={CONFIG.gptUrl || 'https://chatgpt.com/'} target="_blank" rel="noreferrer" className="text-accent underline font-semibold hover:text-accent-h">Auto Feeds AI</a> (Custom GPT) → <b className="text-text">upload gambar 9 feed</b> tadi → kirim.</li>
              <li><b className="text-accent">4.</b> Ketik <b className="text-text">GENERATE FEEDS 1</b> → AI buatkan gambar feed 1. Lanjut <b className="text-text">GENERATE FEEDS 2</b>, <b className="text-text">3</b>, … sampai <b className="text-text">9</b>.</li>
              <li><b className="text-accent">5.</b> Download tiap feed, lalu posting <b className="text-text">urut</b> agar susunan grid di profil rapi.</li>
            </ol>
            <button type="button" onClick={() => setAnimOpen(true)}
              className="mt-3.5 w-full flex items-center justify-center gap-2 rounded-lg bg-accent text-white text-sm font-semibold py-2.5 hover:brightness-110 transition shadow-[0_0_18px_rgba(var(--accent-rgb),0.4)]">
              <PlayCircle className="w-4 h-4" /> Putar Tutorial (Animasi)
            </button>
          </div>
        )}
      </div>

      <GridFeedTutorial open={animOpen} onClose={() => setAnimOpen(false)} />

      <Section num="A" title="Brand & Produk" icon={Box}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Nama Brand"  value={state.brandName}  onChange={set('brandName')}  required placeholder="POPO" />
          <TextField label="Username Instagram" value={state.username} onChange={set('username')} placeholder="@popoofficial" />
        </div>
        <div className="mt-3">
          <TextField label="Nama Produk" value={state.productName} onChange={set('productName')} required placeholder="Piano Anak Elektronik + Microphone" />
        </div>
        <div className="mt-3">
          <TextareaField label="Deskripsi Singkat Produk" value={state.productDesc} onChange={set('productDesc')} rows={2}
            placeholder="Piano elektronik anak 61/37 keys + mic, bantu anak belajar musik..." />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Manfaat Utama" value={state.mainBenefit} onChange={set('mainBenefit')} placeholder="Anak belajar musik sambil bermain" />
          <TextField label="Target Audience" value={state.targetAudience} onChange={set('targetAudience')} placeholder="Ibu muda, anak 3-8 tahun" />
        </div>
      </Section>

      <Section num="B" title="Pesan & CTA" icon={PenLine} badge="Slide 1 = hook">
        <p className="text-[11px] text-text-dim mb-3">
          Headline jadi konsep utama (Feed 1). Feed lain otomatis menyesuaikan peran
          (lifestyle, fitur, harga, testimoni, CTA, dst) — konsisten satu campaign.
        </p>
        <TextField label="Headline Utama" value={state.headline} onChange={set('headline')} placeholder="Jadikan Si Kecil Bintang Musik!" />
        <div className="mt-3">
          <TextField label="Teks Pendukung / Benefit" value={state.supportingText} onChange={set('supportingText')}
            placeholder="Piano + mic lengkap, latih kreativitas anak sejak dini" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="CTA" value={state.ctaText} onChange={set('ctaText')} placeholder="Order Sekarang" />
          <TextField label="Harga (opsional)" value={state.price} onChange={set('price')} placeholder="139.000" />
        </div>
      </Section>

      <Section num="C" title="Gaya Visual & Campaign" icon={Grid3x3}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Style Visual" value={state.visualStyle} onChange={set('visualStyle')} options={VISUAL_STYLES_GRID}
            hint="Menentukan palette, typography & lighting yang sama di semua feed." />
          <SelectField label="Goal Campaign" value={state.goal} onChange={set('goal')} options={GOALS} />
        </div>
        <p className="text-[11px] text-text-dim mt-2">Format paten: <b className="text-text-mut">9 Feed Konsisten</b> — standar Instagram.</p>

        {/* Warna: default ikut style; klik Custom untuk override palette */}
        <div className="mt-4 rounded-lg border border-border bg-bg-deep/40 p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[10px] mono uppercase tracking-widest text-accent flex items-center gap-1.5">
              <Palette className="w-3 h-3" /> Warna Brand
            </div>
            <button type="button" onClick={() => set('useCustomColor')(!custom)}
              className="text-[10px] uppercase tracking-wider text-text-dim hover:text-accent flex items-center gap-1 transition">
              <Edit3 className="w-3 h-3" /> {custom ? 'Pakai Style' : 'Custom'}
            </button>
          </div>
          {custom ? (
            <ColorSwatch label={null}
              primary={state.colorPrimary || '#ec4899'} secondary={state.colorSecondary || '#ffffff'}
              onPrimary={set('colorPrimary')} onSecondary={set('colorSecondary')} />
          ) : (
            <p className="text-[11px] text-text-dim">Palette otomatis dari "{state.visualStyle}". Klik <b>Custom</b> untuk pilih warna sendiri.</p>
          )}
        </div>
      </Section>
    </div>
  );
}
