/**
 * Auto Feeds — Email-allowlist authentication.
 *
 * KEAMANAN:
 * 1. PASSWORD tidak lagi disimpan plaintext — hanya SHA-256(salt+password).
 *    Yang terlihat di bundle cuma hash; tidak bisa di-reverse.
 * 2. TOKEN AIRTABLE: obfuscation bundle TIDAK melindungi token dari DevTools →
 *    tab Network (header Authorization terlihat di setiap request). Karena itu:
 *      a. Token WAJIB read-only & scoped HANYA ke tabel allowlist
 *         (worst case bocor = bisa baca daftar email, tidak bisa apa-apa lagi).
 *      b. Disediakan mode PROXY: set VITE_AUTH_ENDPOINT saat build → browser
 *         memanggil endpoint kamu (Cloudflare Worker dsb) dan token TIDAK
 *         pernah dikirim dari browser. Lihat auth-worker/worker.js.
 *    Tanpa VITE_AUTH_ENDPOINT, fallback ke panggilan Airtable langsung
 *    (perilaku lama) supaya tidak ada yang rusak.
 */

import { CONFIG } from '../config.js';

export const SESSION_TTL_MS = 3 * 24 * 60 * 60 * 1000;  // 3 days

/* ───── Password check: salted SHA-256, tanpa plaintext di bundle ───── */
const PWD_SALT = 'af-studio-2026::';
// Hash diambil dari config (reseller bisa set sendiri via hash-tool.html).
// Default config = password lama 'Designitumudah'.
const PWD_HASH = CONFIG.loginPasswordHash;

// SHA-256: pakai WebCrypto kalau ada (HTTPS/localhost); fallback JS murni
// supaya login tetap jalan saat diakses via IP LAN (HTTP, no secure context).
async function sha256Hex(str) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    } catch { /* jatuh ke fallback */ }
  }
  return sha256Fallback(str);
}

