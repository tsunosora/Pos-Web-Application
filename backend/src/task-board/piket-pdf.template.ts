/**
 * Kertas jadwal piket A4 (2 halaman) yang dibuat OTOMATIS dari data Papan Piket:
 * tugas shift, tugas grup, giliran petugas harian & masa uji coba. Fungsi murni
 * (data → HTML) supaya mudah diuji; dirender ke PDF oleh piket-pdf.render.ts.
 * Tampilan mengikuti kertas buatan tangan docs/jadwal-piket-pusat-2026-09.
 */

/** Penanda waktu cetak — diganti saat render supaya hash isi tidak ikut berubah tiap detik. */
export const PDF_STAMP = '__PIKET_PDF_DICETAK__';

export interface PiketPdfTask {
  id: number;
  title: string;
  description: string | null;
  timeOfDay: string | null;
  frequency: string;
  daysOfWeek: string | null;
  slot?: string | null;
  startDate?: Date | string | null;
  groupName?: string | null;
  members?: string[];
}

export interface PiketPdfInput {
  /** Label toko di kepala kertas, mis. "NAMA TOKO · CABANG" — dari Profil Toko (T-34). */
  storeLabel?: string;
  dateKey: string;
  trialUntil: string | null;
  shiftTasks: PiketPdfTask[];
  shiftMembers: string[];
  groupTasks: PiketPdfTask[];
  rotationTasks: PiketPdfTask[];
  rotation: {
    order: string[];
    weeks: {
      start: string;
      days: {
        date: string;
        iso: number;
        name: string | null;
        active: boolean;
      }[];
    }[];
  } | null;
  /** Tanda tangan kaki halaman 2 (diatur owner/manajer di Pengaturan). */
  signatures?: { label: string; name: string | null }[];
  remindBeforeMin: number;
  graceMin: number;
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const ISO_HARI = [
  '',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
  'Minggu',
];
const ISO_PENDEK = ['', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const BULAN = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];
const BULAN_PENDEK = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

const JAM_BUKA = 'Buka Sen–Sab 08.30–20.50';
const SEN_SAB = 'Sen–Sab';
const SETIAP_HARI = 'setiap hari';

// Kewajiban & aturan tetap (bukan jadwal di aplikasi) — sama dengan kertas & Papan Piket.
const MAKAN = {
  item: 'Cuci alat makan sendiri setelah dipakai',
  note: 'Gelas, piring & sendok langsung dicuci dan dikembalikan ke rak.',
  title: 'Cuci alat makan',
  sub: 'SEMUA KARYAWAN · SETIAP SELESAI MAKAN/MINUM',
  steps: [
    'Cuci gelas, piring & sendok yang kamu pakai, langsung setelah dipakai.',
    'Tiriskan lalu kembalikan ke rak.',
    'Jangan tinggalkan alat makan kotor di meja kerja atau wastafel.',
  ],
};
const ATURAN_TETAP = [
  '<b>Area kerja</b> yang ditinggal kotor menjadi tanggung jawab orang yang memakai area itu.',
  '<b>Tukar giliran / izin / sakit:</b> lapor ke Muhammad Faisal sebelum pukul 08.00; ia menunjuk pengganti.',
  '<b>Pemeriksaan:</b> Owner memeriksa kebersihan dan memverifikasi tugas di aplikasi.',
];
const BELANJA = [
  'Lapor ke <strong>Muhammad Faisal</strong> atau <strong>admin</strong> untuk meminta uang belanja.',
  'Belanjakan sesuai kebutuhan dan <strong>wajib meminta nota</strong>.',
  'Serahkan <strong>nota</strong> beserta kembaliannya ke yang memberi uang.',
];

export function esc(s: string | number | null | undefined): string {
  return String(s ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ] as string,
  );
}

