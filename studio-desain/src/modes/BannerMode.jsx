import { useState } from 'react';
import { Box, ListChecks, LayoutGrid, Palette } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import TextareaField from '../components/TextareaField.jsx';
import SelectField from '../components/SelectField.jsx';
import FeatureChipsField from '../components/FeatureChipsField.jsx';
import ColorSwatch from '../components/ColorSwatch.jsx';
import ReferenceModal from '../components/ReferenceModal.jsx';
import {
  IMAGE_COUNTS, POSITIONS, STYLES, LIGHTINGS, RATIOS,
} from '../data/bannerOptions.js';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function BannerMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });
  const [refOpen, setRefOpen] = useState(null); // null | 'style' | 'lighting'

  return (
    <div className="space-y-3">
      <Section num="A" title="Informasi Brand & Produk" icon={Box}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Nama Brand"    value={state.brand}    onChange={set('brand')}    required placeholder="AuraSkin" />
          <TextField label="Judul Utama"   value={state.headline} onChange={set('headline')} required placeholder="Sunscreen Ringan Tanpa Whitecast" />
        </div>
        <div className="mt-3">
          <TextField label="Sub Judul / Tagline" value={state.tagline} onChange={set('tagline')} placeholder="Formulasi Dermatologis Teruji" />
        </div>
        <div className="mt-3">
          <TextareaField label="Deskripsi Singkat (Opsional)" value={state.description} onChange={set('description')}
            placeholder="Produk perawatan kulit yang diformulasikan dari bahan aktif premium..." rows={2} />
        </div>
        <div className="mt-3">
          <TextField label="CTA / Call-to-Action (Opsional)" value={state.cta} onChange={set('cta')} placeholder="Beli di Shopee" />
        </div>
      </Section>

      <Section num="B" title="Fitur Unggulan Produk" icon={ListChecks}>
        <FeatureChipsField
          value={state.features}
          onChange={set('features')}
          hint="Pisahkan fitur dengan ENTER atau koma."
        />
      </Section>

      <Section num="C" title="Tata Letak & Multi-Image" icon={LayoutGrid}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Target Jumlah Gambar" value={state.imageCount}
            onChange={(v) => set('imageCount')(+v)} options={IMAGE_COUNTS} />
          <SelectField label="Posisi Visual" value={state.position}
            onChange={set('position')} options={POSITIONS} />
        </div>
      </Section>

      <Section num="D" title="Style & Visual" icon={Palette}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Gaya Desain" value={state.style} onChange={set('style')} options={STYLES}
            showReference onShowReference={() => setRefOpen('style')} />
          <SelectField label="Gaya Pencahayaan" value={state.lighting} onChange={set('lighting')} options={LIGHTINGS}
            showReference onShowReference={() => setRefOpen('lighting')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <ColorSwatch
            label="Tema Warna"
            primary={state.primaryColor}
            secondary={state.secondaryColor}
            onPrimary={set('primaryColor')}
            onSecondary={set('secondaryColor')}
          />
          <SelectField label="Rasio Aspek" value={state.ratio} onChange={set('ratio')} options={RATIOS} />
        </div>
      </Section>

      {/* Reference modals */}
      <ReferenceModal
        open={refOpen === 'style'}
        onClose={() => setRefOpen(null)}
        title="Referensi Gaya Desain — Banner"
        subtitle="Pilih gaya visual yang cocok untuk banner produk"
        options={STYLES}
        currentValue={state.style}
        onSelect={set('style')}
        aspect="1/1"
        getImageSrc={(v) => `/landing/reference/banner-style/${slugify(v)}.jpg`}
      />
      <ReferenceModal
        open={refOpen === 'lighting'}
        onClose={() => setRefOpen(null)}
        title="Referensi Gaya Pencahayaan — Banner"
        subtitle="Pilih tipe lighting untuk render produk"
        options={LIGHTINGS}
        currentValue={state.lighting}
        onSelect={set('lighting')}
        aspect="1/1"
        getImageSrc={(v) => `/landing/reference/banner-lighting/${slugify(v)}.jpg`}
      />
    </div>
  );
}
