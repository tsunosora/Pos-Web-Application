import { Printer, Ruler, Type, ListChecks, Phone, Palette } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import TextareaField from '../components/TextareaField.jsx';
import SelectField from '../components/SelectField.jsx';
import FeatureChipsField from '../components/FeatureChipsField.jsx';
import ColorSwatch from '../components/ColorSwatch.jsx';
import {
  PRODUCT_TYPES, SIZES, ORIENTATIONS, MATERIALS, STYLES,
} from '../data/bannerCetakOptions.js';

export default function BannerCetakMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });
  const isCustomSize = state.size === 'Custom (ukuran manual)';

  return (
    <div className="space-y-3">
      <Section num="A" title="Jenis & Ukuran Cetak" icon={Printer}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Jenis Produk Cetak" value={state.productType} onChange={set('productType')} options={PRODUCT_TYPES} />
          <SelectField label="Ukuran" value={state.size} onChange={set('size')} options={SIZES} />
        </div>
        {isCustomSize && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <TextField label="Lebar (cm)" value={state.customWidth} onChange={set('customWidth')} placeholder="400" />
            <TextField label="Tinggi (cm)" value={state.customHeight} onChange={set('customHeight')} placeholder="100" />
          </div>
        )}
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Orientasi" value={state.orientation} onChange={set('orientation')} options={ORIENTATIONS} />
          <SelectField label="Bahan / Material" value={state.material} onChange={set('material')} options={MATERIALS} />
        </div>
      </Section>

      <Section num="B" title="Konten Utama" icon={Type}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Nama Brand / Usaha" value={state.brand} onChange={set('brand')} placeholder="Percetakan Faicando" />
          <TextField label="Judul Utama (Headline)" value={state.headline} onChange={set('headline')} required placeholder="GRAND OPENING" />
        </div>
        <div className="mt-3">
          <TextField label="Sub Judul" value={state.subheadline} onChange={set('subheadline')} placeholder="Diskon 50% Semua Menu" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Penawaran / Promo" value={state.offer} onChange={set('offer')} placeholder="Beli 2 Gratis 1" />
          <TextField label="Harga (Opsional)" value={state.price} onChange={set('price')} placeholder="Rp 25.000" />
        </div>
        <div className="mt-3">
          <TextareaField label="Deskripsi Singkat (Opsional)" value={state.description} onChange={set('description')}
            placeholder="Aneka kopi & camilan, tempat nyaman untuk nongkrong..." rows={2} />
        </div>
      </Section>

      <Section num="C" title="Poin / Fitur Penting" icon={ListChecks}>
        <FeatureChipsField
          value={state.features}
          onChange={set('features')}
          hint="Pisahkan dengan ENTER atau koma. Mis: Free WiFi, Parkir Luas, Buka 24 Jam."
        />
      </Section>

      <Section num="D" title="Kontak & Ajakan (CTA)" icon={Phone}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Telepon / WhatsApp" value={state.phone} onChange={set('phone')} placeholder="0812-3456-7890" />
          <TextField label="CTA / Ajakan" value={state.cta} onChange={set('cta')} placeholder="Kunjungi Sekarang!" />
        </div>
        <div className="mt-3">
          <TextField label="Alamat (Opsional)" value={state.address} onChange={set('address')} placeholder="Jl. Merdeka No. 10, Bandung" />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Sosial Media (Opsional)" value={state.social} onChange={set('social')} placeholder="@faicando" />
          <TextField label="Website (Opsional)" value={state.website} onChange={set('website')} placeholder="app.faicando.com" />
        </div>
      </Section>

      <Section num="E" title="Style & Warna" icon={Palette}>
        <SelectField label="Gaya Desain" value={state.style} onChange={set('style')} options={STYLES} />
        <div className="mt-3">
          <ColorSwatch
            label="Tema Warna"
            primary={state.primaryColor}
            secondary={state.secondaryColor}
            onPrimary={set('primaryColor')}
            onSecondary={set('secondaryColor')}
          />
        </div>
        <p className="mt-3 text-[11px] text-text-dim flex items-center gap-1.5">
          <Ruler className="w-3.5 h-3.5 shrink-0" />
          Output prompt sudah menyertakan spesifikasi siap cetak: 300 DPI, CMYK, bleed 2 cm, dan safe margin.
        </p>
      </Section>
    </div>
  );
}