/** "BUDI" → "Budi"; nama yang sudah campuran huruf besar/kecil dibiarkan. */
export function displayName(n: string): string {
  if (!/[A-Z]/.test(n) || n !== n.toUpperCase()) return n;
  return n
    .toLowerCase()
    .replace(
      /(^|[\s'.-])([a-z])/g,
      (_m, p: string, c: string) => p + c.toUpperCase(),
    );
}

/** "Buang sampah dapur (pagi)" → { base: "Buang sampah dapur", part: "pagi" }. */
export function splitTitle(title: string): {
  base: string;
  part: string | null;
} {
  const t = title.trim();
  const m = /^(.*?)\s*\(([^()]+)\)$/.exec(t);
  return m && m[1]
    ? { base: m[1], part: m[2].trim() }
    : { base: t, part: null };
}

/** Deskripsi "1. …\n2. …" → daftar langkah tanpa nomor. */
export function steps(desc: string | null | undefined): string[] {
  return (desc || '')
    .split(/\r?\n/)
    .map((l) => l.trim().replace(/^(\d+[.)]|[-•*])\s*/, ''))
    .filter(Boolean);
}

const uniq = <T>(xs: T[]): T[] => [...new Set(xs)];
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const pad = (n: number) => String(n).padStart(2, '0');
const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function keyToDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}
const addDays = (key: string, n: number) => {
  const d = keyToDate(key);
  return toKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
};
const tglPanjang = (key: string) => {
  const d = keyToDate(key);
  return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};
const tglPendek = (key: string) => {
  const d = keyToDate(key);
  return `${d.getDate()} ${BULAN_PENDEK[d.getMonth()]}`;
};
const hariPendek = (key: string) => ISO_PENDEK[keyToDate(key).getDay() || 7];
const jam = (t: string | null | undefined) => (t ? t.replace(':', '.') : '');
function startKey(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : toKey(d);
}

function isoDays(t: PiketPdfTask): number[] {
  if (t.frequency === 'DAILY') return [1, 2, 3, 4, 5, 6, 7];
  if (t.frequency !== 'WEEKLY') return [];
  return uniq(
    (t.daysOfWeek || '')
      .split(',')
      .map(Number)
      .filter((n) => n >= 1 && n <= 7),
  ).sort();
}
function daysText(t: PiketPdfTask): string {
  if (t.frequency === 'MONTHLY') return 'bulanan';
  const d = isoDays(t);
  if (d.length === 7) return SETIAP_HARI;
  if (d.join(',') === '1,2,3,4,5,6') return SEN_SAB;
  return d.map((x) => ISO_HARI[x]).join(', ');
}
/** Tugas mingguan yang hanya beberapa hari (mis. toilet hari Minggu). */
const isLimited = (t: PiketPdfTask) =>
  t.frequency === 'WEEKLY' && isoDays(t).length <= 3;
/** " · Minggu" bila semua tugas di hari yang sama & bukan hari kerja biasa. */
function daysNote(ts: PiketPdfTask[]): string {
  const d = daysText(ts[0]);
  return ts.every((t) => daysText(t) === d) &&
    d !== SEN_SAB &&
    d !== SETIAP_HARI
    ? ` · ${d}`
    : '';
}

interface Merged {
  base: string;
  tasks: PiketPdfTask[];
}
/** Satukan tugas berjudul sama (mis. sampah pagi & sore) — urutan kemunculan dipertahankan. */
function mergeByBase(tasks: PiketPdfTask[]): Merged[] {
  const out: Merged[] = [];
  for (const t of tasks) {
    const base = splitTitle(t.title).base;
    const g = out.find((x) => x.base.toLowerCase() === base.toLowerCase());
    if (g) g.tasks.push(t);
    else out.push({ base, tasks: [t] });
  }
  return out;
}
const dailyFirst = (gs: Merged[]) =>
  [...gs].sort(
    (a, b) => Number(isLimited(a.tasks[0])) - Number(isLimited(b.tasks[0])),
  );
