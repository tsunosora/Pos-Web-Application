// Opsi & state awal untuk bagian "Logo & Brand" (dipakai lintas mode).

export const LOGO_POSITIONS = [
  { value: 'top-left',      label: 'Kiri Atas' },
  { value: 'top-center',    label: 'Tengah Atas' },
  { value: 'top-right',     label: 'Kanan Atas' },
  { value: 'center',        label: 'Tengah' },
  { value: 'bottom-left',   label: 'Kiri Bawah' },
  { value: 'bottom-center', label: 'Tengah Bawah' },
  { value: 'bottom-right',  label: 'Kanan Bawah' },
];

// Frasa Inggris utk prompt (nilai enum → deskripsi posisi).
export const LOGO_POSITION_EN = {
  'top-left':      'top-left corner',
  'top-center':    'top-center',
  'top-right':     'top-right corner',
  'center':        'center',
  'bottom-left':   'bottom-left corner',
  'bottom-center': 'bottom-center',
  'bottom-right':  'bottom-right corner',
};

// Field logo untuk di-merge ke INITIAL_* tiap mode.
export const LOGO_INITIAL = {
  useLogo: false,
  logoText: '',
  logoPosition: 'top-left',
  logoNotes: '',
};

// Field logo untuk skema AI autofill (dipakai aiFields.js).
export const LOGO_AI_FIELDS = [
  { key: 'logoText', type: 'text', hint: 'nama/teks logo brand' },
  { key: 'logoPosition', type: 'enum', options: LOGO_POSITIONS.map((p) => p.value) },
  { key: 'logoNotes', type: 'text', hint: 'catatan konsistensi brand: warna, ukuran, gaya logo' },
];
