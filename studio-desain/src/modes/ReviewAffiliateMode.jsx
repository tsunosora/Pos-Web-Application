import { Star, Sparkles, Layout, Palette, Image, Settings2, Megaphone } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import TextareaField from '../components/TextareaField.jsx';
import SelectField from '../components/SelectField.jsx';
import SelectOrCustom from '../components/SelectOrCustom.jsx';
import ToggleField from '../components/ToggleField.jsx';
import CheckboxGroupField from '../components/CheckboxGroupField.jsx';
import CustomColorPicker from '../components/CustomColorPicker.jsx';
import {
  RVB_CATEGORIES, RVB_TARGET_AUDIENCES, RVB_PRICE_POSITIONING, RVB_MAIN_PLATFORMS,
  RVB_FRAMEWORKS, RVB_HEADLINE_STYLES, RVB_HEADLINE_EXAMPLES, RVB_HEADLINE_PLACEMENTS,
  RVB_SUBHEADLINE_EXAMPLES, RVB_REVIEW_FORMATS, RVB_TRUST_OPTIONS,
  RVB_CTA_STYLES, RVB_CTA_EXAMPLES, RVB_CTA_PLACEMENTS,
  RVB_BANNER_STYLES, RVB_LAYOUT_TYPES, RVB_PRODUCT_POSITIONS, RVB_BACKGROUNDS, RVB_LIGHTING,
  RVB_CHARACTER_TYPES, RVB_CHARACTER_POSES, RVB_CHARACTER_FRAMINGS, RVB_HUMAN_POSITIONS,
  RVB_HEADLINE_FONTS, RVB_COLOR_PALETTES, RVB_BADGES, RVB_IMAGE_RATIOS,
} from '../data/affiliateOptions.js';