const timesOf = (ts: PiketPdfTask[]) =>
  uniq(ts.map((t) => jam(t.timeOfDay)).filter(Boolean)).join(' & ');
const batas = (ts: PiketPdfTask[]) =>
  timesOf(ts) ? `BATAS ${timesOf(ts)}` : '';
const firstSteps = (ts: PiketPdfTask[]) =>
  steps(ts.find((t) => t.description)?.description);
const names = (xs: string[]) => xs.map(esc).join(' · ');
/** "Piket Pusat — tinggal di toko" → "tinggal di toko". */
function groupLabel(name?: string | null): string | null {
  if (!name) return null;
  const s = (name.split('—').pop() || '').trim().replace(/^yang\s+/i, '');
  return s || null;
}

function boxItem(g: Merged): string {
  const t0 = g.tasks[0];
  const tag = isLimited(t0)
    ? ` <span class="tag">${esc(daysText(t0))}</span>`
    : '';
  const times = timesOf(g.tasks);
  return `<li>${esc(g.base)}${tag}${times ? ` <span class="t">${esc(times)}</span>` : ''}</li>`;
}
function box(
  color: string,
  when: string,
  items: string[],
  note?: string,
): string {
  return (
    `<div class="box" style="--c:var(--${color});--bg:var(--${color}-bg)"><div class="when">${esc(when)}</div>` +
    `<ul>${items.join('')}</ul>${note ? `<p>${esc(note)}</p>` : ''}</div>`
  );
}

function shiftSub(ts: PiketPdfTask[]): string {
  const slots = uniq(ts.map((t) => t.slot ?? ''));
  if (slots.length === 1) {
    return [
      `SHIFT ${slots[0]}`,
      daysNote(ts).replace(/^ · /, '').toUpperCase(),
      batas(ts),
    ]
      .filter(Boolean)
      .join(' · ');
  }
  return ts
    .map((t) =>
      [`SHIFT ${t.slot ?? ''}`, t.timeOfDay ? `BATAS ${jam(t.timeOfDay)}` : '']
        .filter(Boolean)
        .join(' '),
    )
    .join(' · ');
}
function groupSub(who: string, ts: PiketPdfTask[]): string {
  return [who, daysText(ts[0]).toUpperCase(), batas(ts)]
    .filter(Boolean)
    .join(' · ');
}
function rotationSub(ts: PiketPdfTask[]): string {
  const t0 = ts[0];
  const who =
    t0.frequency === 'WEEKLY' && isoDays(t0).length < 7
      ? `PETUGAS HARI ${daysText(t0).toUpperCase()}`
      : 'PETUGAS HARIAN';
  const parts = ts
    .map((t) => {
      const p = splitTitle(t.title).part;
      const j = jam(t.timeOfDay);
      return p
        ? [p.toUpperCase(), j].filter(Boolean).join(' ')
        : j
          ? `BATAS ${j}`
          : '';
    })
    .filter(Boolean);
  return [who, ...uniq(parts)].join(' · ');
}