// Pure-JS SHA-256 (public-domain style implementation, ringkas)
function sha256Fallback(ascii) {
  const rightRotate = (v, c) => (v >>> c) | (v << (32 - c));
  const mathPow = Math.pow; const maxWord = mathPow(2, 32);
  let result = '';
  const words = []; const asciiBitLength = ascii.length * 8;
  let hash = sha256Fallback.h = sha256Fallback.h || [];
  const k = sha256Fallback.k = sha256Fallback.k || [];
  let primeCounter = k.length;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += '\x80';
  while ((ascii.length % 64) - 56) ascii += '\x00';
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    if (j >> 8) return ''; // hanya ASCII; non-ASCII di-encode dulu oleh caller
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length;) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0, 8);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15], w2 = w[i - 2];
      const a = hash[0], e = hash[4];
      const temp1 = hash[7]
        + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
        + ((e & hash[5]) ^ (~e & hash[6])) + k[i]
        + (w[i] = i < 16 ? w[i] : (w[i - 16]
            + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
            + w[i - 7]
            + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      const temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
        + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// Encode ke ASCII-safe sebelum hash (password bisa mengandung non-ASCII)
function toAscii(str) {
  try { return unescape(encodeURIComponent(str)); } catch { return str; }
}

/* ───── Proxy endpoint (opsional, set saat build) ───── */
// Kalau di-set, token Airtable TIDAK pernah menyentuh browser.
const AUTH_ENDPOINT = import.meta.env?.VITE_AUTH_ENDPOINT || '';

/* ───── Fallback langsung ke Airtable (perilaku lama).
   Kredensial dibaca dari CONFIG.airtable — TIDAK hardcoded di bundle, jadi
   paket reseller (tanpa CONFIG.airtable) sama sekali tidak memuat token. ───── */
const AT = CONFIG.airtable || null;
const _t = AT ? AT.t : '';
const _b = AT ? AT.b : '';

let _cachedHeader = null;
function _reconstruct() {
  if (_cachedHeader) return _cachedHeader;
  if (!AT || !Array.isArray(AT.f) || !AT.k) return null;
  const joined = AT.f.join('');
  // eslint-disable-next-line no-undef
  const bin = atob(joined);
  let rev = '';
  for (let i = bin.length - 1; i >= 0; i--) rev += bin[i];
  const realKey = AT.k.split('').map(c => String.fromCharCode(c.charCodeAt(0) - 1)).join('');
  let out = '';
  for (let i = 0; i < rev.length; i++) {
    out += String.fromCharCode(rev.charCodeAt(i) ^ realKey.charCodeAt(i % realKey.length));
  }
  _cachedHeader = 'Bearer ' + out;
  return _cachedHeader;
}

/* ───── Cache helpers — PER-SUMBER + versi dinaikkan ─────
   v1 dulu dipakai bersama Airtable & Sheet (sumber beda → cache basi →
   "email belum terdaftar"). v3 + key per-sumber memperbaikinya, dan cache
   lama otomatis diabaikan. Hasil KOSONG tidak di-cache (cegah keracunan). */
const CACHE_TTL = 5 * 60 * 1000; // 5 min
function srcKey(src) {
  let h = 2166136261;
  const s = String(src || 'default');
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return 'af_user_list_v3_' + (h >>> 0).toString(36);
}
function readCache(src) {
  try {
    const c = JSON.parse(localStorage.getItem(srcKey(src)) || 'null');
    if (c && c.ts && (Date.now() - c.ts < CACHE_TTL) && Array.isArray(c.emails) && c.emails.length) return c.emails;
  } catch {}
  return null;
}
function writeCache(src, emails) {
  if (!Array.isArray(emails) || !emails.length) return; // jangan cache kosong
  try { localStorage.setItem(srcKey(src), JSON.stringify({ ts: Date.now(), emails })); } catch {}
}

/* ───── User-friendly error strings (no tech terms leaked to UI) ───── */
const ERR = {
  emptyEmail: 'Email tidak boleh kosong',
  emptyPwd:   'Password tidak boleh kosong',
  badFormat:  'Format email tidak valid',
  wrongPwd:   'Password salah',
  notAllowed: 'Email kamu belum terdaftar di sistem',
  network:    'Tidak bisa terhubung. Cek koneksi internet kamu.',
  systemDown: 'Sistem sedang bermasalah. Coba lagi beberapa menit.',
};

/* ───── Cek email via Google Spreadsheet (Published CSV) ─────
   Mode reseller: tanpa API key. URL CSV publik hanya berisi email. */
async function fetchAllowedFromSheet(csvUrl) {
  const cached = readCache(csvUrl);
  if (cached) return { ok: true, emails: cached };
  try {
    const res = await fetch(csvUrl, { redirect: 'follow', cache: 'no-store' });
    if (!res.ok) return { ok: false, err: ERR.systemDown };
    const text = await res.text();
    // Kalau yang balik HTML (sheet belum di-Publish to web dengan benar) → kasih tahu jelas.
    if (/^\s*<(!doctype|html)/i.test(text)) return { ok: false, err: ERR.systemDown };
    const emails = [];
    // Ambil SEMUA pola email di mana pun (tahan koma/titik-koma/tab/kutip/BOM).
    const matches = text.toLowerCase().match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/g) || [];
    matches.forEach((m) => { if (!emails.includes(m)) emails.push(m); });
    if (!emails.length) return { ok: false, err: ERR.systemDown }; // tidak ada email terbaca
    writeCache(csvUrl, emails);
    return { ok: true, emails };
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[auth] sheet', e?.message);
    return { ok: false, err: ERR.network };
  }
}

/* ───── Cek via proxy server (PASSWORD + email diverifikasi SERVER-SIDE) ─────
   Body: { email, password }. Server balas { ok:true } / { ok:false, error }.
   Token Airtable & password TIDAK pernah ada di browser/config. */
async function checkViaProxy(endpoint, email, password) {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) return { ok: false, error: ERR.systemDown };
    const j = await res.json();
    if (j && j.ok) return { ok: true };
    return { ok: false, error: (j && j.error) || ERR.notAllowed };
  } catch {
    return { ok: false, error: ERR.network };
  }
}

