/**
 * Builds the Copy Writing performance copy prompt (text, matches reference exactly).
 * @param {object} s — copywriting mode state
 * @returns {string}
 */
export function buildCopywriting(s = {}) {
  return `ROLE: Senior Performance Copywriter, Direct Response Strategist, Meta Ads Creative Specialist, dan TikTok Ads Hook Writer.
OBJECTIVE: Buat copy iklan yang terasa seperti dibuat performance marketer profesional: scroll-stopping, emotional trigger, conversion psychology, readable, testing-ready.

OUTPUT RULES (WAJIB):
1) JANGAN tampilkan JSON / jangan jelaskan proses.
2) WAJIB output dalam CODE BLOCK TERPISAH untuk setiap section agar tombol COPY muncul.
3) Jangan gabungkan semua output jadi satu block panjang.
4) Jangan pakai tabel.
5) Bahasa Indonesia natural. Hindari template AI / buzzword kosong.

CONTEXT:
RINGKASAN PRODUK / PENAWARAN:
${s.summary || ''}

TARGET AUDIENS:
${s.audience || ''}

SUMBER MARKETING ANGLE:
${s.angle || ''}

TUJUAN IKLAN:
${s.objective || ''}

PLATFORM PENEMPATAN:
${s.platform || ''}

STYLE PENULISAN:
${s.style || ''}

SAPAAN KE AUDIENS:
${s.greeting || ''}

DELIVERABLES (TOTAL 10 COPY TERBAIK):
- Awareness: Banner Text (3), Headline Hooks (2), Primary Text Meta Ads (1), CTA Variations (2)
- Consideration: Banner Text (3), Headline Hooks (2), Primary Text Meta Ads (1), CTA Variations (2)
- Conversion: Banner Text (4), Headline Hooks (3), Primary Text Meta Ads (2), CTA Variations (3)

SECTION LIST (WAJIB ADA, MASING-MASING BLOCK SENDIRI):
Awareness — Banner Text
Awareness — Headline Hooks
Awareness — Primary Text Meta Ads
Awareness — CTA Variations
Consideration — Banner Text
Consideration — Headline Hooks
Consideration — Primary Text Meta Ads
Consideration — CTA Variations
Conversion — Banner Text
Conversion — Headline Hooks
Conversion — Primary Text Meta Ads
Conversion — CTA Variations
Scroll Stopper Opening (3)
Short Hook Text (5)
Meta Ad Copy (3 paket: Hook + Primary Text + CTA)

FORMAT OUTPUT (CONTOH, IKUTI POLA INI):
\`\`\`text
Awareness — Banner Text

1. ...
2. ...
3. ...
\`\`\`

Mulai output sekarang. Jangan tulis apa pun di luar code block untuk setiap section.`;
}

export const INITIAL_COPYWRITING = {
  summary: '',
  audience: '',
  angle: '',
  objective: 'Direct Sales / Conversion',
  platform: 'Meta Ads (FB & IG)',
  style: 'Friendly Casual',
  greeting: 'Aku - Kamu (Casual)',
};
