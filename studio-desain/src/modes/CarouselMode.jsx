import { GalleryHorizontalEnd, Box, Layers, PenLine, Palette, Newspaper, Edit3 } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import TextareaField from '../components/TextareaField.jsx';
import SelectField from '../components/SelectField.jsx';
import SelectOrCustom from '../components/SelectOrCustom.jsx';
import ColorSwatch from '../components/ColorSwatch.jsx';
import ColorField from '../components/ColorField.jsx';
import ToggleField from '../components/ToggleField.jsx';
import {
  TEMPLATE_TYPES, SLIDE_PRESETS, VISUAL_STYLES, TONE_OPTIONS,
  PLATFORMS, RATIOS, COLOR_MOODS, COVER_LAYOUTS,
} from '../data/carouselOptions.js';

export default function CarouselMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });
  const isNews = state.templateType === 'news';

  return (
    <div className="space-y-3">
      <Section num="A" title="Tipe Carousel & Jumlah Slide" icon={GalleryHorizontalEnd}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField
            label="Carousel Template Type"
            value={state.templateType}
            onChange={set('templateType')}
            options={TEMPLATE_TYPES}
            hint="Tiap tipe punya alur cerita (story flow) sendiri."
          />
          <SelectField
            label="Total Slides"
            // Normalisasi nilai lama dari history (mis. '10' saat masih boleh >7)
            // supaya dropdown tidak tampil kosong — clamp ke 3–7.
            value={String(Math.max(3, Math.min(7, parseInt(state.totalSlides, 10) || 5)))}
            onChange={set('totalSlides')}
            options={SLIDE_PRESETS}
            hint="Pilih 3–7 slide (maksimal 7)."
          />
        </div>
      </Section>

      {/* TEMPLATE NEWS — cukup isi beritanya saja */}
      {isNews ? (
        <Section num="B" title="Isi Berita" icon={Newspaper} badge="Cukup isi ini">
          <p className="text-[11px] text-text-dim mb-3">
            Tempel teks berita lengkap. Sistem otomatis memecahnya jadi cover headline,
            ringkasan, fakta-fakta, sampai slide sumber/follow — sesuai jumlah slide yang dipilih.
          </p>
          <TextareaField
            label="Berita / Update"
            value={state.newsContent}
            onChange={set('newsContent')}
            rows={9}
            placeholder="Tempel teks berita di sini... (judul, isi, fakta, kutipan, sumber)"
          />
          <div className="mt-3">
            <SelectField
              label="Layout Slide 1 (Cover) — letak gambar & teks"
              value={state.coverLayout}
              onChange={set('coverLayout')}
              options={COVER_LAYOUTS}
              hint="Atur posisi foto & headline di slide pertama. Slide 2+ otomatis diacak sistem. Lihat wireframe di samping."
            />
          </div>

          {/* Warna khusus SLIDE 1 (cover). Slide 2+ tetap random/auto. */}
          <div className="mt-4 rounded-lg border border-border bg-bg-deep/40 p-3">
            <div className="text-[10px] mono uppercase tracking-widest text-accent mb-2 flex items-center gap-1.5">
              <Palette className="w-3 h-3" /> Warna Slide 1 (Cover)
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <ColorField label="Warna Teks" value={state.newsTextColor} onChange={set('newsTextColor')} hint="Warna headline / teks." />
              <ColorField label="Warna Suasana" value={state.newsMoodColor} onChange={set('newsMoodColor')} hint="Mood / atmosfer warna dominan." />
            </div>
            <div className="mt-3">
              <ToggleField
                label="Biarkan AI tentukan background teks"
                value={state.newsTextBgAuto}
                onChange={set('newsTextBgAuto')}
                hint="Aktif = AI bebas pakai background teks atau tidak. Matikan untuk pilih warna sendiri."
              />
            </div>
            {!state.newsTextBgAuto && (
              <div className="mt-3">
                <ColorField label="Warna Background Teks" value={state.newsTextBg} onChange={set('newsTextBg')} hint="Panel/bar di belakang teks." />
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <TextField label="Nama Media / Akun (opsional)" value={state.mediaName} onChange={set('mediaName')} placeholder="@infoterkini" />
            <TextField label="CTA (opsional)" value={state.ctaText} onChange={set('ctaText')} placeholder="Follow untuk update" />
          </div>
          <div className="grid sm:grid-cols-2 gap-3 mt-3">
            <SelectOrCustom label="Visual Style (opsional)" value={state.visualStyle} onChange={set('visualStyle')} options={VISUAL_STYLES} />
            <SelectField label="Aspect Ratio" value={state.aspectRatio} onChange={set('aspectRatio')} options={RATIOS} />
          </div>
        </Section>
      ) : (
      <>
      <Section num="B" title="Informasi Brand & Produk" icon={Box}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Nama Brand"  value={state.brandName}   onChange={set('brandName')}   required placeholder="AuraSkin" />
          <TextField label="Nama Produk / Konten" value={state.productName} onChange={set('productName')} required placeholder="Glow Serum" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Kategori"        value={state.productCategory} onChange={set('productCategory')} placeholder="Skincare" />
          <TextField label="Target Audience" value={state.targetAudience}  onChange={set('targetAudience')}  placeholder="Wanita 20-35, kulit kusam" />
        </div>
        <div className="mt-3">
          <TextareaField label="Deskripsi Singkat Produk" value={state.productDescription} onChange={set('productDescription')}
            placeholder="Serum vitamin C yang mencerahkan kulit kusam dalam 14 hari..." rows={2} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Main Benefit"  value={state.mainBenefit}  onChange={set('mainBenefit')}  placeholder="Kulit cerah merata tanpa iritasi" />
          <TextField label="Problem Solved" value={state.problemSolved} onChange={set('problemSolved')} placeholder="Kulit kusam & tidak merata" />
        </div>
      </Section>

      <Section num="C" title="Slide 1 — Diisi Manual (Hook)" icon={PenLine}
        badge="Slide 2+ otomatis">
        <p className="text-[11px] text-text-dim mb-3">
          Hanya slide 1 yang Anda isi. Slide 2 sampai terakhir akan dibuat otomatis oleh AI image tool
          (mengikuti story flow), saling nyambung jadi satu cerita.
        </p>
        <TextField label="Headline Slide 1" value={state.slide1Headline} onChange={set('slide1Headline')}
          required placeholder="Kulit Kusam? Ini Penyebab Yang Jarang Disadari" />
        <div className="mt-3">
          <TextField label="Subheadline Slide 1 (Opsional)" value={state.slide1Subheadline} onChange={set('slide1Subheadline')}
            placeholder="Geser untuk lihat solusinya →" />
        </div>
        <div className="mt-3">
          <SelectField
            label="Layout Slide 1 (Cover) — letak gambar & teks"
            value={state.coverLayout}
            onChange={set('coverLayout')}
            options={COVER_LAYOUTS}
            hint="Atur posisi gambar & teks di slide pertama. Slide 2+ otomatis diacak sistem. Lihat wireframe di samping."
          />
        </div>
      </Section>

      <Section num="D" title="Gaya Visual, Tone & CTA" icon={Palette}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectOrCustom label="Visual Style"   value={state.visualStyle} onChange={set('visualStyle')} options={VISUAL_STYLES} />
          <ColorMoodField state={state} set={set} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectOrCustom label="Tone Copywriting" value={state.toneCopywriting} onChange={set('toneCopywriting')} options={TONE_OPTIONS} />
          <SelectField    label="Platform"         value={state.platform}        onChange={set('platform')}        options={PLATFORMS} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Aspect Ratio" value={state.aspectRatio} onChange={set('aspectRatio')} options={RATIOS} />
          <TextField   label="CTA Text"     value={state.ctaText}     onChange={set('ctaText')}     required placeholder="Beli Sekarang" />
        </div>
      </Section>
      </>
      )}
    </div>
  );
}

// Color Mood: default dropdown preset; klik "Custom" → langsung muncul color
// picker Tema Warna (primary + secondary) yang meng-override color mood.
function ColorMoodField({ state, set }) {
  const custom = !!state.colorMoodCustom;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-medium text-text">Color Mood</label>
        <button
          type="button"
          onClick={() => set('colorMoodCustom')(!custom)}
          className="text-[10px] uppercase tracking-wider text-text-dim hover:text-accent flex items-center gap-1 transition"
          title="Toggle warna custom"
        >
          <Edit3 className="w-3 h-3" />
          {custom ? 'Pilih Preset' : 'Custom'}
        </button>
      </div>
      {custom ? (
        <ColorSwatch
          label={null}
          primary={state.colorPrimary || '#2dd4bf'}
          secondary={state.colorSecondary || '#ffffff'}
          onPrimary={set('colorPrimary')}
          onSecondary={set('colorSecondary')}
        />
      ) : (
        <select value={state.colorMood || ''} onChange={(e) => set('colorMood')(e.target.value)} className="select">
          {COLOR_MOODS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )}
    </div>
  );
}
