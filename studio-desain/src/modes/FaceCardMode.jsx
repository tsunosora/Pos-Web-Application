import { ScanFace, Palette, User, Settings2 } from 'lucide-react';
import Section from '../components/Section.jsx';
import SelectField from '../components/SelectField.jsx';
import TextField from '../components/TextField.jsx';
import SegmentedField from '../components/SegmentedField.jsx';
import CheckboxGroupField from '../components/CheckboxGroupField.jsx';
import ToggleField from '../components/ToggleField.jsx';
import {
  SUB_TYPES, SUBTYPE_DESC, AESTHETIC_DEFAULT_BY_SUBTYPE,
  AESTHETICS, BACKGROUND_TONES, TYPOGRAPHY_STYLES, COLOR_MOODS,
  LIGHTINGS, LAYOUT_DENSITIES, ASPECT_RATIOS, DECORATIVE_ACCENTS,
  GENDER_HINTS, AGE_RANGES, ETHNICITY_HINTS, HIJAB_STYLES, EXPRESSIONS,
  FEATURE_LABELS, ICON_STYLES, CARD_STYLES, BULLET_COUNTS,
  FRAME_STYLES, RECOMMEND_COUNTS, AVOID_COUNTS,
  STYLE_CATEGORIES, HIGHLIGHT_COUNTS,
  UNDERTONES, SEASON_TYPES, BEST_COLOR_COUNTS, AVOID_COLOR_COUNTS, JEWELRY_OPTIONS,
  SKIN_TONES, MAKEUP_UNDERTONES, CONTRAST_LEVELS, EYESHADOW_COUNTS,
  EYELINER_STYLES, MASCARA_STYLES, LIP_COLOR_COUNTS,
} from '../data/faceCardOptions.js';

