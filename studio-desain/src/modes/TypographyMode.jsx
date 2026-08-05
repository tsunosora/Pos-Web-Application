import { Box, Palette, LayoutGrid } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import SelectField from '../components/SelectField.jsx';
import SelectOrCustom from '../components/SelectOrCustom.jsx';
import ColorSwatch from '../components/ColorSwatch.jsx';
import {
  TYPO_DNA, TYPO_ENERGY, CHARACTERS, TYPO_POSES, LAYOUTS, INTENSITIES, WEIGHTS, BACKGROUNDS, RATIOS,
} from '../data/typographyOptions.js';
import { IMAGE_COUNTS, POSITIONS } from '../data/bannerOptions.js';

export default function TypographyMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });

  return (
    <div className="space-y-3">
      <Section num="A" title="Typography Core" icon={Box}>
        <div className="space-y-3">
          <TextField label="Typography Hook" value={state.hook} onChange={set('hook')} required
            placeholder="VISUAL YANG MENJUAL" counter />
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField label="Subheadline (Opsional)" value={state.subheadline} onChange={set('subheadline')}
              placeholder="Formulasi Dermatologis Teruji" />
            <TextField label="CTA / Small Text (Opsional)" value={state.cta} onChange={set('cta')}
              placeholder="Beli di Shopee" />
          </div>
        </div>
      </Section>

      <Section num="C" title="Tata Letak & Multi-Image" icon={LayoutGrid}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Target Jumlah Gambar / Produk" value={state.imageCount ?? 1}
            onChange={(v) => set('imageCount')(+v)} options={IMAGE_COUNTS} />
          <SelectField label="Posisi Subject / Hero" value={state.position || 'center'}
            onChange={set('position')} options={POSITIONS} />
        </div>
      </Section>

      <Section num="D" title="Style & Visual" icon={Palette}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Typography DNA" tag="DNA" value={state.dna} onChange={set('dna')} options={TYPO_DNA} />
          <SelectField label="Typography Energy" tag="Energy" value={state.energy} onChange={set('energy')} options={TYPO_ENERGY} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Character Style" tag="Character" value={state.character} onChange={set('character')} options={CHARACTERS} />
          <SelectOrCustom label="Character Pose" value={state.pose} onChange={set('pose')} options={TYPO_POSES} hint="Biar karakter gak cuma menunjuk. Pilih atau ketik custom." />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Layout System" tag="Layout" value={state.layout} onChange={set('layout')} options={LAYOUTS} />
          <SelectField label="Visual Intensity" tag="Intensity" value={state.intensity} onChange={set('intensity')} options={INTENSITIES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Typography Weight" tag="Weight" value={state.weight} onChange={set('weight')} options={WEIGHTS} />
          <SelectField label="Background System" tag="BG" value={state.background} onChange={set('background')} options={BACKGROUNDS} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Aspect Ratio" value={state.ratio} onChange={set('ratio')} options={RATIOS} />
        </div>
        <div className="mt-3">
          <ColorSwatch
            label="Tema Warna"
            primary={state.primaryColor}
            secondary={state.secondaryColor}
            onPrimary={set('primaryColor')}
            onSecondary={set('secondaryColor')}
          />
        </div>
      </Section>
    </div>
  );
}
