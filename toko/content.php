<?php
// ── Dashboard → Konten: edit ISI tiap section website (desain tetap) ────────
// Pengganti editor blok "Tampilan". Setiap section punya form sendiri;
// gambar diunggah lewat save_upload(). Reset = kembali ke teks bawaan.
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/content_store.php';
require_once __DIR__ . '/home_blocks.php'; // parse_items
require_admin();
require_csrf();

/** Bersihkan teks utk format baris "A | B | C" (buang pipe & newline). */
function cln(string $s): string { return trim(str_replace(['|', "\r", "\n"], ' ', $s)); }

$secs = content_sections();
$sec  = $_GET['sec'] ?? 'hero';
if (!isset($secs[$sec])) $sec = 'hero';

$back = function (string $msg) use ($sec) {
    header('Location: content.php?sec=' . urlencode($sec) . '&msg=' . urlencode($msg)); exit;
};

// ── Helper: ambil gambar dari form (hidden current + upload + remove) ──
function cimg(string $name): string {
    $cur = trim((string)($_POST[$name] ?? ''));
    if (!empty($_FILES['f_' . $name]['name'])) {
        $up = save_upload($_FILES['f_' . $name]);
        if ($up) $cur = $up;
    }
    if (($_POST['rm_' . $name] ?? '') === '1') $cur = '';
    return $cur;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? 'save';
    if ($action === 'reset') {
        cfg_set('content_' . $sec, null);
        $back('Section dikembalikan ke isi bawaan.');
    }

    $f  = fn($k, $d = '') => trim((string)($_POST[$k] ?? $d));
    $on = fn($k) => ($_POST[$k] ?? '') === '1';
    $data = ['enabled' => $on('enabled')];

    switch ($sec) {
        case 'hero':
            $data += ['kicker' => $f('kicker'), 'stats' => $f('stats')];
            $slides = [];
            for ($i = 0; $i < 4; $i++) {
                $t = $f("s{$i}_title");
                $img = cimg("s{$i}_image");
                if ($t === '' && $img === '') continue;
                $slides[] = [
                    'image' => $img, 'title' => $t, 'accent' => $f("s{$i}_accent"),
                    'subtitle' => $f("s{$i}_subtitle"),
                    'btn1Text' => $f("s{$i}_btn1Text"), 'btn1Link' => $f("s{$i}_btn1Link"),
                    'btn2Text' => $f("s{$i}_btn2Text"), 'btn2Link' => $f("s{$i}_btn2Link"),
                ];
            }
            $data['slides'] = $slides;
            break;
        case 'ticker':
        case 'statistik':
            $data += ['items' => $f('items')];
            break;
        case 'faq':
            $data += ['kicker' => $f('kicker'), 'title' => $f('title'), 'subtitle' => $f('subtitle'), 'items' => $f('items')];
            break;
        case 'layanan':
            $data += ['kicker' => $f('kicker'), 'title' => $f('title'), 'subtitle' => $f('subtitle')];
            $lines = [];
            for ($i = 0; $i < 8; $i++) {
                $name = cln($f("l{$i}_name"));
                if ($name === '') continue;
                $lines[] = $name . ' | ' . cln($f("l{$i}_desc")) . ' | ' . cln($f("l{$i}_link")) . ' | ' . cimg("l{$i}_image");
            }
            $data['items'] = implode("\n", $lines);
            break;
        case 'tentang':
            $data += ['kicker' => $f('kicker'), 'badgeText' => $f('badgeText'), 'badgeLink' => $f('badgeLink'),
                      'title' => $f('title'), 'text' => $f('text'), 'list' => $f('list')];
            break;
        case 'portofolio':
            $data += ['kicker' => $f('kicker'), 'title' => $f('title'), 'subtitle' => $f('subtitle')];
            $items = [];
            $n = (int)($_POST['pf_count'] ?? 0);
            for ($i = 0; $i < min($n + 4, 40); $i++) {
                $img = cimg("pf{$i}_image");
                if ($img === '') continue;
                $items[] = ['image' => $img, 'title' => $f("pf{$i}_title"), 'caption' => $f("pf{$i}_caption")];
            }
            $data['items'] = $items;
            break;
        case 'produk':
            $ids = array_values(array_filter(array_map('trim', explode(',', $f('ids')))));
            $data += ['kicker' => $f('kicker'), 'title' => $f('title'), 'subtitle' => $f('subtitle'), 'ids' => $ids];
            break;
        case 'video':
            $data += ['kicker' => $f('kicker'), 'title' => $f('title'), 'text' => $f('text'),
                      'image' => cimg('image'), 'youtube' => $f('youtube')];
            break;
        case 'testimoni':
            $data += ['kicker' => $f('kicker'), 'title' => $f('title')];
            $lines = [];
            for ($i = 0; $i < 8; $i++) {
                $quote = cln($f("t{$i}_quote"));
                if ($quote === '') continue;
                $lines[] = $quote . ' | ' . cln($f("t{$i}_name")) . ' | ' . cln($f("t{$i}_role")) . ' | ' . cimg("t{$i}_photo");
            }
            $data['items'] = implode("\n", $lines);
            break;
        case 'klien':
            $data += ['title' => $f('title')];
            $lines = [];
            for ($i = 0; $i < 24; $i++) {
                $name = cln($f("k{$i}_name"));
                $logo = cimg("k{$i}_logo");
                if ($name === '' && $logo === '') continue;
                $lines[] = $name . ($logo !== '' ? ' | ' . $logo : '');
            }
            $data['items'] = implode("\n", $lines);
            break;
        case 'order':
            $data += ['kicker' => $f('kicker'), 'title' => $f('title'), 'subtitle' => $f('subtitle'),
                      'whatsapp' => $f('whatsapp'),
                      // form pakai koma; disimpan per-baris (format yang dibaca sec_order)
                      'branches' => implode("\n", array_filter(array_map('trim', explode(',', $f('branches')))))];
            break;
        case 'artikel':
            $data += ['kicker' => $f('kicker'), 'title' => $f('title'), 'limit' => max(1, (int)$f('limit', '5'))];
            break;
        case 'kontak':
            $data += ['title' => $f('title'), 'email' => $f('email')];
            $locs = [];
            for ($i = 0; $i < 5; $i++) {
                $nm = $f("loc{$i}_name"); $ad = $f("loc{$i}_address");
                if ($nm === '' && $ad === '') continue;
                $locs[] = [
                    'name' => $nm, 'address' => $ad,
                    'phone' => $f("loc{$i}_phone"), 'whatsapp' => $f("loc{$i}_whatsapp"),
                    'hours' => $f("loc{$i}_hours"), 'mapsEmbed' => $f("loc{$i}_maps"),
                ];
            }
            $data['locations'] = $locs;
            // kompat lama: field tunggal diisi dari lokasi pertama
            if ($locs) {
                $data += ['address' => $locs[0]['address'], 'phone' => $locs[0]['phone'],
                          'whatsapp' => $locs[0]['whatsapp'], 'mapsEmbed' => $locs[0]['mapsEmbed']];
            }
            break;
        case 'cta':
            $data += ['title' => $f('title'), 'subtitle' => $f('subtitle'), 'btnText' => $f('btnText'), 'btnLink' => $f('btnLink')];
            break;
        case 'katalog':
            $slides = [];
            for ($i = 0; $i < 5; $i++) {
                $t = $f("s{$i}_title");
                $img = cimg("s{$i}_image");
                if ($t === '' && $img === '') continue;
                $slides[] = [
                    'badge' => $f("s{$i}_badge"), 'title' => $t, 'subtitle' => $f("s{$i}_subtitle"),
                    'image' => $img, 'btnText' => $f("s{$i}_btnText"), 'btnLink' => $f("s{$i}_btnLink"),
                ];
            }
            $data['slides'] = $slides;
            break;
        case 'popup':
            $data += ['title' => $f('title'), 'text' => $f('text'), 'image' => cimg('image'),
                      'link' => $f('link'), 'btnText' => $f('btnText'), 'btnLink' => $f('btnLink'), 'once' => $on('once')];
            break;
        case 'profil':
            $data += ['heroTitle' => $f('heroTitle'), 'heroAccent' => $f('heroAccent'), 'heroSubtitle' => $f('heroSubtitle'),
                      'title' => $f('title'), 'text' => $f('text'), 'image' => cimg('image'),
                      'list' => $f('list'), 'nilai' => $f('nilai')];
            break;
        case 'portofolio_page':
            $data = ['heroTitle' => $f('heroTitle'), 'heroAccent' => $f('heroAccent'), 'heroSubtitle' => $f('heroSubtitle')];
            break;
    }
    save_site_content($sec, $data);
    $back('Tersimpan.');
}

