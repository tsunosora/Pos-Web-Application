import { Sparkles, Palette, Type, Layout, Shirt } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import TextareaField from '../components/TextareaField.jsx';
import SelectField from '../components/SelectField.jsx';
import SelectOrCustom from '../components/SelectOrCustom.jsx';
import SegmentedField from '../components/SegmentedField.jsx';
import CustomColorPicker from '../components/CustomColorPicker.jsx';
import {
  LOGO_BRAND_CATEGORIES, LOGO_TYPES, LOGO_PERSONALITIES, LOGO_COLOR_PALETTES,
  LOGO_TYPOGRAPHY, LOGO_ICON_CONCEPTS, LOGO_LAYOUTS, LOGO_BACKGROUNDS, LOGO_USAGES,
  TARGET_AUDIENCES, MOCKUP_TYPES, MOCKUP_ITEMS,
} from '../data/affiliateOptions.js';

const OUTPUT_MODES = [
  { value: 'logo',   label: '🎨 Buat Logo' },
  { value: 'mockup', label: '👕 Brand Mockup' },
];

export default function LogoAffiliateMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });
  const paletteOptions = LOGO_COLOR_PALETTES.map((p) => ({ value: p.name, label: `${p.name} — ${p.desc}` }));

  const isMockup = state.output_mode === 'mockup';
  const customHex = [state.primary_color, state.secondary_color, state.accent_color].filter(Boolean);

  return (
    <div className="space-y-3">
      {/* Output mode switch */}
      <Section num="0" title="Mau bikin apa?" icon={Sparkles}>
        <SegmentedField
          value={state.output_mode || 'logo'}
          onChange={set('output_mode')}
          options={OUTPUT_MODES}
          hint={isMockup
            ? 'Mockup: tempel logo yang SUDAH ada ke produk/merch. Siapkan file logomu sesuai langkah di video tutorial.'
            : 'Logo: generate logo baru dari nol.'}
        />
      </Section>

      {/* SHARED — Brand Identity */}
      <Section num="1" title="Brand Identity" icon={Sparkles}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Brand Name" value={state.brand_name} onChange={set('brand_name')} placeholder="GlowUp Beauty" required />
          <SelectOrCustom label="Brand Category" value={state.brand_category} onChange={set('brand_category')} options={LOGO_BRAND_CATEGORIES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Product Type" value={state.product_type} onChange={set('product_type')} placeholder="serum brightening, vitamin C" />
          <SelectOrCustom label="Target Market" value={state.target_market} onChange={set('target_market')} options={TARGET_AUDIENCES} />
        </div>
        <div className="mt-3">
          <TextField label="Tagline (opsional)" value={state.brand_tagline} onChange={set('brand_tagline')} placeholder="Glow Naturally, Shine Daily" />
        </div>
        <div className="mt-3">
          <TextareaField label="Brand Story (opsional)" value={state.brand_story} onChange={set('brand_story')} placeholder="Brand premium skincare lokal yang fokus pada bahan natural untuk Gen Z..." rows={2} />
        </div>
      </Section>

      {/* ───────── MODE: BUAT LOGO ───────── */}
      {!isMockup && (
        <>
          <Section num="2" title="Logo Type & Personality" icon={Layout}>
            <div className="grid sm:grid-cols-2 gap-3">
              <SelectOrCustom label="Logo Type" value={state.logo_type} onChange={set('logo_type')} options={LOGO_TYPES} />
              <SelectOrCustom label="Brand Personality" value={state.brand_personality} onChange={set('brand_personality')} options={LOGO_PERSONALITIES} />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <SelectOrCustom label="Layout" value={state.layout} onChange={set('layout')} options={LOGO_LAYOUTS} />
              <SelectOrCustom label="Background" value={state.background} onChange={set('background')} options={LOGO_BACKGROUNDS} />
            </div>
          </Section>

          <Section num="3" title="Visual Direction" icon={Palette}>
            <SelectField
              label="Preset Color Palette" value={state.color_palette} onChange={set('color_palette')} options={paletteOptions}
              hint="Pilih preset, atau override pakai custom HEX di bawah."
            />
            <div className="mt-3">
              <CustomColorPicker
                primary={state.primary_color || '#000000'}
                secondary={state.secondary_color || '#ffffff'}
                accent={state.accent_color || '#d4af37'}
                onPrimary={set('primary_color')}
                onSecondary={set('secondary_color')}
                onAccent={set('accent_color')}
                label="Custom HEX Palette (override)"
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-3 mt-3">
              <SelectOrCustom label="Typography" value={state.typography} onChange={set('typography')} options={LOGO_TYPOGRAPHY} />
              <SelectOrCustom label="Icon Concept" value={state.icon_concept} onChange={set('icon_concept')} options={LOGO_ICON_CONCEPTS} />
            </div>
          </Section>

          <Section num="4" title="Usage Platform" icon={Type}>
            <SelectOrCustom label="Main Platform Usage" value={state.main_platform_usage} onChange={set('main_platform_usage')} options={LOGO_USAGES} hint="Logo akan di-optimasi untuk platform ini (size, readability, dll)." />
          </Section>
        </>
      )}

      {/* ───────── MODE: BRAND MOCKUP ───────── */}
      {isMockup && (
        <>
          {/* Daftar SEMUA media yang akan dibuat — tanpa pilihan */}
          <Section num="2" title="Media yang akan dibuat" icon={Shirt}>
            <p className="text-[11px] text-text-dim mb-3 leading-relaxed">
              Gak perlu pilih — hasilnya mencakup logo kamu di <span className="text-accent">semua media</span> di bawah sekaligus. Ikuti video tutorial untuk memakainya + file logo kamu.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mb-4 text-[10px]">
              <span className="text-text-dim">Palette &amp; personality dari tab Buat Logo:</span>
              <span className="px-2 py-0.5 rounded bg-bg-deep border border-border text-text-mut">{state.brand_personality}</span>
              <span className={`px-2 py-0.5 rounded bg-bg-deep border border-border ${customHex.length ? 'text-accent' : 'text-text-mut'}`}>
                {customHex.length ? `HEX ${customHex.join(', ')}` : state.color_palette}
              </span>
            </div>
            <div className="space-y-3">
              {MOCKUP_TYPES.map((t) => (
                <div key={t.value}>
                  <div className="text-[11px] font-semibold text-text mb-1.5">{t.label}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {(MOCKUP_ITEMS[t.value] || []).map((i) => (
                      <span key={i.value} className="text-[10px] px-2 py-1 rounded-md bg-bg-deep border border-border text-text-mut">
                        {i.value}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
