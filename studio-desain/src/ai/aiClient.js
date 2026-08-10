/**
 * Klien AI Studio Desain → backend POS (/studio-ai/*).
 *
 * Auth: token POS di localStorage 'token' (di-set oleh halaman /desainer, same-origin).
 * Base URL backend: localStorage 'pos_api' (di-set /desainer) → fallback default dev.
 * API key AI TIDAK pernah di sini — hanya hidup di server.
 */

function apiBase() {
  try {
    const v = localStorage.getItem('pos_api');
    if (v) return v.replace(/\/$/, '');
  } catch { /* ignore */ }
  return 'http://localhost:3001';
}

function token() {
  try { return localStorage.getItem('token') || ''; } catch { return ''; }
}

async function req(path, method, body) {
  const t = token();
  if (!t) throw new Error('Sesi login tidak ditemukan. Buka ulang halaman Studio Desain lewat menu POS.');
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error('Tidak bisa menghubungi server. Cek koneksi.');
  }
  if (res.status === 401) throw new Error('Sesi login kadaluarsa. Muat ulang halaman.');
  if (!res.ok) {
    let msg = `Gagal (${res.status})`;
    try { const j = await res.json(); if (j?.message) msg = Array.isArray(j.message) ? j.message.join(', ') : j.message; } catch { /* ignore */ }
    throw new Error(msg);
  }
  return res.json();
}

const post = (path, body) => req(path, 'POST', body);

/** Status AI (aktif/tidak). Aman dipanggil semua user login. */
export function aiStatus() {
  return req('/studio-ai/status', 'GET');
}

/** Saran ide konten + rekomendasi mode. */
export function aiIdeas(idea, modes) {
  return post('/studio-ai/ideas', { idea, modes });
}

/** Isi otomatis brief satu mode. fields = spesifikasi dari aiFields.js. */
export function aiFill(idea, modeLabel, fields) {
  return post('/studio-ai/fill', { idea, modeLabel, fields });
}
