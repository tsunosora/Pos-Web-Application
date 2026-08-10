import { Package, Camera, Palette } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import TextareaField from '../components/TextareaField.jsx';
import SelectField from '../components/SelectField.jsx';
import ColorSwatch from '../components/ColorSwatch.jsx';
import {
  KATEGORI_PRODUK, GAYA_FOTO, BACKGROUND, SUDUT_KAMERA,
  PENCAHAYAAN, PROPS, RASIO, MOOD, PLATFORM,
} from '../data/fotoProdukOptions.js';

export default function FotoProdukMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });

  return (
    <div className="space-y-3">
      <Section num="A" title="Produk" icon={Package}>
        <div className="space-y-3">
          <TextField
            label="Nama Produk" value={state.productName} onChange={set('productName')} required
            placeholder="Serum Vitamin C 20ml"
          />
          <div className="grid sm:grid-cols-2 gap-3">
            <TextField
              label="Brand (Opsional)" value={state.brand} onChange={set('brand')}
              placeholder="AuraSkin"
            />
            <SelectField
              label="Kategori Produk" value={state.kategori} onChange={set('kategori')}
              options={KATEGORI_PRODUK}
            />
          </div>
          <TextareaField
            label="Deskripsi Singkat (Opsional)" value={state.description} onChange={set('description')}
            rows={2}
            placeholder="Botol kaca amber dengan pipet, tekstur serum bening kekuningan"
          />
        </div>
      </Section>

      <Section num="B" title="Setup Foto" icon={Camera}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Gaya Foto" value={state.gaya} onChange={set('gaya')} options={GAYA_FOTO} />
          <SelectField label="Background" value={state.background} onChange={set('background')} options={BACKGROUND} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Sudut Kamera" value={state.sudut} onChange={set('sudut')} options={SUDUT_KAMERA} />
          <SelectField label="Pencahayaan" value={state.pencahayaan} onChange={set('pencahayaan')} options={PENCAHAYAAN} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Props / Styling" value={state.props} onChange={set('props')} options={PROPS} />
          <SelectField label="Rasio" value={state.rasio} onChange={set('rasio')} options={RASIO} />
        </div>
      </Section>

      <Section num="C" title="Mood & Warna" icon={Palette}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Mood / Estetika" value={state.mood} onChange={set('mood')} options={MOOD} />
          <SelectField
            label="Tujuan Display" value={state.platform} onChange={set('platform')} options={PLATFORM}
            hint="Pengaruhi framing & ruang kosong"
          />
        </div>
        <div className="mt-3">
          <ColorSwatch
            label="Warna Aksen / Grading"
            primary={state.primaryColor}
            secondary={state.secondaryColor}
            onPrimary={set('primaryColor')}
            onSecondary={set('secondaryColor')}
          />
        </div>
        <label className="flex items-center gap-2 mt-3 text-xs font-medium text-text cursor-pointer">
          <input
            type="checkbox"
            checked={!!state.copySpace}
            onChange={(e) => set('copySpace')(e.target.checked)}
            className="accent-accent w-4 h-4"
          />
          Sisakan ruang kosong untuk teks/copy (negative space)
        </label>
      </Section>
    </div>
  );
}