$c = site_content($sec);
$msg = $_GET['msg'] ?? null;

$active = 'appearance';
$page_title = 'Konten — ' . $secs[$sec];
include __DIR__ . '/admin_header.php';

// ── Komponen form kecil ──
function fld(string $name, string $label, string $val, string $ph = ''): void {
    echo '<div><label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">' . h($label) . '</label>';
    echo '<input type="text" name="' . h($name) . '" value="' . h($val) . '" placeholder="' . h($ph) . '" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"></div>';
}
function area(string $name, string $label, string $val, int $rows = 4, string $hint = ''): void {
    echo '<div><label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">' . h($label) . '</label>';
    echo '<textarea name="' . h($name) . '" rows="' . $rows . '" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand">' . h($val) . '</textarea>';
    if ($hint !== '') echo '<p class="text-[11px] text-slate-400 mt-1">' . $hint . '</p>';
    echo '</div>';
}
function imgfld(string $name, string $label, string $cur): void {
    echo '<div><label class="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">' . h($label) . '</label>';
    echo '<input type="hidden" name="' . h($name) . '" value="' . h($cur) . '">';
    echo '<div class="flex items-center gap-3">';
    if ($cur !== '') {
        echo '<img src="' . h($cur) . '" alt="" class="h-14 w-20 object-cover rounded-lg border border-slate-200 bg-slate-50">';
        echo '<label class="inline-flex items-center gap-1.5 text-xs text-rose-500"><input type="checkbox" name="rm_' . h($name) . '" value="1" class="rounded"> hapus</label>';
    }
    echo '<input type="file" name="f_' . h($name) . '" accept="image/*" class="text-xs text-slate-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-xs file:font-semibold hover:file:bg-slate-200">';
    echo '</div></div>';
}
function onoff(bool $val): void {
    echo '<label class="inline-flex items-center gap-2.5 cursor-pointer select-none">';
    echo '<input type="checkbox" name="enabled" value="1" ' . ($val ? 'checked' : '') . ' class="h-4 w-4 rounded text-brand focus:ring-brand/40">';
    echo '<span class="text-sm font-semibold text-slate-700">Tampilkan section ini</span></label>';
}
?>
<div class="max-w-6xl">
    <?php if ($msg): ?>
        <div class="mb-5 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm"><?= h($msg) ?></div>
    <?php endif; ?>

    <div class="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
            <h1 class="text-xl font-extrabold text-slate-900">Konten Website</h1>
            <p class="text-sm text-slate-500 mt-1">Desain & susunan halaman sudah tetap — di sini Anda hanya mengganti <b>isinya</b> (teks, foto, daftar). Kosongkan field untuk memakai teks bawaan.</p>
        </div>
        <a href="index.php" target="_blank" class="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:border-brand hover:text-brand transition shrink-0">Lihat Website ↗</a>
    </div>

    <div class="grid lg:grid-cols-[230px_1fr] gap-5 items-start">
        <!-- Daftar section -->
        <nav class="bg-white rounded-2xl border border-slate-200 p-2 lg:sticky lg:top-20">
            <?php foreach ($secs as $key => $label): $on = $key === $sec; ?>
                <a href="content.php?sec=<?= h($key) ?>" class="block px-3.5 py-2 rounded-xl text-sm <?= $on ? 'bg-brand/10 text-brand font-bold' : 'text-slate-600 hover:bg-slate-50 font-medium' ?>"><?= h($label) ?></a>
            <?php endforeach; ?>
        </nav>

        <!-- Form section -->
        <form method="post" enctype="multipart/form-data" class="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
            <?= csrf_field() ?>
            <div class="flex items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <h2 class="font-extrabold text-slate-900"><?= h($secs[$sec]) ?></h2>
                <?php if (!in_array($sec, ['profil', 'portofolio_page'], true)) onoff(!empty($c['enabled'])); ?>
            </div>

            <?php if ($sec === 'hero'): ?>
                <?php fld('kicker', 'Teks kecil di atas judul (kicker)', $c['kicker'] ?? ''); ?>
                <?php area('stats', 'Statistik bawah hero (maks 3 baris)', $c['stats'] ?? '', 3, 'Format per baris: <code>Angka | Label</code> — contoh: <code>1.600+ | Pesanan Selesai</code>'); ?>
                <?php $slides = array_pad(array_slice($c['slides'] ?? [], 0, 4), 3, []); ?>
                <?php foreach ($slides as $i => $s): if ($i >= 4) break; ?>
                    <fieldset class="rounded-xl border border-slate-200 p-4 space-y-3">
                        <legend class="px-2 text-xs font-bold text-slate-400 uppercase tracking-wide">Slide <?= $i + 1 ?><?= empty($s['title']) ? ' (kosong = tidak dipakai)' : '' ?></legend>
                        <?php fld("s{$i}_title", 'Judul', $s['title'] ?? ''); ?>
                        <div class="grid sm:grid-cols-2 gap-3">
                            <?php fld("s{$i}_accent", 'Kata yang ditonjolkan (italic serif)', $s['accent'] ?? '', 'harus ada di judul'); ?>
                            <?php imgfld("s{$i}_image", 'Foto slide (panel kanan)', $s['image'] ?? ''); ?>
                        </div>
                        <?php area("s{$i}_subtitle", 'Subjudul', $s['subtitle'] ?? '', 2); ?>
                        <div class="grid sm:grid-cols-2 gap-3">
                            <?php fld("s{$i}_btn1Text", 'Tombol 1 — teks', $s['btn1Text'] ?? ''); ?>
                            <?php fld("s{$i}_btn1Link", 'Tombol 1 — link', $s['btn1Link'] ?? '', '#order-cepat / produk.php'); ?>
                            <?php fld("s{$i}_btn2Text", 'Tombol 2 — teks (opsional)', $s['btn2Text'] ?? ''); ?>
                            <?php fld("s{$i}_btn2Link", 'Tombol 2 — link', $s['btn2Link'] ?? ''); ?>
                        </div>
                    </fieldset>
                <?php endforeach; ?>

            <?php elseif ($sec === 'ticker'): ?>
                <?php area('items', 'Daftar teks berjalan', $c['items'] ?? '', 7, 'Satu item per baris (huruf besar otomatis).'); ?>

            <?php elseif ($sec === 'layanan'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('kicker', 'Kicker', $c['kicker'] ?? ''); fld('title', 'Judul', $c['title'] ?? ''); ?></div>
                <?php fld('subtitle', 'Subjudul', $c['subtitle'] ?? ''); ?>
                <p class="text-[11px] text-slate-400 -mb-2">Foto produksi tampil di panel samping daftar (berganti saat baris di-hover). Baris tanpa nama dilewati.</p>
                <?php $litems = parse_items($c['items'] ?? ''); $ltotal = min(8, max(count($litems) + 1, 5)); ?>
                <?php for ($i = 0; $i < $ltotal; $i++): $it = $litems[$i] ?? []; ?>
                    <fieldset class="rounded-xl border border-slate-200 p-4 space-y-3">
                        <legend class="px-2 text-xs font-bold text-slate-400 uppercase tracking-wide">Layanan <?= $i + 1 ?></legend>
                        <div class="grid sm:grid-cols-2 gap-3">
                            <?php fld("l{$i}_name", 'Nama layanan', $it[0] ?? ''); ?>
                            <?php fld("l{$i}_link", 'Link (opsional)', $it[2] ?? '', 'produk.php'); ?>
                        </div>
                        <?php fld("l{$i}_desc", 'Deskripsi singkat', $it[1] ?? ''); ?>
                        <?php imgfld("l{$i}_image", 'Foto produksi', $it[3] ?? ''); ?>
                    </fieldset>
                <?php endfor; ?>

            <?php elseif ($sec === 'tentang'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('kicker', 'Kicker', $c['kicker'] ?? ''); fld('title', 'Judul statement', $c['title'] ?? ''); ?></div>
                <?php area('text', 'Paragraf', $c['text'] ?? '', 4); ?>
                <?php area('list', 'Poin keunggulan (per baris)', $c['list'] ?? '', 4); ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('badgeText', 'Teks badge berputar', $c['badgeText'] ?? ''); fld('badgeLink', 'Link badge', $c['badgeLink'] ?? 'profil.php'); ?></div>

            <?php elseif ($sec === 'portofolio'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('kicker', 'Kicker', $c['kicker'] ?? ''); fld('title', 'Judul', $c['title'] ?? ''); ?></div>
                <?php fld('subtitle', 'Subjudul', $c['subtitle'] ?? ''); ?>
                <?php $items = array_values($c['items'] ?? []); $total = count($items) + 4; ?>
                <input type="hidden" name="pf_count" value="<?= count($items) ?>">
                <p class="text-[11px] text-slate-400 -mb-2">Foto tanpa gambar otomatis dilewati. Beranda menampilkan maks 8 foto pertama; halaman Portofolio menampilkan semuanya.</p>
                <div class="grid sm:grid-cols-2 gap-4">
                    <?php for ($i = 0; $i < $total; $i++): $it = $items[$i] ?? []; ?>
                        <fieldset class="rounded-xl border border-slate-200 p-4 space-y-2.5">
                            <legend class="px-2 text-xs font-bold text-slate-400">Karya <?= $i + 1 ?></legend>
                            <?php imgfld("pf{$i}_image", 'Foto', $it['image'] ?? ''); ?>
                            <?php fld("pf{$i}_title", 'Judul', $it['title'] ?? ''); ?>
                            <?php fld("pf{$i}_caption", 'Keterangan kecil', $it['caption'] ?? ''); ?>
                        </fieldset>
                    <?php endfor; ?>
                </div>

            <?php elseif ($sec === 'statistik'): ?>
                <?php area('items', 'Angka statistik', $c['items'] ?? '', 5, 'Per baris: <code>Angka | Label</code>. Angka bulat dianimasikan otomatis.'); ?>

            <?php elseif ($sec === 'produk'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('kicker', 'Kicker', $c['kicker'] ?? ''); fld('title', 'Judul', $c['title'] ?? ''); ?></div>
                <?php fld('subtitle', 'Subjudul', $c['subtitle'] ?? ''); ?>
                <?php fld('ids', 'ID produk pilihan (pisahkan koma, urutan dipakai)', implode(',', (array)($c['ids'] ?? [])), 'kosong = 5 produk pertama katalog'); ?>
                <details class="text-xs text-slate-500">
                    <summary class="cursor-pointer font-semibold text-slate-600">Lihat daftar ID produk</summary>
                    <div class="mt-2 max-h-56 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-100">
                        <?php foreach (public_products() as $p): ?>
                            <div class="px-3 py-1.5 flex justify-between gap-3"><span class="truncate"><?= h($p['name']) ?></span><code class="text-slate-400 shrink-0"><?= h($p['id']) ?></code></div>
                        <?php endforeach; ?>
                    </div>
                </details>

            <?php elseif ($sec === 'video'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('kicker', 'Kicker', $c['kicker'] ?? ''); fld('title', 'Judul', $c['title'] ?? ''); ?></div>
                <?php fld('text', 'Deskripsi singkat', $c['text'] ?? ''); ?>
                <?php imgfld('image', 'Foto lebar (fasilitas/tim)', $c['image'] ?? ''); ?>
                <?php fld('youtube', 'Link / ID video YouTube (opsional — memunculkan tombol play)', $c['youtube'] ?? ''); ?>

            <?php elseif ($sec === 'testimoni'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('kicker', 'Kicker', $c['kicker'] ?? ''); fld('title', 'Judul', $c['title'] ?? ''); ?></div>
                <p class="text-[11px] text-slate-400 -mb-2">Baris tanpa kutipan dilewati. Foto opsional — tanpa foto akan tampil inisial nama.</p>
                <?php $titems = parse_items($c['items'] ?? ''); $ttotal = min(8, max(count($titems) + 1, 4)); ?>
                <?php for ($i = 0; $i < $ttotal; $i++): $it = $titems[$i] ?? []; ?>
                    <fieldset class="rounded-xl border border-slate-200 p-4 space-y-3">
                        <legend class="px-2 text-xs font-bold text-slate-400 uppercase tracking-wide">Testimoni <?= $i + 1 ?></legend>
                        <?php area("t{$i}_quote", 'Kutipan', $it[0] ?? '', 2); ?>
                        <div class="grid sm:grid-cols-2 gap-3">
                            <?php fld("t{$i}_name", 'Nama', $it[1] ?? ''); ?>
                            <?php fld("t{$i}_role", 'Jabatan / peran', $it[2] ?? ''); ?>
                        </div>
                        <?php imgfld("t{$i}_photo", 'Foto (opsional)', $it[3] ?? ''); ?>
                    </fieldset>
                <?php endfor; ?>

            <?php elseif ($sec === 'klien'): ?>
                <?php fld('title', 'Judul kecil di atas marquee', $c['title'] ?? ''); ?>
                <p class="text-[11px] text-slate-400 -mb-2">Logo opsional — tanpa logo, nama klien tampil sebagai teks.</p>
                <?php $kitems = parse_items($c['items'] ?? ''); $ktotal = min(24, max(count($kitems) + 2, 8)); ?>
                <div class="grid sm:grid-cols-2 gap-4">
                    <?php for ($i = 0; $i < $ktotal; $i++): $it = $kitems[$i] ?? []; ?>
                        <fieldset class="rounded-xl border border-slate-200 p-4 space-y-2.5">
                            <legend class="px-2 text-xs font-bold text-slate-400">Klien <?= $i + 1 ?></legend>
                            <?php fld("k{$i}_name", 'Nama', $it[0] ?? ''); ?>
                            <?php imgfld("k{$i}_logo", 'Logo (opsional)', $it[1] ?? ''); ?>
                        </fieldset>
                    <?php endfor; ?>
                </div>

            <?php elseif ($sec === 'order'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('kicker', 'Kicker', $c['kicker'] ?? ''); fld('title', 'Judul', $c['title'] ?? ''); ?></div>
                <?php area('subtitle', 'Subjudul', $c['subtitle'] ?? '', 2); ?>
                <div class="grid sm:grid-cols-2 gap-3">
                    <?php fld('whatsapp', 'No. WA tujuan (kosong = WA toko)', $c['whatsapp'] ?? ''); ?>
                    <?php fld('branches', 'Cabang (pisah baris pakai Enter tidak bisa di sini — pisah koma)', str_replace("\n", ', ', $c['branches'] ?? '')); ?>
                </div>
                <p class="text-[11px] text-slate-400">Form ini terhubung ke CRM PosPro — setiap kiriman masuk sebagai Lead baru.</p>

            <?php elseif ($sec === 'artikel'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('kicker', 'Kicker', $c['kicker'] ?? ''); fld('title', 'Judul', $c['title'] ?? ''); ?></div>
                <?php fld('limit', 'Jumlah artikel ditampilkan', (string)($c['limit'] ?? 5)); ?>

            <?php elseif ($sec === 'faq'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('kicker', 'Kicker', $c['kicker'] ?? ''); fld('title', 'Judul', $c['title'] ?? ''); ?></div>
                <?php area('items', 'Daftar pertanyaan', $c['items'] ?? '', 8, 'Per baris: <code>Pertanyaan | Jawaban</code>'); ?>

            <?php elseif ($sec === 'kontak'): ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('title', 'Judul', $c['title'] ?? ''); fld('email', 'Email (berlaku semua cabang)', $c['email'] ?? ''); ?></div>
                <p class="text-[11px] text-slate-400 -mb-2">Setiap lokasi tampil sebagai kartu cabang — pengunjung klik kartu untuk melihat petanya. Lokasi tanpa nama &amp; alamat dilewati.</p>
                <?php $klocs = array_values((array)($c['locations'] ?? [])); $ltot = min(5, max(count($klocs) + 1, 2)); ?>
                <?php for ($i = 0; $i < $ltot; $i++): $l = $klocs[$i] ?? []; ?>
                    <fieldset class="rounded-xl border border-slate-200 p-4 space-y-3">
                        <legend class="px-2 text-xs font-bold text-slate-400 uppercase tracking-wide">Lokasi <?= $i + 1 ?></legend>
                        <?php fld("loc{$i}_name", 'Nama cabang', $l['name'] ?? '', 'mis. Voliko Print — Imogiri'); ?>
                        <?php area("loc{$i}_address", 'Alamat', $l['address'] ?? '', 2); ?>
                        <div class="grid sm:grid-cols-3 gap-3">
                            <?php fld("loc{$i}_phone", 'Telepon', $l['phone'] ?? ''); ?>
                            <?php fld("loc{$i}_whatsapp", 'WhatsApp', $l['whatsapp'] ?? ''); ?>
                            <?php fld("loc{$i}_hours", 'Jam operasional', $l['hours'] ?? '', 'Senin–Sabtu 08.00–20.00'); ?>
                        </div>
                        <?php fld("loc{$i}_maps", 'URL embed Google Maps', $l['mapsEmbed'] ?? ''); ?>
                        <p class="text-[11px] text-slate-400">Cara ambil: buka Google Maps &rarr; cari lokasi &rarr; <b>Bagikan</b> &rarr; tab <b>Sematkan peta</b> &rarr; salin alamat yang ada di dalam <code>src="..."</code>.</p>
                    </fieldset>
                <?php endfor; ?>

            <?php elseif ($sec === 'cta'): ?>
                <?php fld('title', 'Judul', $c['title'] ?? ''); ?>
                <?php area('subtitle', 'Subjudul', $c['subtitle'] ?? '', 2); ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('btnText', 'Teks tombol', $c['btnText'] ?? ''); fld('btnLink', 'Link tombol', $c['btnLink'] ?? '#order-cepat'); ?></div>

            <?php elseif ($sec === 'katalog'): ?>
                <p class="text-[11px] text-slate-400 -mb-2">Slider promo di atas halaman <b>Produk</b> — bisa beberapa slide & digeser. Gambar opsional (tampil kecil di samping, bukan full). Badge = teks mengambang (mis. "Promo", "Diskon 20%"). Slide tanpa judul &amp; gambar dilewati.</p>
                <?php $kslides = array_pad(array_slice($c['slides'] ?? [], 0, 5), 2, []); ?>
                <?php foreach ($kslides as $i => $s): if ($i >= 5) break; ?>
                    <fieldset class="rounded-xl border border-slate-200 p-4 space-y-3">
                        <legend class="px-2 text-xs font-bold text-slate-400 uppercase tracking-wide">Slide promo <?= $i + 1 ?></legend>
                        <div class="grid sm:grid-cols-2 gap-3">
                            <?php fld("s{$i}_badge", 'Badge mengambang', $s['badge'] ?? '', 'mis. Promo / Diskon 20%'); ?>
                            <?php fld("s{$i}_title", 'Judul', $s['title'] ?? ''); ?>
                        </div>
                        <?php area("s{$i}_subtitle", 'Subjudul / info', $s['subtitle'] ?? '', 2); ?>
                        <?php imgfld("s{$i}_image", 'Gambar kecil (opsional)', $s['image'] ?? ''); ?>
                        <div class="grid sm:grid-cols-2 gap-3">
                            <?php fld("s{$i}_btnText", 'Teks tombol (opsional)', $s['btnText'] ?? ''); ?>
                            <?php fld("s{$i}_btnLink", 'Link tombol', $s['btnLink'] ?? ''); ?>
                        </div>
                    </fieldset>
                <?php endforeach; ?>

            <?php elseif ($sec === 'popup'): ?>
                <?php imgfld('image', 'Gambar promo', $c['image'] ?? ''); ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('title', 'Judul', $c['title'] ?? ''); fld('link', 'Link saat gambar diklik', $c['link'] ?? ''); ?></div>
                <?php area('text', 'Teks', $c['text'] ?? '', 2); ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('btnText', 'Teks tombol', $c['btnText'] ?? ''); fld('btnLink', 'Link tombol', $c['btnLink'] ?? ''); ?></div>
                <label class="inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" name="once" value="1" <?= !empty($c['once']) ? 'checked' : '' ?> class="rounded"> Tampilkan sekali per hari per pengunjung</label>

            <?php elseif ($sec === 'profil'): ?>
                <?php fld('heroTitle', 'Judul hero halaman Profil', $c['heroTitle'] ?? ''); ?>
                <div class="grid sm:grid-cols-2 gap-3"><?php fld('heroAccent', 'Kata yang ditonjolkan', $c['heroAccent'] ?? ''); ?></div>
                <?php area('heroSubtitle', 'Subjudul hero', $c['heroSubtitle'] ?? '', 2); ?>
                <hr class="border-slate-100">
                <?php fld('title', 'Judul "Siapa Kami"', $c['title'] ?? ''); ?>
                <?php area('text', 'Paragraf', $c['text'] ?? '', 4); ?>
                <?php imgfld('image', 'Foto (opsional)', $c['image'] ?? ''); ?>
                <?php area('list', 'Poin keunggulan (per baris)', $c['list'] ?? '', 3); ?>
                <?php area('nilai', 'Nilai perusahaan', $c['nilai'] ?? '', 5, 'Per baris: <code>Nama Nilai | Penjelasan</code>'); ?>

            <?php elseif ($sec === 'portofolio_page'): ?>
                <?php fld('heroTitle', 'Judul hero halaman Portofolio', $c['heroTitle'] ?? ''); ?>
                <?php fld('heroAccent', 'Kata yang ditonjolkan', $c['heroAccent'] ?? ''); ?>
                <?php area('heroSubtitle', 'Subjudul hero', $c['heroSubtitle'] ?? '', 2); ?>
                <p class="text-[11px] text-slate-400">Daftar foto karya diambil dari section <a class="underline" href="content.php?sec=portofolio">Karya Terpilih</a>.</p>
            <?php endif; ?>

            <div class="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button type="submit" name="action" value="save" class="px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-bold hover:opacity-90 transition">Simpan</button>
                <button type="submit" name="action" value="reset" onclick="return confirm('Kembalikan isi section ini ke teks bawaan?')" class="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:text-rose-600 hover:border-rose-200 transition">Reset ke bawaan</button>
            </div>
        </form>
    </div>
</div>
<?php include __DIR__ . '/admin_footer.php'; ?>