export default function ReviewAffiliateMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });
  const paletteOptions = RVB_COLOR_PALETTES.map((p) => ({
    value: p.name,
    label: p.colors.length ? `${p.name} — ${p.colors.join(', ')}` : `${p.name} (ikut warna produk)`,
  }));
  const frameworkOptions = RVB_FRAMEWORKS.map((f) => ({ value: f.value, label: f.label }));
  const activeFw = RVB_FRAMEWORKS.find((f) => f.value === state.review_framework);

  return (
    <div className="space-y-3">
      <Section num="1" title="Produk" icon={Star}>
        <div className="mb-3 text-[11px] text-text-dim p-2 rounded bg-bg-elev/40 border border-border">
          💡 Output = <span className="text-accent">konsep banner review</span>. Produk dijaga sama persis — ikuti video tutorial untuk hasilkan visualnya.
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Product Name" value={state.product_name} onChange={set('product_name')} placeholder="Mini Leather Tote" required />
          <SelectOrCustom label="Product Category" value={state.product_category} onChange={set('product_category')} options={RVB_CATEGORIES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Product Type" value={state.product_type} onChange={set('product_type')} placeholder="premium genuine leather mini tote bag" />
          <SelectOrCustom label="Price Positioning" value={state.price_positioning} onChange={set('price_positioning')} options={RVB_PRICE_POSITIONING} />
        </div>
        <div className="mt-3">
          <TextareaField label="Product Description (opsional)" value={state.product_description} onChange={set('product_description')} placeholder="Tas mini kulit asli untuk daily premium look..." rows={2} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Main Benefit" value={state.main_benefit} onChange={set('main_benefit')} placeholder="tampil premium tanpa harga branded" />
          <TextField label="Unique Selling Point (opsional)" value={state.unique_selling_point} onChange={set('unique_selling_point')} placeholder="kulit asli, jahitan rapi" />
        </div>
        <div className="mt-3">
          <TextareaField label="Secondary Benefits (opsional, 1 baris = 1)" value={state.secondary_benefits} onChange={set('secondary_benefits')} placeholder={'Muat banyak\nGampang dipadu\nRingan dibawa'} rows={2} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Problem Solved (opsional)" value={state.problem_solved} onChange={set('problem_solved')} placeholder="tas branded terlalu mahal" />
          <TextField label="Customer Pain Point (opsional)" value={state.pain_point_customer} onChange={set('pain_point_customer')} placeholder="pengen tampil premium tapi budget terbatas" />
        </div>
        <div className="mt-3">
          <SelectOrCustom label="Target Audience" value={state.target_audience} onChange={set('target_audience')} options={RVB_TARGET_AUDIENCES} />
        </div>
      </Section>

      <Section num="2" title="Platform & Output" icon={Image}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectOrCustom label="Main Platform" value={state.main_platform} onChange={set('main_platform')} options={RVB_MAIN_PLATFORMS} />
          <SelectField label="Image Ratio" value={state.image_ratio} onChange={set('image_ratio')} options={RVB_IMAGE_RATIOS} />
        </div>
      </Section>

      <Section num="3" title="Review Framework" icon={Sparkles}>
        <SelectField label="Pilih 1 Framework Terkuat" value={state.review_framework} onChange={set('review_framework')} options={frameworkOptions} />
        {activeFw && (
          <p className="mt-2 text-[11px] text-text-mut leading-relaxed">
            <span className="text-accent">{activeFw.label}:</span> {activeFw.goal} <span className="text-text-dim">· cocok untuk: {activeFw.best}</span>
          </p>
        )}
      </Section>

      <Section num="4" title="Copywriting" icon={Settings2}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectOrCustom label="Headline Style" value={state.headline_style} onChange={set('headline_style')} options={RVB_HEADLINE_STYLES} />
          <SelectField label="Headline Placement" value={state.headline_placement} onChange={set('headline_placement')} options={RVB_HEADLINE_PLACEMENTS} />
        </div>
        <div className="mt-3">
          <SelectOrCustom label="Headline Text (opsional — kosong = AI buat)" value={state.headline_text} onChange={set('headline_text')} options={RVB_HEADLINE_EXAMPLES} hint="Maks 8 kata." />
        </div>
        <div className="mt-3">
          <SelectOrCustom label="Subheadline (opsional — kosong = AI buat)" value={state.subheadline} onChange={set('subheadline')} options={RVB_SUBHEADLINE_EXAMPLES} hint="1 kalimat, maks 14 kata." />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Review Format" value={state.review_format} onChange={set('review_format')} options={RVB_REVIEW_FORMATS} />
          <SelectField label="Headline Font" value={state.headline_font} onChange={set('headline_font')} options={RVB_HEADLINE_FONTS} />
        </div>
        <div className="mt-3">
          <TextareaField label="Review Points (opsional, 1 baris = 1, maks 3)" value={state.review_points} onChange={set('review_points')} placeholder={'Genuine leather feel\nUkuran mini tapi fungsional\nCocok daily premium look'} rows={3} />
        </div>
      </Section>

      <Section num="5" title="Trust & CTA" icon={Megaphone}>
        <ToggleField label="Tampilkan Trust Element" value={state.trust_enable} onChange={set('trust_enable')} hint="Rating / sold count / verified review di banner." />
        {state.trust_enable && (
          <div className="mt-3">
            <SelectOrCustom label="Trust Text" value={state.trust_text} onChange={set('trust_text')} options={RVB_TRUST_OPTIONS} />
          </div>
        )}
        <div className="mt-4 pt-3 border-t border-border grid sm:grid-cols-2 gap-3">
          <SelectField label="CTA Style" value={state.cta_style} onChange={set('cta_style')} options={RVB_CTA_STYLES} />
          <SelectField label="CTA Placement" value={state.cta_placement} onChange={set('cta_placement')} options={RVB_CTA_PLACEMENTS} />
        </div>
        <div className="mt-3">
          <SelectOrCustom label="CTA Text" value={state.cta_text} onChange={set('cta_text')} options={RVB_CTA_EXAMPLES} />
        </div>
      </Section>

      <Section num="6" title="Visual Direction" icon={Layout}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectOrCustom label="Banner Style" value={state.banner_style} onChange={set('banner_style')} options={RVB_BANNER_STYLES} />
          <SelectField label="Layout Type" value={state.layout_type} onChange={set('layout_type')} options={RVB_LAYOUT_TYPES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectOrCustom label="Product Position" value={state.product_position} onChange={set('product_position')} options={RVB_PRODUCT_POSITIONS} />
          <SelectOrCustom label="Background" value={state.background} onChange={set('background')} options={RVB_BACKGROUNDS} />
        </div>
        <div className="mt-3">
          <SelectOrCustom label="Lighting" value={state.lighting} onChange={set('lighting')} options={RVB_LIGHTING} />
        </div>
        <div className="mt-4 pt-3 border-t border-border">
          <ToggleField label="Pakai Human Element (model/creator)" value={state.human_enable} onChange={set('human_enable')} hint="Off → banner produk saja." />
          {state.human_enable && (
            <>
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                <SelectOrCustom label="Character" value={state.character_type} onChange={set('character_type')} options={RVB_CHARACTER_TYPES} />
                <SelectOrCustom label="Pose" value={state.character_pose} onChange={set('character_pose')} options={RVB_CHARACTER_POSES} />
                <SelectField label="Framing" value={state.character_framing} onChange={set('character_framing')} options={RVB_CHARACTER_FRAMINGS} />
              </div>
              <div className="mt-3">
                <SelectField label="Human Position" value={state.human_position} onChange={set('human_position')} options={RVB_HUMAN_POSITIONS} hint="Posisi model/creator di banner." />
              </div>
            </>
          )}
        </div>
      </Section>

      <Section num="7" title="Design & Warna" icon={Palette}>
        <SelectField label="Preset Color Palette" value={state.color_palette} onChange={set('color_palette')} options={paletteOptions} hint="Pilih preset, atau override pakai custom HEX di bawah." />
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
        <div className="mt-3">
          <CheckboxGroupField
            label="Conversion Badges (maks 2, opsional)"
            values={state.badges}
            onChange={set('badges')}
            options={RVB_BADGES}
            columns={3}
            max={2}
            hint="Label kecil penambah konversi. Sisanya (graphic elements) AI yang atur."
          />
        </div>
      </Section>
    </div>
  );
}
