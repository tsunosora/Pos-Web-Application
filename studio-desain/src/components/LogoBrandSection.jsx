import { Stamp } from 'lucide-react';
import Section from './Section.jsx';
import TextField from './TextField.jsx';
import SelectField from './SelectField.jsx';
import TextareaField from './TextareaField.jsx';
import { LOGO_POSITIONS } from '../data/logoOptions.js';

/**
 * Bagian "Logo & Brand" yang dipakai lintas mode.
 * Prompt hanya menyertakan logo bila `useLogo` aktif (lihat prompts/logoBlock.js).
 *
 * Props:
 *   state — state mode (butuh field: useLogo, logoText, logoPosition, logoNotes)
 *   set   — (field) => (value) => void  (curried dispatcher SET_FIELD, sama spt mode lain)
 *   num   — nomor seksi (opsional)
 */
export default function LogoBrandSection({ state, set, num }) {
  return (
    <Section num={num} title="Logo & Brand" icon={Stamp}>
      <label className="flex items-center gap-2 text-sm font-medium text-text cursor-pointer">
        <input
          type="checkbox"
          checked={!!state.useLogo}
          onChange={(e) => set('useLogo')(e.target.checked)}
          className="accent-accent w-4 h-4"
        />
        Tampilkan logo brand pada desain
      </label>

      <div className={`mt-3 space-y-3 ${state.useLogo ? '' : 'opacity-60'}`}>
        <div className="grid sm:grid-cols-2 gap-3">
          <TextField
            label="Nama / Teks Logo"
            value={state.logoText}
            onChange={set('logoText')}
            placeholder="AuraSkin"
          />
          <SelectField
            label="Posisi Logo"
            value={state.logoPosition}
            onChange={set('logoPosition')}
            options={LOGO_POSITIONS}
          />
        </div>
        <TextareaField
          label="Catatan Konsistensi Brand (Opsional)"
          value={state.logoNotes}
          onChange={set('logoNotes')}
          rows={2}
          placeholder="Warna brand hijau tosca, logo jangan diubah bentuk/warnanya, ukuran ± 12% lebar"
        />
        <p className="text-[11px] text-text-dim leading-relaxed">
          💡 Agar logo <b>persis sama</b> tiap generate, <b>upload gambar logo brand-mu</b> ke AI
          (ChatGPT/Gemini/Nano-Banana) bersama prompt ini. Prompt sudah menyuruh AI memakai logo itu tanpa mengubahnya.
        </p>
      </div>
    </Section>
  );
}
