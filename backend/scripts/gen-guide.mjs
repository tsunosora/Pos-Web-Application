#!/usr/bin/env node
/**
 * gen:guide — ekstrak konten halaman Panduan & Bantuan (frontend /help) menjadi
 * basis pengetahuan `APP_GUIDE` yang dibaca Asisten AI (backend).
 *
 * Jalankan dari folder backend:  npm run gen:guide
 * Sumber : ../frontend/src/app/help/page.tsx  (data-driven: <H2>, Steps{title,desc}, Callout)
 * Output : src/studio-ai/app-guide.ts         (konstanta string, ikut ter-bundle)
 *
 * Regenerasi setiap kali isi halaman /help berubah agar jawaban AI tidak drift.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '..', '..', 'frontend', 'src', 'app', 'help', 'page.tsx');
const OUT = path.resolve(here, '..', 'src', 'studio-ai', 'app-guide.ts');

if (!fs.existsSync(SRC)) {
  console.error(`❌ Sumber tidak ditemukan: ${SRC}`);
  process.exit(1);
}

let t = fs.readFileSync(SRC, 'utf8');
const start = t.indexOf('<H2');
if (start > 0) t = t.slice(start);

const strip = (s) =>
  s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/\{"[^"]*"\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Cocokkan berurutan: H2 | H3 | Callout | {title,desc} string | title string.
const re =
  /<H2[^>]*>([\s\S]*?)<\/H2>|<H3[^>]*>([\s\S]*?)<\/H3>|<Callout[^>]*?title="([^"]*)"[^>]*>([\s\S]*?)<\/Callout>|title:\s*"((?:[^"\\]|\\.)*)"\s*,\s*desc:\s*"((?:[^"\\]|\\.)*)"|title:\s*"((?:[^"\\]|\\.)*)"/g;

let m;
const out = [];
while ((m = re.exec(t))) {
  if (m[1] !== undefined) out.push('\n## ' + strip(m[1]));
  else if (m[2] !== undefined) out.push('\n### ' + strip(m[2]));
  else if (m[3] !== undefined) out.push('- [' + strip(m[3]) + '] ' + strip(m[4]));
  else if (m[5] !== undefined) out.push('- **' + m[5].replace(/\\"/g, '"') + '** — ' + m[6].replace(/\\"/g, '"'));
  else if (m[7] !== undefined) out.push('- **' + m[7].replace(/\\"/g, '"') + '**');
}

const md = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
if (md.length < 500) {
  console.error('❌ Hasil ekstraksi terlalu pendek — struktur /help mungkin berubah. Batal menulis.');
  process.exit(1);
}

const esc = md.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');
const ts =
  `// Basis pengetahuan "cara pakai aplikasi" untuk Asisten AI.\n` +
  `// DIBUAT OTOMATIS oleh: npm run gen:guide  (jangan edit tangan).\n` +
  `// Sumber: frontend/src/app/help/page.tsx — regenerasi bila halaman /help berubah.\n` +
  `export const APP_GUIDE = \`${esc}\`;\n`;

fs.writeFileSync(OUT, ts);
const sections = (md.match(/\n## /g) || []).length + (md.startsWith('## ') ? 1 : 0);
console.log(`✅ app-guide.ts diperbarui — ${md.length} char, ${sections} section.`);