export function buildPiketPdfHtml(input: PiketPdfInput): string {
  const TOKO = (input.storeLabel || 'TOKO').toUpperCase();
  const trial = input.trialUntil;
  const shiftTasks = input.shiftTasks ?? [];
  const shiftGroups = new Set(
    shiftTasks.map((t) => t.groupName).filter(Boolean),
  );
  const groupTasks = input.groupTasks ?? [];
  // Tugas grup "semua karyawan" (grup yang sama dgn tugas shift) masuk bagian A, sisanya bagian B.
  const aGroup = groupTasks.filter(
    (t) => t.groupName && shiftGroups.has(t.groupName),
  );
  const bGroup = groupTasks.filter((t) => !aGroup.includes(t));
  const rotationTasks = input.rotationTasks ?? [];
  const rot =
    input.rotation && input.rotation.order.length ? input.rotation : null;
  const suffix = groupLabel(bGroup[0]?.groupName);

  const living = uniq(
    [...(rot?.order ?? []), ...bGroup.flatMap((t) => t.members ?? [])].map(
      displayName,
    ),
  );
  const livingSet = new Set(living);
  const shiftNames = uniq((input.shiftMembers ?? []).map(displayName));
  let letter = 0;
  const L = () => 'ABCDEFGH'[letter++];
  const sections: string[] = [];

  // A. Kewajiban semua karyawan
  {
    const pagi = shiftTasks.filter((t) => t.slot === 'PAGI');
    const kedua = shiftTasks.filter((t) => t.slot === 'KEDUA');
    const boxes: string[] = [];
    if (pagi.length)
      boxes.push(
        box(
          'pagi',
          `Yang masuk shift pagi${daysNote(pagi)}`,
          mergeByBase(pagi).map(boxItem),
        ),
      );
    if (kedua.length)
      boxes.push(
        box(
          'sore',
          `Yang masuk shift kedua${daysNote(kedua)}`,
          mergeByBase(kedua).map(boxItem),
        ),
      );
    boxes.push(
      box(
        'makan',
        'Semua, setiap hari',
        [`<li>${esc(MAKAN.item)}</li>`, ...mergeByBase(aGroup).map(boxItem)],
        MAKAN.note,
      ),
    );
    let who = '';
    if (shiftNames.length) {
      const out = shiftNames.filter((n) => !livingSet.has(n));
      const inn = shiftNames.filter((n) => livingSet.has(n));
      who =
        out.length && inn.length
          ? `<b>${names(out)}</b> <span class="sep">(tidak tinggal)</span> <b>· ${names(inn)}</b> <span class="sep">(tinggal) · owner tidak ikut tugas shift</span>`
          : `<b>${names(shiftNames)}</b> <span class="sep">· owner tidak ikut tugas shift</span>`;
    }
    sections.push(
      `<section><h2>${L()}. Kewajiban semua karyawan${living.length ? ' <span>tinggal maupun tidak tinggal di toko</span>' : ''}</h2>` +
        `${who ? `<p class="who">${who}</p>` : ''}` +
        `<div class="duty" style="grid-template-columns:repeat(${boxes.length},1fr)">${boxes.join('')}</div></section>`,
    );
  }

  // B. Tambahan untuk yang tinggal di toko
  if (bGroup.length || rotationTasks.length) {
    const boxes: string[] = [];
    if (bGroup.length) {
      const d = daysText(bGroup[0]);
      const same = bGroup.every((t) => daysText(t) === d);
      boxes.push(
        box(
          'tinggal',
          `Masing-masing${same ? `, ${d}` : ''}`,
          mergeByBase(bGroup).map(boxItem),
        ),
      );
    }
    if (rotationTasks.length) {
      boxes.push(
        box(
          'tinggal',
          rot
            ? 'Petugas harian (bergilir, lihat tabel)'
            : 'Petugas harian (bergilir)',
          dailyFirst(mergeByBase(rotationTasks)).map(boxItem),
        ),
      );
    }
    sections.push(
      `<section><h2>${L()}. Tambahan untuk ${esc(suffix ? `yang ${suffix}` : 'petugas giliran')}</h2>` +
        `${living.length ? `<p class="who"><b>${names(living)}</b></p>` : ''}` +
        `<div class="duty" style="grid-template-columns:${boxes.length === 2 ? '1fr 1.25fr' : '1fr'}">${boxes.join('')}</div></section>`,
    );
  }

  // C. Tabel giliran petugas harian (pekan ini + pekan berikutnya)
  if (rot) {
    const n = rot.order.length;
    const cycle = n / gcd(n, 7); // giliran berputar tiap hari → pola berulang tiap `cycle` pekan
    const cols = Math.max(1, Math.min(cycle, 4, rot.weeks.length));
    const weeks = rot.weeks.slice(0, cols);
    const fullCycle = cols === cycle;
    const extrasFor = (iso: number) =>
      mergeByBase(
        rotationTasks.filter((t) => isLimited(t) && isoDays(t).includes(iso)),
      ).map((g) => g.base.toLowerCase());
    const head = weeks
      .map(
        (w, i) =>
          `<th>Pekan ${i + 1}<small>mulai ${esc(tglPendek(w.start))}</small></th>`,
      )
      .join('');
    const rows = [1, 2, 3, 4, 5, 6, 7]
      .map((iso) => {
        const ex = extrasFor(iso);
        const cells = weeks
          .map((w) => {
            const d = w.days.find((x) => x.iso === iso);
            if (!d || !d.active || !d.name) return '<td class="off">—</td>';
            const i = rot.order.indexOf(d.name);
            return `<td class="n${i < 0 ? 0 : (i % 6) + 1}">${esc(displayName(d.name))}</td>`;
          })
          .join('');
        return `<tr${ex.length ? ' class="sun"' : ''}><th>${ISO_HARI[iso]}${ex.length ? `<small>+ ${esc(ex.join(', '))}</small>` : ''}</th>${cells}</tr>`;
      })
      .join('');
    const cycleBoxes =
      fullCycle && cycle > 1
        ? `<div class="cycle" style="grid-template-columns:repeat(${cols},1fr)">` +
          weeks
            .map((w, i) => {
              const ds = [0, 1, 2, 3].map((j) =>
                esc(tglPendek(addDays(w.start, j * cycle * 7))),
              );
              return `<div><b>Pekan ${i + 1}</b>${ds[0]} · ${ds[1]}<br>${ds[2]} · ${ds[3]}</div>`;
            })
            .join('') +
          '</div>'
        : '';
    const perPerson = (7 * cols) / n;
    const fine = [
      fullCycle
        ? cycle > 1
          ? `Setelah Pekan ${cols} kembali ke Pekan 1 (tanggal di kotak = Senin awal pekan).`
          : 'Giliran sama setiap pekan.'
        : `Tabel menampilkan ${cols} pekan mulai pekan ini.`,
      fullCycle && Number.isInteger(perPerson)
        ? `Dalam ${cols} pekan setiap orang bertugas ${perPerson} hari.`
        : '',
      ...dailyFirst(mergeByBase(rotationTasks))
        .filter((g) => isLimited(g.tasks[0]))
        .map(
          (g) =>
            `Petugas hari ${daysText(g.tasks[0])} juga ${g.base.toLowerCase()}.`,
        ),
    ]
      .filter(Boolean)
      .join(' ');
    sections.push(
      `<section><h2>${L()}. Giliran petugas harian${suffix ? ` <span>yang ${esc(suffix)}</span>` : ''}</h2>` +
        `<table class="rot" style="--w:${(92 / cols).toFixed(1)}%"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>` +
        `${cycleBoxes}<p class="fine">${esc(fine)}</p></section>`,
    );
  }

  const rules: string[] = [];
  if (trial) {
    rules.push(
      `<b>Uji coba s/d ${esc(tglPanjang(trial))}:</b> lihat tugasmu di aplikasi, boleh dicentang atau dilewati — belum ada teguran &amp; belum dihitung. ` +
        `Mulai ${esc(tglPanjang(addDays(trial, 1)))} berlaku penuh.`,
    );
  }
  rules.push(
    shiftTasks.length
      ? '<b>Setiap hari pilih shift</b> (Pagi / Kedua / Libur) di aplikasi, lalu centang <b>Selesai</b> di kartu <b>Piket hari ini</b>.'
      : 'Setelah tugas dikerjakan, centang <b>Selesai</b> di kartu <b>Piket hari ini</b>.',
  );
  rules.push(
    `<b>Pengingat</b> muncul ${input.remindBeforeMin} menit sebelum jam batas; belum dicentang ${input.graceMin} menit setelah jam batas → <b>teguran otomatis</b>.`,
  );
  rules.push(...ATURAN_TETAP);

  const starts = [...shiftTasks, ...groupTasks]
    .map((t) => startKey(t.startDate))
    .filter((x): x is string => !!x)
    .sort()[0];
  const metaTop = starts
    ? `Berlaku mulai ${tglPanjang(starts)}`
    : `Jadwal per ${tglPanjang(input.dateKey)}`;
  const metaSub = [
    trial ? `Uji coba s/d ${hariPendek(trial)} ${tglPendek(trial)}` : '',
    JAM_BUKA,
  ]
    .filter(Boolean)
    .join(' · ');
  const stamp = `<span>Dibuat otomatis dari aplikasi · ${PDF_STAMP}</span>`;

  const page1 =
    `<section class="sheet"><header class="band"><h1>JADWAL PIKET<small>${esc(TOKO)}</small></h1>` +
    `<div class="meta"><b>${esc(metaTop)}</b>${esc(metaSub)}</div></header>` +
    `<div class="body">${sections.join('')}` +
    `<div class="rules"><h3>Aturan piket</h3><ol>${rules.map((r) => `<li>${r}</li>`).join('')}</ol></div></div>` +
    `<footer class="foot"><span>Rincian setiap tugas ada di halaman berikutnya.</span>${stamp}</footer></section>`;

  const cards: {
    title: string;
    sub: string;
    color: string;
    steps: string[];
  }[] = [];
  const slotRank = (g: Merged) => {
    const s = new Set(g.tasks.map((t) => t.slot));
    return s.size === 1 ? (s.has('PAGI') ? 0 : 2) : 1;
  };
  mergeByBase(shiftTasks)
    .map((g, i) => ({ g, i }))
    .sort((a, b) => slotRank(a.g) - slotRank(b.g) || a.i - b.i)
    .forEach(({ g }) =>
      cards.push({
        title: g.base,
        sub: shiftSub(g.tasks),
        color: slotRank(g) === 0 ? 'pagi' : 'sore',
        steps: firstSteps(g.tasks),
      }),
    );
  cards.push({
    title: MAKAN.title,
    sub: MAKAN.sub,
    color: 'makan',
    steps: MAKAN.steps,
  });
  for (const g of mergeByBase(aGroup))
    cards.push({
      title: g.base,
      sub: groupSub('SEMUA KARYAWAN', g.tasks),
      color: 'makan',
      steps: firstSteps(g.tasks),
    });
  for (const g of mergeByBase(bGroup)) {
    cards.push({
      title: g.base,
      sub: groupSub(
        suffix ? `YANG ${suffix.toUpperCase()}` : 'MASING-MASING',
        g.tasks,
      ),
      color: 'tinggal',
      steps: firstSteps(g.tasks),
    });
  }
  for (const g of dailyFirst(mergeByBase(rotationTasks))) {
    cards.push({
      title: g.base,
      sub: rotationSub(g.tasks),
      color: 'tinggal',
      steps: firstSteps(g.tasks),
    });
  }
  const cardsHtml = cards
    .map(
      (c, i) =>
        `<div class="card${cards.length % 2 === 1 && i === cards.length - 1 ? ' wide' : ''}" style="--c:var(--${c.color})">` +
        `<h3>${esc(c.title)}<span>${esc(c.sub)}</span></h3>` +
        `${c.steps.length ? `<ol>${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}</div>`,
    )
    .join('');

  const signSlots = (input.signatures ?? []).filter(
    (x) => x && (x.label || x.name),
  );

  const signHtml =
    '<div class="sign">' +
    (signSlots.length
      ? signSlots
      : [
          { label: 'Dibuat oleh', name: null },

          { label: 'Mengetahui', name: null },
        ]
    )

      .map(
        (x) =>
          `<div>${esc(x.label || 'Tanda tangan')},<i></i><b>${x.name ? esc(x.name) : '…………………………'}</b></div>`,
      )

      .join('') +
    '</div>';

  const page2 =
    `<section class="sheet"><header class="band"><h1>RINCIAN TUGAS PIKET<small>${esc(TOKO)}</small></h1>` +
    `<div class="meta"><b>Centang di aplikasi setelah selesai</b>Kartu Piket hari ini · menu Papan Piket</div></header>` +
    `<div class="body"><div class="cards">${cardsHtml}</div>` +
    `<div class="buy"><h3>Sabun atau alat kebersihan habis / perlu dibeli?</h3><div class="steps">` +
    BELANJA.map((b, i) => `<div><b>${i + 1}</b><span>${b}</span></div>`).join(
      '',
    ) +
    `</div></div>` +
    `${signHtml}</div>` +
    `<footer class="foot"><span>Jadwal mengikuti data di aplikasi — unduh ulang bila ada perubahan.</span>${stamp}</footer></section>`;

  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Jadwal Piket</title><style>${CSS}</style></head><body>${page1}${page2}</body></html>`;
}

const CSS = `
@page{size:A4 portrait;margin:0}
:root{--ink:#161a22;--soft:#5b6475;--line:#d9dee7;--paper:#fff;--band:#1f2a44;
--pagi:#b45309;--pagi-bg:#fdf1e2;--sore:#4338ca;--sore-bg:#ebeafd;--makan:#be123c;--makan-bg:#fde8ee;--tinggal:#0f766e;--tinggal-bg:#e3f5f2}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#fff}
body{font-family:"Segoe UI",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;color:var(--ink);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:210mm;min-height:296mm;background:var(--paper);display:flex;flex-direction:column;break-after:page}
.sheet:last-child{break-after:auto}
.band{background:var(--band);color:#fff;padding:7mm 12mm 6mm;display:flex;justify-content:space-between;align-items:flex-end;gap:6mm}
.band h1{font-size:21pt;font-weight:800;letter-spacing:.02em;line-height:1.1}
.band h1 small{display:block;white-space:nowrap;font-size:9.6pt;font-weight:600;opacity:.85;letter-spacing:.04em;margin-top:1.2mm}
.band .meta{text-align:right;font-size:8.6pt;line-height:1.5;opacity:.92;flex:0 1 auto;min-width:0}
.band .meta b{font-size:10pt;display:block;white-space:nowrap}
.body{padding:4.5mm 12mm 0;flex:1 1 auto;display:flex;flex-direction:column;gap:3.2mm}
h2{font-size:12.5pt;font-weight:800}
h2 span{font-size:9pt;font-weight:600;color:var(--soft);margin-left:1.5mm}
.who{font-size:8.8pt;color:var(--soft);margin-top:.8mm}
.who b{color:var(--ink)}
.who .sep{font-size:7.8pt;color:var(--soft)}
.duty{display:grid;gap:3.5mm;margin-top:2.8mm}
.box{border-radius:2.5mm;padding:2.6mm 3.4mm;background:var(--bg);border-left:1.6mm solid var(--c);break-inside:avoid}
.box .when{font-size:8pt;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--c)}
.box ul{list-style:none;margin-top:1.6mm}
.box li{font-size:10pt;font-weight:700;line-height:1.3;padding:.6mm 0 .6mm 5.2mm;position:relative;display:flex;align-items:baseline;gap:1mm}
.box li::before{content:"";position:absolute;left:0;top:1.5mm;width:3mm;height:3mm;border:.45mm solid var(--c);border-radius:.7mm;background:#fff}
.box li .tag{font-size:7.8pt;font-weight:700;color:#fff;background:var(--c);border-radius:1mm;padding:.2mm 1.4mm;vertical-align:middle;margin-left:1mm}
.box li .t{font-size:7.8pt;font-weight:600;color:var(--soft);margin-left:auto;padding-left:1.5mm;white-space:nowrap}
.box p{font-size:8.6pt;color:var(--soft);margin-top:1.2mm;line-height:1.4}
table.rot{width:100%;border-collapse:separate;border-spacing:1.2mm;margin:1.5mm -1.2mm 0;font-size:10pt;break-inside:avoid}
table.rot th{font-size:8.4pt;font-weight:700;text-transform:uppercase;letter-spacing:.05em;text-align:left;padding:0 2mm .6mm}
table.rot th small{display:block;font-size:7.6pt;font-weight:600;text-transform:none;letter-spacing:0;color:var(--soft)}
table.rot tbody th{font-size:9.6pt;text-transform:none;letter-spacing:0;font-weight:800;width:25mm;vertical-align:middle}
table.rot td{padding:1.25mm 2.2mm;border-radius:1.6mm;font-weight:700;font-size:9.4pt;white-space:nowrap;width:var(--w)}
table.rot tr.sun th small{display:block;font-size:7.2pt;line-height:1.15;color:var(--tinggal);font-weight:800}
table.rot tr.sun td{box-shadow:inset 0 0 0 .45mm currentColor}
.n0,.off{background:#f1f3f6;color:var(--soft)}
.n1{background:#e8f0fe;color:#2563eb}.n2{background:#fdf1e2;color:#b45309}.n3{background:#e3f5f2;color:#0f766e}
.n4{background:#f3e8fd;color:#7e22ce}.n5{background:#fde8ee;color:#be123c}.n6{background:#e6f4ea;color:#15803d}
.cycle{display:grid;gap:2.4mm;margin-top:1.8mm}
.cycle div{border:.3mm solid var(--line);border-radius:1.8mm;padding:1.3mm 2.4mm;font-size:8.4pt;line-height:1.45}
.cycle b{display:block;font-size:8.6pt}
.fine{font-size:8.2pt;color:var(--soft);margin-top:1.5mm;line-height:1.35}
.cards{display:grid;grid-template-columns:1fr 1fr;gap:3mm}
.card{border:.35mm solid var(--line);border-radius:2.5mm;padding:2.8mm 3.4mm;border-top:1.6mm solid var(--c);break-inside:avoid}
.card.wide{grid-column:1 / -1}
.card h3{font-size:10.5pt;font-weight:800;color:var(--c)}
.card h3 span{display:block;font-size:7.8pt;font-weight:700;color:var(--soft);letter-spacing:.02em;margin-top:.3mm}
.card ol{margin:1.3mm 0 0 4.6mm;font-size:8.8pt;line-height:1.36}
.card li{padding-left:.8mm}
.rules{border:.35mm solid var(--line);border-radius:2.5mm;padding:2mm 4mm;background:#f7f8fb;break-inside:avoid}
.rules h3{font-size:10.5pt;font-weight:800}
.rules ol{margin:1mm 0 0 4.6mm;font-size:8.3pt;line-height:1.32}
.buy{border:.5mm solid var(--makan);border-radius:2.5mm;padding:2.6mm 4mm 3mm;background:var(--makan-bg);break-inside:avoid}
.buy h3{font-size:10.5pt;font-weight:800;color:var(--makan)}
.buy .steps{display:grid;grid-template-columns:repeat(3,1fr);gap:3mm;margin-top:2mm}
.buy .steps div{display:flex;gap:2mm;align-items:flex-start;font-size:8.8pt;line-height:1.38}
.buy .steps b{flex:0 0 5.4mm;height:5.4mm;border-radius:50%;background:var(--makan);color:#fff;font-size:8.6pt;display:flex;align-items:center;justify-content:center}
.sign{display:flex;gap:10mm;break-inside:avoid}
.sign div{text-align:center;font-size:8.5pt;min-width:48mm}
.sign div i{display:block;height:9mm}
.foot{padding:2.5mm 12mm 4mm;font-size:8pt;color:var(--soft);display:flex;justify-content:space-between;gap:6mm;border-top:.3mm solid var(--line);margin-top:4mm}
`;
