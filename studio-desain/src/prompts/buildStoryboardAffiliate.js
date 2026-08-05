/**
 * Storyboard Affiliate v3 — Storyboard Prompt Generator (visual board, landscape 16:9).
 * Form input → PROMPT plain-text siap paste ke ChatGPT. User upload foto produk
 * DI CHATGPT, ChatGPT balas storyboard board JSON (header + banyak scene cepat).
 */

export const INITIAL_STORYBOARD_AFFILIATE = {
  product_name: '',
  product_category: 'fashion',
  product_description: '',
  main_benefit: '',
  problem_solved: '',
  target_audience: 'Gen Z female',
  platform: 'TikTok',
  video_duration_seconds: '15',
  storyboard_type: 'UGC Review',
  hook_style: 'problem hook',
  selling_intensity: 'soft selling',
  visual_style: 'cinematic lifestyle',
  creator_persona: 'daily user',
  language_style: 'Indonesian premium clean',
  cta: 'Cek detail produknya',
};

// durasi (detik) → range jumlah scene
const SCENE_LOGIC = {
  10: '5-6 scenes', 15: '6-8 scenes', 20: '8-10 scenes',
  30: '10-12 scenes', 45: '14-16 scenes', 60: '18-22 scenes',
};
function sceneRange(sec) {
  if (SCENE_LOGIC[sec]) return SCENE_LOGIC[sec];
  // fallback: ~1 scene per 2.5s, min 5
  const n = Math.max(5, Math.round(sec / 2.5));
  return `${n}-${n + 2} scenes`;
}

export function buildStoryboardAffiliate(input = {}) {
  const s = { ...INITIAL_STORYBOARD_AFFILIATE, ...(input || {}) };
  const name = s.product_name || '[product name]';
  const dur = parseInt(String(s.video_duration_seconds).replace(/\D/g, ''), 10) || 15;
  const range = sceneRange(dur);

  return `Generate a complete visual storyboard board based on the product image I uploaded.

ROLE:
You are a Senior Storyboard Director + UGC Creative Strategist + Direct Response Visual Planner.

CRITICAL INSTRUCTION:
Use the uploaded product image as the EXACT visual reference. Keep the product design, logo, packaging, color, material, shape, and identity consistent with the uploaded image in every scene. Do not ask questions — directly output the storyboard.

PRODUCT CONTEXT:
- Product name: ${name}
- Product category: ${s.product_category}
- Product description: ${s.product_description || '(infer from the product image)'}
- Main benefit: ${s.main_benefit || '(infer from category)'}
- Problem solved: ${s.problem_solved || '(infer)'}
- Target audience: ${s.target_audience}
- Platform: ${s.platform}
- Video duration: ${dur} seconds
- Storyboard type: ${s.storyboard_type}
- Hook style: ${s.hook_style}
- Selling intensity: ${s.selling_intensity}
- Visual style: ${s.visual_style}
- Creator persona: ${s.creator_persona}
- Language style: ${s.language_style}
- CTA: ${s.cta}

MAIN TASK:
Create a complete storyboard in the style of a visual PRODUCTION BOARD, not just plain text notes.

LAYOUT RULES:
- The storyboard board must be designed in LANDSCAPE format, 16:9 ratio.
- Place a strong TITLE at the top based on the product context and storyboard type.
- Add a benefit-driven SUBTITLE / hook line under the title.
- Show duration and format (16:9) clearly at the top.
- Divide the storyboard into multiple scene cards.

SCENE DENSITY RULES:
- Scene transitions must be fast and dynamic.
- Each scene should ideally last around 1.5 to 3 seconds maximum.
- Even if the total duration is short, the storyboard must still have MANY scenes.
- Scale the number of scenes with duration.

SCENE COUNT LOGIC:
- 10 seconds = 5-6 scenes
- 15 seconds = 6-8 scenes
- 20 seconds = 8-10 scenes
- 30 seconds = 10-12 scenes
- 45 seconds = 14-16 scenes
- 60 seconds = 18-22 scenes
→ For this ${dur}-second video, produce ${range}.

CONTENT RULES:
- Scene 1 must hook attention immediately using a ${s.hook_style}.
- The product must appear clearly in multiple scenes.
- Flow must feel natural, high-converting, and ${s.platform}-native.
- Voice over & text overlay in: ${s.language_style} (short, mobile-friendly).
- Keep ${s.selling_intensity} energy, ${s.visual_style} look, ${s.creator_persona} persona.
- End with the CTA "${s.cta}".
- Avoid exaggerated or medical/guaranteed claims.

RETURN FORMAT:
Return the result in STRUCTURED JSON ONLY (no extra text outside the JSON).

OUTPUT SCHEMA:
{
  "storyboard_header": {
    "title": "",
    "subtitle": "",
    "duration": "${dur} seconds",
    "format_ratio": "16:9",
    "platform": "${s.platform}",
    "storyboard_type": "${s.storyboard_type}"
  },
  "scene_summary": {
    "total_scenes": "",
    "scene_pacing": "fast / dynamic",
    "visual_style": "${s.visual_style}"
  },
  "storyboard_scenes": [
    {
      "scene_number": 1,
      "timestamp": "00:00 - 00:02",
      "scene_title": "",
      "scene_goal": "",
      "hook_text_overlay": "",
      "voice_over": "",
      "prompt_visual": "",
      "notes": ""
    }
  ],
  "ending_section": {
    "main_cta": "${s.cta}",
    "production_notes": [],
    "extra_visual_notes": []
  }
}`;
}