/* ───── Fetch allowlist langsung dari Airtable (fallback) ───── */
async function fetchAllowed() {
  const auth = _reconstruct();
  if (!auth || !_b || !_t) return { ok: false, err: ERR.systemDown }; // Airtable tidak dikonfigurasi

  const cached = readCache('airtable');
  if (cached) return { ok: true, emails: cached };

  let all = [];
  let offset = null;
  try {
    do {
      const u = new URL(`https://api.airtable.com/v0/${_b}/${encodeURIComponent(_t)}`);
      u.searchParams.set('pageSize', '100');
      if (offset) u.searchParams.set('offset', offset);
      const res = await fetch(u, { headers: { Authorization: _reconstruct() } });
      if (!res.ok) {
        if (typeof console !== 'undefined') console.warn('[auth] upstream', res.status);
        return { ok: false, err: ERR.systemDown };
      }
      const j = await res.json();
      (j.records || []).forEach(r => {
        const fld = r.fields || {};
        const e = fld.Email || fld.email || fld.EMAIL || fld['Email Address'] || fld['email address'];
        if (typeof e === 'string') {
          const norm = e.toLowerCase().trim();
          if (norm) all.push(norm);
        }
      });
      offset = j.offset;
    } while (offset && all.length < 5000);

    writeCache('airtable', all);
    return { ok: true, emails: all };
  } catch (e) {
    if (typeof console !== 'undefined') console.warn('[auth] network', e?.message);
    return { ok: false, err: ERR.network };
  }
}

/* ───── Anti brute-force ringan (per browser) ───── */
let _failCount = 0;
let _lockUntil = 0;

/* ───── Public API ───── */
export async function validateLogin(rawEmail, rawPassword) {
  const email    = (rawEmail || '').toLowerCase().trim();
  const password = rawPassword || '';

  if (Date.now() < _lockUntil) {
    return { ok: false, error: 'Terlalu banyak percobaan. Tunggu sebentar.' };
  }

  if (!email)    return { ok: false, error: ERR.emptyEmail };
  if (!password) return { ok: false, error: ERR.emptyPwd };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: ERR.badFormat };
  }

  // ── Mode PROXY (paling aman): server verifikasi PASSWORD + email.
  //    Token Airtable & password TIDAK ada di browser/config.js. ──
  const PROXY = CONFIG.authEndpoint || AUTH_ENDPOINT;
  if (PROXY) {
    const p = await checkViaProxy(PROXY, email, password);
    if (!p.ok) {
      _failCount += 1;
      if (_failCount >= 5) { _lockUntil = Date.now() + 30_000; _failCount = 0; }
      return { ok: false, error: p.error };
    }
    _failCount = 0;
    return { ok: true, email };
  }

  const hashed = await sha256Hex(toAscii(PWD_SALT + password));
  if (hashed !== PWD_HASH) {
    _failCount += 1;
    if (_failCount >= 5) {
      _lockUntil = Date.now() + 30_000; // jeda 30 detik tiap 5 kegagalan
      _failCount = 0;
    }
    return { ok: false, error: ERR.wrongPwd };
  }
  _failCount = 0;

  // Belum ada sumber allowlist sama sekali (config belum diisi) → pesan jelas
  // untuk pemilik situs, bukan "sistem bermasalah" yang menyesatkan.
  if (!CONFIG.sheetCsvUrl && !AUTH_ENDPOINT && !AT) {
    return { ok: false, error: 'Login belum dikonfigurasi — isi "sheetCsvUrl" di config.js (lihat PANDUAN-SETUP).' };
  }

  // Password benar → cek allowlist email.
  // Prioritas: Google Sheet (mode reseller) → proxy → Airtable (default lama).
  if (CONFIG.sheetCsvUrl) {
    const s = await fetchAllowedFromSheet(CONFIG.sheetCsvUrl);
    if (!s.ok) return { ok: false, error: s.err };
    if (!s.emails.includes(email)) return { ok: false, error: ERR.notAllowed };
    return { ok: true, email };
  }
  const r = await fetchAllowed();
  if (!r.ok) return { ok: false, error: r.err };
  if (!r.emails.includes(email)) return { ok: false, error: ERR.notAllowed };

  return { ok: true, email };
}

export function clearAuthCache() {
  try {
    // Hapus semua cache allowlist per-sumber (key: af_user_list_v3_*).
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.indexOf('af_user_list_v3_') === 0) localStorage.removeItem(k);
    }
  } catch {}
}
