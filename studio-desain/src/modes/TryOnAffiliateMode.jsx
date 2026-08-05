import { Shirt, User, Camera, Sun } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import SelectOrCustom from '../components/SelectOrCustom.jsx';
import {
  TRYON_PRODUCT_CATEGORIES, TRYON_MODES, TRYON_CHARACTER_PERSONAS, TRYON_BODY_SHOTS,
  TRYON_POSES, TRYON_BACKGROUNDS, TRYON_CAMERA_ANGLES, TRYON_LIGHTING,
  TRYON_SELLING_ANGLES, TRYON_TEXT_OVERLAYS, TRYON_VISUAL_STYLES, PLATFORMS, TARGET_AUDIENCES,
} from '../data/affiliateOptions.js';

export default function TryOnAffiliateMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });

  return (
    <div className="space-y-3">
      <Section num="1" title="Product Info" icon={Shirt}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Product Name" value={state.product_name} onChange={set('product_name')} placeholder="Crop Tee Linen Premium" required />
          <SelectOrCustom label="Product Category" value={state.product_category} onChange={set('product_category')} options={TRYON_PRODUCT_CATEGORIES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <TextField label="Product Type" value={state.product_type} onChange={set('product_type')} placeholder="oversized fit, soft cotton" />
          <SelectOrCustom label="Target Audience" value={state.target_audience} onChange={set('target_audience')} options={TARGET_AUDIENCES} />
        </div>
        <div className="mt-2 text-[11px] text-text-dim p-2 rounded bg-bg-elev/40 border border-border">
          💡 Siapkan foto produkmu sebagai gambar referensi — ikuti langkah di video tutorial.
        </div>
      </Section>

      <Section num="2" title="Character & Persona" icon={User}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectOrCustom label="Character Persona" value={state.character_persona} onChange={set('character_persona')} options={TRYON_CHARACTER_PERSONAS} />
          <SelectOrCustom label="Try-On Mode" value={state.try_on_mode} onChange={set('try_on_mode')} options={TRYON_MODES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectOrCustom label="Body Shot Framing" value={state.body_shot} onChange={set('body_shot')} options={TRYON_BODY_SHOTS} />
          <SelectOrCustom label="Pose" value={state.pose} onChange={set('pose')} options={TRYON_POSES} />
        </div>
      </Section>

      <Section num="3" title="Visual Setting" icon={Camera}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectOrCustom label="Background" value={state.background} onChange={set('background')} options={TRYON_BACKGROUNDS} />
          <SelectOrCustom label="Camera Angle" value={state.camera_angle} onChange={set('camera_angle')} options={TRYON_CAMERA_ANGLES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectOrCustom label="Lighting" value={state.lighting} onChange={set('lighting')} options={TRYON_LIGHTING} />
          <SelectOrCustom label="Visual Style" value={state.visual_style} onChange={set('visual_style')} options={TRYON_VISUAL_STYLES} />
        </div>
      </Section>

      <Section num="4" title="Selling & Output" icon={Sun}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectOrCustom label="Selling Angle" value={state.selling_angle} onChange={set('selling_angle')} options={TRYON_SELLING_ANGLES} />
          <SelectOrCustom label="Platform" value={state.platform} onChange={set('platform')} options={PLATFORMS} hint="Aspect ratio auto sesuai platform." />
        </div>
        <div className="mt-3">
          <SelectOrCustom label="Text Overlay (opsional)" value={state.text_overlay} onChange={set('text_overlay')} options={TRYON_TEXT_OVERLAYS} />
        </div>
      </Section>
    </div>
  );
}
