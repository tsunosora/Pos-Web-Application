/**
 * UGC Affiliate — output STRING siap paste ke ChatGPT.
 * BEDA dari Storyboard: UGC = natural creator script (1-take phone camera),
 * BUKAN production storyboard. Focus pada CONVERSATIONAL FLOW + dialogue voice.
 */

export const INITIAL_UGC_AFFILIATE = {
  product_name: '',
  product_category: 'skincare',
  product_description: '',
  creator_persona: 'Gen Z female casual creator',
  creator_energy: 'calm and honest',
  target_audience: 'wanita 18-30',
  platform: 'TikTok',
  duration: '30_seconds',
  ugc_style: 'raw phone camera review',
  camera_style: 'front camera selfie',
  scene_location: 'bedroom',
  hook: 'Jujur aku kira ini bakal biasa aja.',
  product_demo: 'applying product',
  emotion: 'skeptical then impressed',
  selling_intensity: 'medium / balanced',
  language_style: 'casual Indonesian',
  text_overlay: 'Worth it banget',
  cta: 'Aku taruh linknya di bio',
};

const STRUCTURE_MAP = {
  '15_seconds': '[0-3s] hook → [3-6s] problem → [6-11s] product demo → [11-13s] result → [13-15s] CTA',
  '30_seconds': '[0-3s] hook → [3-8s] personal story → [8-12s] problem → [12-15s] product intro → [15-22s] demo → [22-26s] result → [26-30s] CTA',
  '45_seconds': 'hook → relatable situation → why old solution failed → product discovery → first impression → demo → benefit → proof → who should buy → CTA',
  '60_seconds': 'hook → backstory → pain point → why bought → unboxing → first impression → demo → result → pros → minor cons → recommendation → CTA',
};

export function buildUgcAffiliate(s = {}) {
  const product = s.product_name || '[product]';
  const duration = s.duration || '30_seconds';
  const durationLabel = String(duration).replace('_', ' ');
  const structure = STRUCTURE_MAP[duration] || STRUCTURE_MAP['30_seconds'];

  return `Generate this UGC creator script now. Output directly — do not paraphrase brief, do not ask questions, do not return storyboard or production breakdown.

⚠️ INI BUKAN STORYBOARD — INI SCRIPT CREATOR NATURAL.
Output format = ONE-TAKE conversational dialogue (seperti creator ngomong ke kamera HP), bukan multi-scene production breakdown.

ROLE: Senior UGC Copywriter + Indonesian Casual Creator yang bisa nulis script natural ala TikTok/Reels — terdengar seperti orang biasa cerita, bukan iklan formal.

CREATOR CONTEXT:
- Persona: ${s.creator_persona}
- Energy: ${s.creator_energy}
- Language Style: ${s.language_style}
- Location: ${s.scene_location} (one-take, gak pindah scene)
- Camera: ${s.camera_style}

PRODUCT CONTEXT:
- Produk: ${product} (kategori: ${s.product_category})
- Deskripsi: ${s.product_description || '(infer)'}
- Target Audience: ${s.target_audience}
- Platform: ${s.platform}
- Duration: ${durationLabel}
- UGC Style: ${s.ugc_style}
- Product Demo Action: ${s.product_demo}
- Emotion Arc: ${s.emotion}
- Selling Intensity: ${s.selling_intensity}
- Hook Opening: "${s.hook}"
- Text Overlay Utama: "${s.text_overlay}"
- CTA Closing: "${s.cta}"

NARRATIVE STRUCTURE (ikuti urut):
${structure}

OUTPUT DIRECTLY (masing-masing dalam code block terpisah):

\`\`\`text
📱 UGC SCRIPT — ${product} (${durationLabel}, one-take)

(0:00) "${s.hook}"
(0:03) "..."
(0:08) "..." [aksi: ${s.product_demo}]
(0:XX) "..."
...
(end) "${s.cta}"

NOTE: Tulis seperti dialog continuous — creator ngomong tanpa berhenti, satu take phone camera. Pakai filler natural seperti "jujur", "soalnya", "ternyata", "deh". Hindari kata formal.
\`\`\`

\`\`\`text
🎙️ PURE VOICE OVER (untuk dubbing kalau perlu)

"${s.hook} Soalnya... [lanjutan dialog flow tanpa cue visual]"
\`\`\`

\`\`\`text
📌 TEXT OVERLAY LIST (5 bold short, dengan timing kapan muncul)

[0:00] "..."
[0:08] "..."
...
\`\`\`

\`\`\`text
🪝 HOOK VARIATIONS (5 alternatif untuk A/B test)

1. ${s.hook}
2. ...
3. ...
4. ...
5. ...
\`\`\`

\`\`\`text
📝 CAPTION untuk ${s.platform}

(Casual, natural ala creator HP. Pakai emoji secukupnya. CTA di akhir.)
...
\`\`\`

\`\`\`text
💡 SHOOTING TIP (creator 1-take, no production crew)

- Lighting: ... (pakai window/lampu kamar saja)
- Framing: ... (creator visible jelas, produk ke close-up saat demo)
- Props: ... (apa yang perlu disiapkan)
- Tone reminder: ${s.creator_energy} ala ${s.creator_persona}
\`\`\`

ATURAN KETAT:
- Output WAJIB terasa NATURAL, bukan formal ad
- Pakai filler natural ala creator (jujur, soalnya, ternyata, deh, kan)
- Hindari kata robotik / brand voice
- JANGAN bikin scene breakdown (itu storyboard, bukan UGC)
- JANGAN fake testimonial / overpromise / claim medis
- Creator ngomong dari hati, bukan baca naskah

Mulai output sekarang. Jangan tulis apapun di luar code block.`;
}