export default function FaceCardMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });

  // Auto-update style direction defaults when sub-type changes
  const onSubTypeChange = (v) => {
    const def = AESTHETIC_DEFAULT_BY_SUBTYPE[v];
    if (def) {
      dispatch({ type: 'SET_FIELD', field: 'subType',   value: v });
      dispatch({ type: 'SET_FIELD', field: 'aesthetic', value: def.aesthetic });
      dispatch({ type: 'SET_FIELD', field: 'background',value: def.background });
      dispatch({ type: 'SET_FIELD', field: 'typography',value: def.typography });
      dispatch({ type: 'SET_FIELD', field: 'colorMood', value: def.colorMood });
      dispatch({ type: 'SET_FIELD', field: 'lighting',  value: def.lighting });
    } else {
      set('subType')(v);
    }
  };

  const activeSubDesc = SUBTYPE_DESC[state.subType] || '';

  return (
    <div className="space-y-3">
      {/* SECTION A — Sub-type selector */}
      <Section num="A" title="Pilih Tipe Analysis" icon={ScanFace}>
        <SegmentedField
          value={state.subType}
          onChange={onSubTypeChange}
          options={SUB_TYPES}
        />
        {activeSubDesc && (
          <p className="mt-2.5 text-[11px] text-text-mut leading-relaxed">{activeSubDesc}</p>
        )}
      </Section>

      {/* SECTION B — Style Direction (common) */}
      <Section num="B" title="Style Direction" icon={Palette}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Aesthetic"        value={state.aesthetic}        onChange={set('aesthetic')}        options={AESTHETICS} />
          <SelectField label="Background Tone"  value={state.background}       onChange={set('background')}       options={BACKGROUND_TONES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Typography"       value={state.typography}       onChange={set('typography')}       options={TYPOGRAPHY_STYLES} />
          <SelectField label="Color Mood"       value={state.colorMood}        onChange={set('colorMood')}        options={COLOR_MOODS} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Lighting"         value={state.lighting}         onChange={set('lighting')}         options={LIGHTINGS} />
          <SelectField label="Layout Density"   value={state.layoutDensity}    onChange={set('layoutDensity')}    options={LAYOUT_DENSITIES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Aspect Ratio"     value={state.aspectRatio}      onChange={set('aspectRatio')}      options={ASPECT_RATIOS} />
          <SelectField label="Decorative Accent"value={state.decorativeAccent} onChange={set('decorativeAccent')} options={DECORATIVE_ACCENTS} />
        </div>
      </Section>

      {/* SECTION C — Sub-type specific */}
      {state.subType === 'face-feature' && <FaceFeatureFields state={state} set={set} />}
      {state.subType === 'spectacles'   && <SpectaclesFields state={state} set={set} />}
      {state.subType === 'style'        && <StyleAnalysisFields state={state} set={set} />}
      {state.subType === 'color'        && <ColorAnalysisFields state={state} set={set} />}
      {state.subType === 'makeup'       && <MakeupAnalysisFields state={state} set={set} />}

      {/* SECTION D — Optional Subject Hints */}
      <Section num="D" title="Subject Hints (Opsional)" icon={User} badge="opsional">
        <p className="text-[11px] text-text-dim mb-3 leading-relaxed">
          Field di bawah opsional — beri arahan tambahan untuk AI. Kosongkan semua jika ingin AI sepenuhnya menganalisis dari foto yang kamu upload nanti.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectField label="Gender Hint"       value={state.genderHint}    onChange={set('genderHint')}    options={GENDER_HINTS} />
          <SelectField label="Age Range"         value={state.ageRange}      onChange={set('ageRange')}      options={AGE_RANGES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Cultural Context"  value={state.ethnicityHint} onChange={set('ethnicityHint')} options={ETHNICITY_HINTS} />
          <SelectField label="Hijab Style"       value={state.hijabStyle}    onChange={set('hijabStyle')}    options={HIJAB_STYLES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="Expression"        value={state.expression}    onChange={set('expression')}    options={EXPRESSIONS} />
          <TextField   label="Style Vibe (text)" value={state.vibeKeywords}  onChange={set('vibeKeywords')}  placeholder="confident · elegant · soft glam" />
        </div>
      </Section>
    </div>
  );
}

// ───────── Sub-type field components ─────────

function FaceFeatureFields({ state, set }) {
  return (
    <Section num="C" title="Face Features — Pengaturan Detail" icon={Settings2}>
      <CheckboxGroupField
        label="Features yang Dilabel"
        values={state.featuresToLabel}
        onChange={set('featuresToLabel')}
        options={FEATURE_LABELS}
        columns={4}
        hint="Pilih bagian wajah yang ingin diberi label + bullet point analisis."
      />
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        <SelectField label="Icon Style"        value={state.iconStyle}    onChange={set('iconStyle')} options={ICON_STYLES} />
        <SelectField label="Bullet per Feature" value={state.bulletCount} onChange={(v) => set('bulletCount')(+v)} options={BULLET_COUNTS} />
        <SelectField label="Card Style"        value={state.cardStyle}    onChange={set('cardStyle')} options={CARD_STYLES} />
      </div>
      <div className="mt-4">
        <ToggleField label="Tampilkan Panah Penghubung" value={state.showArrows} onChange={set('showArrows')}
          hint="Garis tipis dari setiap info card ke titik fitur di wajah." />
      </div>
    </Section>
  );
}

function SpectaclesFields({ state, set }) {
  return (
    <Section num="C" title="Spectacles — Pengaturan Detail" icon={Settings2}>
      <CheckboxGroupField
        label="Frame Styles yang Ditampilkan"
        values={state.frameStyles}
        onChange={set('frameStyles')}
        options={FRAME_STYLES}
        columns={3}
        max={9}
        hint="Pilih bentuk frame yang ingin di-feature di guide."
      />
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <SelectField label="Jumlah Rekomendasi" value={state.recommendCount} onChange={(v) => set('recommendCount')(+v)} options={RECOMMEND_COUNTS} />
        <SelectField label="Jumlah Avoid"       value={state.avoidCount}     onChange={(v) => set('avoidCount')(+v)}     options={AVOID_COUNTS} />
      </div>
      <div className="space-y-2.5 mt-4">
        <ToggleField label="Tampilkan Color Swatches"   value={state.showColorSwatches} onChange={set('showColorSwatches')} />
        <ToggleField label="Tampilkan Quick Tips"        value={state.showQuickTips}     onChange={set('showQuickTips')} />
        <ToggleField label="Tampilkan Key Features"     value={state.showKeyFeatures}   onChange={set('showKeyFeatures')} />
      </div>
    </Section>
  );
}

function StyleAnalysisFields({ state, set }) {
  return (
    <Section num="C" title="Style Analysis — Pengaturan Detail" icon={Settings2}>
      <CheckboxGroupField
        label="Style Categories (max 8)"
        values={state.styleCategories}
        onChange={set('styleCategories')}
        options={STYLE_CATEGORIES}
        columns={2}
        max={8}
        hint="Pilih kategori style yang akan ditampilkan. Maksimal 8."
      />
      <div className="grid sm:grid-cols-2 gap-3 mt-4">
        <SelectField label="Highlight Best Styles" value={state.highlightCount} onChange={(v) => set('highlightCount')(+v)} options={HIGHLIGHT_COUNTS} />
        <TextField   label="Your Vibe Keywords"    value={state.vibeKeywordsStyle} onChange={set('vibeKeywordsStyle')} placeholder="Confident · Elegant · Feminine" />
      </div>
      <div className="mt-3">
        <TextField label="Overall Identity Statement" value={state.overallIdentity} onChange={set('overallIdentity')} placeholder="Soft Glam + Elegant + Confident Feminine Energy" />
      </div>
      <div className="space-y-2.5 mt-4">
        <ToggleField label="Color Palette Panel"        value={state.includeColorPalette} onChange={set('includeColorPalette')} />
        <ToggleField label="Silhouettes Guide"           value={state.includeSilhouettes}  onChange={set('includeSilhouettes')} />
        <ToggleField label='"You in Your Styles" Grid'   value={state.includeYouInStyles}  onChange={set('includeYouInStyles')} />
        <ToggleField label="Accessories Panel"           value={state.includeAccessories}  onChange={set('includeAccessories')} />
        <ToggleField label="Capsule Wardrobe"            value={state.includeCapsule}      onChange={set('includeCapsule')} />
      </div>
    </Section>
  );
}

function ColorAnalysisFields({ state, set }) {
  return (
    <Section num="C" title="Color Analysis — Pengaturan Detail" icon={Settings2}>
      <div className="grid sm:grid-cols-2 gap-3">
        <SelectField label="Undertone Result" value={state.undertoneResult} onChange={set('undertoneResult')} options={UNDERTONES} />
        <SelectField label="Season Type"      value={state.seasonType}      onChange={set('seasonType')}      options={SEASON_TYPES} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <SelectField label="Best Colors Count"  value={state.bestColorsCount}  onChange={(v) => set('bestColorsCount')(+v)}  options={BEST_COLOR_COUNTS} />
        <SelectField label="Avoid Colors Count" value={state.avoidColorsCount} onChange={(v) => set('avoidColorsCount')(+v)} options={AVOID_COLOR_COUNTS} />
      </div>
      <div className="mt-4">
        <CheckboxGroupField
          label="Jewelry Recommendations"
          values={state.jewelryRecs}
          onChange={set('jewelryRecs')}
          options={JEWELRY_OPTIONS}
          columns={3}
        />
      </div>
      <div className="space-y-2.5 mt-4">
        <ToggleField label="Neutrals Section"            value={state.includeNeutrals}    onChange={set('includeNeutrals')} />
        <ToggleField label="Prints That Flatter"          value={state.includePrints}      onChange={set('includePrints')} />
        <ToggleField label="Makeup Guide"                 value={state.includeMakeupGuide} onChange={set('includeMakeupGuide')} />
        <ToggleField label="Best Hair Colors"             value={state.includeHairColors}  onChange={set('includeHairColors')} />
        <ToggleField label='"You in Your Colors" Grid'    value={state.includeYouInColors} onChange={set('includeYouInColors')} />
        <ToggleField label="Capsule Wardrobe"             value={state.includeCapsule}     onChange={set('includeCapsule')} />
      </div>
    </Section>
  );
}

function MakeupAnalysisFields({ state, set }) {
  return (
    <Section num="C" title="Makeup Analysis — Pengaturan Detail" icon={Settings2}>
      <div className="grid sm:grid-cols-3 gap-3">
        <SelectField label="Skin Tone"        value={state.skinTone}        onChange={set('skinTone')}        options={SKIN_TONES} />
        <SelectField label="Undertone"        value={state.makeupUndertone} onChange={set('makeupUndertone')} options={MAKEUP_UNDERTONES} />
        <SelectField label="Contrast Level"   value={state.contrastLevel}   onChange={set('contrastLevel')}   options={CONTRAST_LEVELS} />
      </div>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        <SelectField label="Eyeshadow Looks"  value={state.eyeshadowCount} onChange={(v) => set('eyeshadowCount')(+v)} options={EYESHADOW_COUNTS} />
        <SelectField label="Lip Colors Count" value={state.lipColorsCount} onChange={(v) => set('lipColorsCount')(+v)} options={LIP_COLOR_COUNTS} />
      </div>
      <div className="mt-4">
        <CheckboxGroupField
          label="Eyeliner Styles"
          values={state.eyelinerStyles}
          onChange={set('eyelinerStyles')}
          options={EYELINER_STYLES}
          columns={3}
        />
      </div>
      <div className="mt-3">
        <CheckboxGroupField
          label="Mascara Styles"
          values={state.mascaraStyles}
          onChange={set('mascaraStyles')}
          options={MASCARA_STYLES}
          columns={3}
        />
      </div>
      <div className="space-y-2.5 mt-4">
        <ToggleField label="Cheek & Contour Guide"        value={state.includeCheekContour} onChange={set('includeCheekContour')} />
        <ToggleField label="Final Looks (Natural/Soft/Evening Glam)" value={state.includeFinalLooks} onChange={set('includeFinalLooks')} />
        <ToggleField label="Recommended Products"          value={state.includeProducts}     onChange={set('includeProducts')} />
        <ToggleField label="Tools of the Trade"            value={state.includeTools}        onChange={set('includeTools')} />
        <ToggleField label="Makeup Tips"                   value={state.includeTips}         onChange={set('includeTips')} />
      </div>
    </Section>
  );
}
