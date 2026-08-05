import { useState } from 'react';
import { Video, Palette, LayoutGrid } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import SelectField from '../components/SelectField.jsx';
import ColorSwatch from '../components/ColorSwatch.jsx';
import ReferenceModal from '../components/ReferenceModal.jsx';
import {
  THUMB_STYLES, MOODS, STYLES, LIGHTINGS, RATIOS,
} from '../data/thumbnailOptions.js';
import { IMAGE_COUNTS, POSITIONS } from '../data/bannerOptions.js';

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

export default function ThumbnailMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });
  const [refOpen, setRefOpen] = useState(null);

  return (
    <div className="space-y-3">
      <Section num="A" title="Video Core" icon={Video}>
        <div className="space-y-3">
          <TextField label="Judul Video" value={state.title} onChange={set('title')} required
            placeholder="Sunscreen Ringan Tanpa Whitecast" />
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Hook Tambahan (Opsional)" value={state.hook} onChange={set('hook')}
              placeholder="Formulasi Dermatologis Teruji" />
            <TextField label="Channel / Brand (Opsional)" value={state.channel} onChange={set('channel')}
              placeholder="AuraSkin" />
          </div>
          <TextField label="Key Points (Opsional)" value={state.keyPoints} onChange={set('keyPoints')}
            placeholder="Tanpa Paraben · Cruelty Free · Dermatologist Tested" />
        </div>
      </Section>

      <Section num="C" title="Tata Letak & Multi-Image" icon={LayoutGrid}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Target Jumlah Gambar" value={state.imageCount ?? 1}
            onChange={(v) => set('imageCount')(+v)} options={IMAGE_COUNTS} />
          <SelectField label="Posisi Visual / Subject" value={state.position || 'right'}
            onChange={set('position')} options={POSITIONS} />
        </div>
      </Section>

      <Section num="D" title="Style & Visual" icon={Palette}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Thumbnail Style" value={state.style} onChange={set('style')} options={THUMB_STYLES} />
          <SelectField label="Mood / Emotion" value={state.mood} onChange={set('mood')} options={MOODS} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Gaya Desain" value={state.designStyle} onChange={set('designStyle')} options={STYLES}
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
          <SelectField label="Thumbnail Ratio" value={state.ratio} onChange={set('ratio')} options={RATIOS} />
        </div>
      </Section>

      {/* Reference modals */}
      <ReferenceModal
        open={refOpen === 'style'}
        onClose={() => setRefOpen(null)}
        title="Referensi Gaya Desain — YouTube Thumbnail"
        subtitle="Pilih gaya visual yang cocok untuk thumbnail YouTube"
        options={STYLES}
        currentValue={state.designStyle}
        onSelect={set('designStyle')}
        aspect="16/9"
        getImageSrc={(v) => `/landing/reference/thumb-style/${slugify(v)}.jpg`}
      />
      <ReferenceModal
        open={refOpen === 'lighting'}
        onClose={() => setRefOpen(null)}
        title="Referensi Gaya Pencahayaan — YouTube Thumbnail"
        subtitle="Pilih tipe lighting untuk subject thumbnail"
        options={LIGHTINGS}
        currentValue={state.lighting}
        onSelect={set('lighting')}
        aspect="16/9"
        getImageSrc={(v) => `/landing/reference/thumb-lighting/${slugify(v)}.jpg`}
      />
    </div>
  );
}
