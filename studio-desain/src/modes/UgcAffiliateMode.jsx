import { useState } from 'react';
import { Video, User, MapPin, Megaphone } from 'lucide-react';
import Section from '../components/Section.jsx';
import TextField from '../components/TextField.jsx';
import TextareaField from '../components/TextareaField.jsx';
import SelectOrCustom from '../components/SelectOrCustom.jsx';
import ReferenceModal from '../components/ReferenceModal.jsx';
import {
  UGC_STYLES, UGC_CREATOR_PERSONAS, UGC_ENERGIES, UGC_HOOKS, UGC_DURATIONS,
  UGC_CAMERA_STYLES, UGC_LOCATIONS, UGC_PRODUCT_DEMOS, UGC_EMOTIONS,
  UGC_TEXT_OVERLAYS, UGC_LANGUAGE_STYLES, CTAS, SELLING_INTENSITIES,
  PLATFORMS, TARGET_AUDIENCES, LOGO_BRAND_CATEGORIES,
} from '../data/affiliateOptions.js';
import { FIELD_REFERENCES } from '../data/affiliateReferences.js';

export default function UgcAffiliateMode({ state, dispatch }) {
  const set = (field) => (value) => dispatch({ type: 'SET_FIELD', field, value });
  const [ref, setRef] = useState(null);
  const openRef = (field, options) => setRef({ field, options });

  return (
    <div className="space-y-3">
      <Section num="1" title="Product Context" icon={Video}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField label="Product Name" value={state.product_name} onChange={set('product_name')} placeholder="Serum Brightening Glow" required />
          <SelectOrCustom label="Product Category" value={state.product_category} onChange={set('product_category')} options={LOGO_BRAND_CATEGORIES} />
        </div>
        <div className="mt-3">
          <TextareaField label="Product Description (opsional)" value={state.product_description} onChange={set('product_description')} placeholder="Serum ringan untuk pencerah & glowing kulit..." rows={2} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectOrCustom label="Target Audience" value={state.target_audience} onChange={set('target_audience')} options={TARGET_AUDIENCES} />
          <SelectOrCustom label="Platform" value={state.platform} onChange={set('platform')} options={PLATFORMS} />
        </div>
      </Section>

      <Section num="2" title="Creator Persona" icon={User}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectOrCustom label="Creator Persona" value={state.creator_persona} onChange={set('creator_persona')} options={UGC_CREATOR_PERSONAS} />
          <SelectOrCustom label="Creator Energy" value={state.creator_energy} onChange={set('creator_energy')} options={UGC_ENERGIES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectOrCustom
            label="UGC Style" value={state.ugc_style} onChange={set('ugc_style')} options={UGC_STYLES}
            showReference onShowReference={() => openRef('ugc_style', UGC_STYLES)}
          />
          <SelectOrCustom label="Language Style" value={state.language_style} onChange={set('language_style')} options={UGC_LANGUAGE_STYLES} />
        </div>
      </Section>

      <Section num="3" title="Scene & Camera" icon={MapPin}>
        <div className="grid sm:grid-cols-2 gap-3">
          <SelectOrCustom label="Duration" value={state.duration} onChange={set('duration')} options={UGC_DURATIONS} hint="15/30/45/60 seconds dengan struktur pre-defined" />
          <SelectOrCustom
            label="Camera Style" value={state.camera_style} onChange={set('camera_style')} options={UGC_CAMERA_STYLES}
            showReference onShowReference={() => openRef('camera_style', UGC_CAMERA_STYLES)}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectOrCustom label="Scene Location" value={state.scene_location} onChange={set('scene_location')} options={UGC_LOCATIONS} />
          <SelectOrCustom
            label="Product Demo" value={state.product_demo} onChange={set('product_demo')} options={UGC_PRODUCT_DEMOS}
            showReference onShowReference={() => openRef('product_demo', UGC_PRODUCT_DEMOS)}
          />
        </div>
      </Section>

      <Section num="4" title="Hook · Emotion · CTA" icon={Megaphone}>
        <SelectOrCustom label="Hook Opening" value={state.hook} onChange={set('hook')} options={UGC_HOOKS} hint="Pilih preset atau custom — sistem tetap sediakan 5 hook alternatif." />
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectOrCustom label="Emotion" value={state.emotion} onChange={set('emotion')} options={UGC_EMOTIONS} />
          <SelectOrCustom label="Selling Intensity" value={state.selling_intensity} onChange={set('selling_intensity')} options={SELLING_INTENSITIES} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectOrCustom label="Text Overlay" value={state.text_overlay} onChange={set('text_overlay')} options={UGC_TEXT_OVERLAYS} />
          <SelectOrCustom label="CTA" value={state.cta} onChange={set('cta')} options={CTAS} />
        </div>
      </Section>

      {ref && FIELD_REFERENCES[ref.field] && (
        <ReferenceModal
          open={!!ref}
          onClose={() => setRef(null)}
          title={FIELD_REFERENCES[ref.field].title}
          subtitle={FIELD_REFERENCES[ref.field].subtitle}
          options={ref.options}
          getImageSrc={FIELD_REFERENCES[ref.field].getImageSrc}
          aspect={FIELD_REFERENCES[ref.field].aspect}
          currentValue={state[ref.field]}
          onSelect={(v) => set(ref.field)(v)}
        />
      )}
    </div>
  );
}
