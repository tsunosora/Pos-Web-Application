<?php
require_once __DIR__ . '/lib.php';
require_once __DIR__ . '/home_blocks.php';
require_admin();

$types = home_block_types();
$addable = addable_block_types();

// Default blok baru per tipe
function default_block(string $type): array {
    $base = ['type' => $type, 'enabled' => true];
    switch ($type) {
        case 'hero':     return $base + ['badge' => '', 'title' => '', 'subtitle' => '', 'btnText' => 'Lihat Produk', 'btnLink' => '#produk', 'image' => ''];
        case 'slider':   return $base + ['slides' => [
            ['image' => '', 'title' => 'Promo Spesial Bulan Ini', 'subtitle' => 'Penawaran terbatas, jangan sampai kehabisan!', 'btnText' => 'Belanja', 'btnLink' => '#produk'],
            ['image' => '', 'title' => 'Sablon Satuan? Bisa!', 'subtitle' => 'Tanpa minimal order untuk produk pilihan.', 'btnText' => 'Lihat Produk', 'btnLink' => '#produk'],
        ]];
        case 'popup':    return $base + ['image' => '', 'title' => 'Promo Spesial!', 'text' => 'Dapatkan penawaran terbaik hari ini.', 'btnText' => 'Lihat Promo', 'btnLink' => '#produk', 'link' => '', 'once' => true];
        case 'produk':   return $base + ['title' => 'Produk Kami', 'source' => 'all', 'categoryId' => '', 'limit' => 8, 'search' => true];
        case 'kategori': return $base + ['title' => 'Kategori'];
        case 'portofolio': return $base + ['title' => 'Portofolio Karya Kami', 'subtitle' => 'Beberapa hasil cetakan yang sudah kami kerjakan.', 'items' => []];
        case 'tentang':  return $base + ['title' => 'Tentang Kami', 'text' => 'Ceritakan tentang bisnis Anda di sini.', 'image' => '', 'list' => "Berpengalaman bertahun-tahun\nKualitas terjamin\nPelayanan ramah"];
        case 'fitur':    return $base + ['title' => 'Layanan Kami', 'subtitle' => '', 'items' => "Sablon Kaos | Hasil rapi dan tahan lama\nCetak Banner | Cepat dan harga bersaing\nDesain Gratis | Tim desainer siap bantu"];
        case 'statistik':return $base + ['items' => "500+ | Pelanggan\n1000+ | Pesanan Selesai\n5 Th | Pengalaman\n4.9 | Rating"];
        case 'testimoni':return $base + ['title' => 'Kata Mereka', 'items' => "Hasilnya memuaskan dan cepat! | Andi | Pelanggan\nPelayanan ramah, recommended. | Sari | UMKM"];
        case 'faq':      return $base + ['title' => 'Pertanyaan Umum', 'items' => "Berapa lama pengerjaan? | Umumnya 2-3 hari kerja tergantung antrian.\nApakah bisa COD? | Bisa, hubungi kami via WhatsApp."];
        case 'artikel':  return $base + ['title' => 'Artikel Terbaru', 'limit' => 3];
        case 'banner':   return $base + ['image' => '', 'link' => ''];
        case 'teks':     return $base + ['title' => 'Info', 'html' => ''];
        case 'kontak':   return $base + ['title' => 'Hubungi Kami', 'address' => '', 'phone' => '', 'whatsapp' => '', 'email' => '', 'mapsEmbed' => ''];
        case 'cta':      return $base + ['title' => 'Siap pesan?', 'subtitle' => '', 'btnText' => 'Chat WhatsApp', 'btnLink' => ''];
    }
    return $base;
}

// Bangun satu blok dari data POST
function build_block(array $raw, string $uid): array {
    $type = $raw['type'] ?? 'teks';
    $b = ['type' => $type, 'enabled' => ($raw['enabled'] ?? '0') === '1'];
    $f = fn($k, $d = '') => isset($raw[$k]) ? trim((string)$raw[$k]) : $d;
    switch ($type) {
        case 'hero':     $b += ['badge' => $f('badge'), 'title' => $f('title'), 'subtitle' => $f('subtitle'), 'btnText' => $f('btnText'), 'btnLink' => $f('btnLink')]; break;
        case 'slider':
            $slides = [];
            for ($i = 0; $i < 4; $i++) {
                $sr = $raw['slides'][$i] ?? [];
                $img = $sr['image'] ?? '';
                $fk = 'img_' . $uid . '_' . $i;
                if (!empty($_FILES[$fk]['name'])) { $up = save_upload($_FILES[$fk]); if ($up) $img = $up; }
                if (($sr['remove'] ?? '') === '1') $img = '';
                $t = trim($sr['title'] ?? ''); $su = trim($sr['subtitle'] ?? ''); $bt = trim($sr['btnText'] ?? ''); $bl = trim($sr['btnLink'] ?? '');
                if ($img === '' && $t === '' && $su === '' && $bt === '') continue;
                $slides[] = ['image' => $img, 'title' => $t, 'subtitle' => $su, 'btnText' => $bt, 'btnLink' => $bl];
            }
            $b['slides'] = $slides;
            break;
        case 'popup':    $b += ['title' => $f('title'), 'text' => $f('text'), 'btnText' => $f('btnText'), 'btnLink' => $f('btnLink'), 'link' => $f('link'), 'once' => ($raw['once'] ?? '0') === '1']; break;
        case 'portofolio':
            $b += ['title' => $f('title'), 'subtitle' => $f('subtitle')];
            $items = [];
            for ($i = 0; $i < 8; $i++) {
                $ir = $raw['items'][$i] ?? [];
                $img = $ir['image'] ?? '';
                $fk = 'img_' . $uid . '_' . $i;
                if (!empty($_FILES[$fk]['name'])) { $up = save_upload($_FILES[$fk]); if ($up) $img = $up; }
                if (($ir['remove'] ?? '') === '1') $img = '';
                $t = trim($ir['title'] ?? ''); $c = trim($ir['caption'] ?? '');
                if ($img === '' && $t === '') continue;
                $items[] = ['image' => $img, 'title' => $t, 'caption' => $c];
            }
            $b['items'] = $items;
            break;
        case 'produk':   $b += ['title' => $f('title'), 'source' => $f('source', 'all'), 'categoryId' => $f('categoryId'), 'limit' => (int)$f('limit', '8'), 'search' => ($raw['search'] ?? '0') === '1']; break;
        case 'kategori': $b += ['title' => $f('title')]; break;
        case 'tentang':  $b += ['title' => $f('title'), 'text' => $raw['text'] ?? '', 'list' => $raw['list'] ?? '']; break;
        case 'fitur':    $b += ['title' => $f('title'), 'subtitle' => $f('subtitle'), 'items' => $raw['items'] ?? '']; break;
        case 'statistik':$b += ['items' => $raw['items'] ?? '']; break;
        case 'testimoni':$b += ['title' => $f('title'), 'items' => $raw['items'] ?? '']; break;
        case 'faq':      $b += ['title' => $f('title'), 'items' => $raw['items'] ?? '']; break;
        case 'artikel':  $b += ['title' => $f('title'), 'limit' => (int)$f('limit', '3')]; break;
        case 'banner':   $b += ['link' => $f('link')]; break;
        case 'teks':     $b += ['title' => $f('title'), 'html' => $raw['html'] ?? '']; break;
        case 'kontak':   $b += ['title' => $f('title'), 'address' => $raw['address'] ?? '', 'phone' => $f('phone'), 'whatsapp' => $f('whatsapp'), 'email' => $f('email'), 'mapsEmbed' => $f('mapsEmbed')]; break;
        case 'cta':      $b += ['title' => $f('title'), 'subtitle' => $f('subtitle'), 'btnText' => $f('btnText'), 'btnLink' => $f('btnLink')]; break;
    }
    // Gambar (hero/banner/tentang/popup)
    if (in_array($type, ['hero', 'banner', 'tentang', 'popup'], true)) {
        $img = $raw['image'] ?? '';
        if (!empty($_FILES['img_' . $uid]['name'])) { $up = save_upload($_FILES['img_' . $uid]); if ($up) $img = $up; }
        if (($raw['remove_image'] ?? '') === '1') $img = '';
        $b['image'] = $img;
    }
    return $b;
}

function rebuild_blocks(?string $skip = null): array {
    $order = array_filter(explode(',', $_POST['order'] ?? ''), 'strlen');
    $blocks = [];
    foreach ($order as $uid) {
        if ($skip !== null && (string)$uid === (string)$skip) continue;
        $raw = $_POST['block'][$uid] ?? null;
        if (is_array($raw)) $blocks[] = build_block($raw, (string)$uid);
    }
    return $blocks;
}

// Halaman yang diedit: 'home' (beranda), 'profil', atau 'portofolio'
$page = $_POST['pg'] ?? $_GET['pg'] ?? 'home';
if (!in_array($page, ['home', 'profil', 'portofolio'], true)) $page = 'home';
$pageFile  = ['home' => 'index.php', 'profil' => 'profil.php', 'portofolio' => 'portofolio.php'][$page];
$pageLabel = ['home' => 'Beranda', 'profil' => 'Profil', 'portofolio' => 'Portofolio'][$page];
$back = fn($m) => header('Location: appearance.php?pg=' . $page . '&msg=' . urlencode($m));

// ── Aksi ─────────────────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    $param  = $_POST['param'] ?? '';
    if ($action === 'add' && isset($addable[$param])) {
        $blocks = rebuild_blocks();
        $blocks[] = default_block($param);
        save_page_layout($page, $blocks);
        $back('Blok ditambahkan.'); exit;
    }
    if ($action === 'delete') {
        save_page_layout($page, rebuild_blocks($param));
        $back('Blok dihapus.'); exit;
    }
    if ($action === 'save') {
        save_page_layout($page, rebuild_blocks());
        $back('Tampilan tersimpan.'); exit;
    }
    if ($action === 'reset') {
        save_page_layout($page, default_layout_for($page));
        $back('Dikembalikan ke bawaan.'); exit;
    }
}

$msg = $_GET['msg'] ?? null;
$layout = page_layout($page);

// Kategori dari katalog PosPro (untuk pilihan blok produk)
$products = public_products();
$cats = [];
foreach ($products as $p) {
    $c = $p['category'] ?? null;
    if ($c && !isset($cats[$c['id']])) $cats[$c['id']] = $c['name'];
}

$page_title = 'Tampilan Toko';
$active = 'appearance';
$head_extra = '<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.2/Sortable.min.js"></script>';
include __DIR__ . '/admin_header.php';

// Render field editor per tipe
function editor_fields(string $uid, array $b, array $cats): void {
    $type = $b['type'];
    $n = fn($k) => 'block[' . $uid . '][' . $k . ']';
    $v = fn($k, $d = '') => h($b[$k] ?? $d);
    $inp = 'w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50';
    switch ($type) {
        case 'hero':
        case 'cta':
            if ($type === 'hero') echo '<input name="' . $n('badge') . '" value="' . $v('badge') . '" placeholder="Badge kecil (mis. Terpercaya sejak 2019)" class="' . $inp . '">';
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul" class="' . $inp . '">';
            echo '<input name="' . $n('subtitle') . '" value="' . $v('subtitle') . '" placeholder="Subjudul" class="' . $inp . '">';
            echo '<div class="grid grid-cols-2 gap-2">';
            echo '<input name="' . $n('btnText') . '" value="' . $v('btnText') . '" placeholder="Teks tombol" class="' . $inp . '">';
            echo '<input name="' . $n('btnLink') . '" value="' . $v('btnLink') . '" placeholder="Link tombol (mis. https://wa.me/..)" class="' . $inp . '">';
            echo '</div>';
            if ($type === 'hero') image_field($uid, $b);
            break;
        case 'produk':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul section" class="' . $inp . '">';
            echo '<div class="grid grid-cols-2 gap-2">';
            echo '<select name="' . $n('source') . '" class="' . $inp . '"><option value="all"' . (($b['source'] ?? '') === 'all' ? ' selected' : '') . '>Semua produk</option><option value="category"' . (($b['source'] ?? '') === 'category' ? ' selected' : '') . '>Kategori tertentu</option></select>';
            echo '<select name="' . $n('categoryId') . '" class="' . $inp . '"><option value="">— kategori —</option>';
            foreach ($cats as $id => $name) echo '<option value="' . h($id) . '"' . ((string)($b['categoryId'] ?? '') === (string)$id ? ' selected' : '') . '>' . h($name) . '</option>';
            echo '</select></div>';
            echo '<div class="flex items-center gap-4"><label class="text-sm text-slate-600 flex items-center gap-2">Jumlah <input type="number" min="1" name="' . $n('limit') . '" value="' . $v('limit', '8') . '" class="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm"></label>';
            echo '<label class="text-sm text-slate-600 flex items-center gap-2"><input type="hidden" name="' . $n('search') . '" value="0"><input type="checkbox" name="' . $n('search') . '" value="1"' . (!empty($b['search']) ? ' checked' : '') . ' class="accent-brand"> Tampilkan pencarian & filter</label></div>';
            break;
        case 'kategori':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul" class="' . $inp . '">';
            echo '<p class="text-xs text-slate-400">Menampilkan semua kategori dari katalog sebagai tombol filter.</p>';
            break;
        case 'artikel':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul" class="' . $inp . '">';
            echo '<label class="text-sm text-slate-600 flex items-center gap-2">Jumlah artikel <input type="number" min="1" name="' . $n('limit') . '" value="' . $v('limit', '3') . '" class="w-20 px-2 py-1.5 rounded-lg border border-slate-200 text-sm"></label>';
            break;
        case 'banner':
            image_field($uid, $b);
            echo '<input name="' . $n('link') . '" value="' . $v('link') . '" placeholder="Link saat diklik (opsional)" class="' . $inp . '">';
            break;
        case 'teks':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul" class="' . $inp . '">';
            echo '<textarea name="' . $n('html') . '" rows="4" placeholder="Tulis teks / HTML sederhana" class="' . $inp . '">' . h($b['html'] ?? '') . '</textarea>';
            break;
        case 'tentang':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul" class="' . $inp . '">';
            echo '<textarea name="' . $n('text') . '" rows="3" placeholder="Deskripsi tentang bisnis Anda" class="' . $inp . '">' . h($b['text'] ?? '') . '</textarea>';
            echo '<textarea name="' . $n('list') . '" rows="3" placeholder="Keunggulan (satu per baris)" class="' . $inp . '">' . h($b['list'] ?? '') . '</textarea>';
            image_field($uid, $b);
            break;
        case 'fitur':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul section" class="' . $inp . '">';
            echo '<input name="' . $n('subtitle') . '" value="' . $v('subtitle') . '" placeholder="Subjudul (opsional)" class="' . $inp . '">';
            echo '<textarea name="' . $n('items') . '" rows="4" placeholder="Judul | Deskripsi (satu layanan per baris)" class="' . $inp . '">' . h($b['items'] ?? '') . '</textarea>';
            echo '<p class="text-xs text-slate-400">Format tiap baris: <b>Judul | Deskripsi</b></p>';
            break;
        case 'statistik':
            echo '<textarea name="' . $n('items') . '" rows="4" placeholder="Angka | Label (satu per baris)" class="' . $inp . '">' . h($b['items'] ?? '') . '</textarea>';
            echo '<p class="text-xs text-slate-400">Format tiap baris: <b>Angka | Label</b> — mis. <code>500+ | Pelanggan</code></p>';
            break;
        case 'testimoni':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul" class="' . $inp . '">';
            echo '<textarea name="' . $n('items') . '" rows="4" placeholder="Kutipan | Nama | Peran (opsional)" class="' . $inp . '">' . h($b['items'] ?? '') . '</textarea>';
            echo '<p class="text-xs text-slate-400">Format tiap baris: <b>Kutipan | Nama | Peran</b></p>';
            break;
        case 'faq':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul" class="' . $inp . '">';
            echo '<textarea name="' . $n('items') . '" rows="4" placeholder="Pertanyaan | Jawaban (satu per baris)" class="' . $inp . '">' . h($b['items'] ?? '') . '</textarea>';
            echo '<p class="text-xs text-slate-400">Format tiap baris: <b>Pertanyaan | Jawaban</b></p>';
            break;
        case 'kontak':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul" class="' . $inp . '">';
            echo '<textarea name="' . $n('address') . '" rows="2" placeholder="Alamat" class="' . $inp . '">' . h($b['address'] ?? '') . '</textarea>';
            echo '<div class="grid grid-cols-2 gap-2">';
            echo '<input name="' . $n('phone') . '" value="' . $v('phone') . '" placeholder="Telepon" class="' . $inp . '">';
            echo '<input name="' . $n('whatsapp') . '" value="' . $v('whatsapp') . '" placeholder="WhatsApp (08..)" class="' . $inp . '">';
            echo '</div>';
            echo '<input name="' . $n('email') . '" value="' . $v('email') . '" placeholder="Email" class="' . $inp . '">';
            echo '<input name="' . $n('mapsEmbed') . '" value="' . $v('mapsEmbed') . '" placeholder="URL embed Google Maps (src iframe)" class="' . $inp . '">';
            echo '<p class="text-xs text-slate-400">Google Maps → Bagikan → Sematkan peta → salin URL di <code>src="..."</code>.</p>';
            break;
        case 'slider':
            echo '<p class="text-xs text-slate-400 mb-1">Sampai 4 slide (slide kosong dilewati). Berputar otomatis.</p>';
            $slides = $b['slides'] ?? [];
            for ($i = 0; $i < 4; $i++) {
                $s = $slides[$i] ?? [];
                $simg = $s['image'] ?? '';
                echo '<div class="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/60">';
                echo '<div class="text-xs font-semibold text-slate-500">Slide ' . ($i + 1) . '</div>';
                echo '<div class="flex items-center gap-2">';
                echo '<div class="w-20 h-12 rounded bg-slate-100 overflow-hidden shrink-0 grid place-items-center text-slate-300">' . ($simg ? '<img src="' . h($simg) . '" class="w-full h-full object-cover">' : '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16v12H4z"/></svg>') . '</div>';
                echo '<div class="flex-1">';
                echo '<input type="hidden" name="block[' . $uid . '][slides][' . $i . '][image]" value="' . h($simg) . '">';
                echo '<input type="file" name="img_' . $uid . '_' . $i . '" accept="image/*" class="block w-full text-xs text-slate-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-200 file:text-slate-700 file:font-semibold file:cursor-pointer">';
                if ($simg) echo '<label class="text-xs text-rose-500 flex items-center gap-1 mt-1"><input type="checkbox" name="block[' . $uid . '][slides][' . $i . '][remove]" value="1" class="accent-rose-500"> hapus gambar</label>';
                echo '</div></div>';
                echo '<input name="block[' . $uid . '][slides][' . $i . '][title]" value="' . h($s['title'] ?? '') . '" placeholder="Judul slide" class="' . $inp . '">';
                echo '<input name="block[' . $uid . '][slides][' . $i . '][subtitle]" value="' . h($s['subtitle'] ?? '') . '" placeholder="Subjudul" class="' . $inp . '">';
                echo '<div class="grid grid-cols-2 gap-2"><input name="block[' . $uid . '][slides][' . $i . '][btnText]" value="' . h($s['btnText'] ?? '') . '" placeholder="Teks tombol" class="' . $inp . '"><input name="block[' . $uid . '][slides][' . $i . '][btnLink]" value="' . h($s['btnLink'] ?? '') . '" placeholder="Link tombol" class="' . $inp . '"></div>';
                echo '</div>';
            }
            break;
        case 'portofolio':
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul section" class="' . $inp . '">';
            echo '<input name="' . $n('subtitle') . '" value="' . $v('subtitle') . '" placeholder="Subjudul (opsional)" class="' . $inp . '">';
            echo '<p class="text-xs text-slate-400">Sampai 8 foto karya (slot kosong dilewati). Pengunjung bisa klik foto untuk memperbesar.</p>';
            $items = $b['items'] ?? [];
            echo '<div class="grid sm:grid-cols-2 gap-3">';
            for ($i = 0; $i < 8; $i++) {
                $it = $items[$i] ?? [];
                $iimg = $it['image'] ?? '';
                echo '<div class="rounded-xl border border-slate-200 p-3 space-y-2 bg-slate-50/60">';
                echo '<div class="text-xs font-semibold text-slate-500">Foto ' . ($i + 1) . '</div>';
                echo '<div class="flex items-center gap-2">';
                echo '<div class="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 grid place-items-center text-slate-300">' . ($iimg ? '<img src="' . h($iimg) . '" class="w-full h-full object-cover">' : '<svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16v12H4z"/></svg>') . '</div>';
                echo '<div class="flex-1 min-w-0">';
                echo '<input type="hidden" name="block[' . $uid . '][items][' . $i . '][image]" value="' . h($iimg) . '">';
                echo '<input type="file" name="img_' . $uid . '_' . $i . '" accept="image/*" class="block w-full text-xs text-slate-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-200 file:text-slate-700 file:font-semibold file:cursor-pointer">';
                if ($iimg) echo '<label class="text-xs text-rose-500 flex items-center gap-1 mt-1"><input type="checkbox" name="block[' . $uid . '][items][' . $i . '][remove]" value="1" class="accent-rose-500"> hapus foto</label>';
                echo '</div></div>';
                echo '<input name="block[' . $uid . '][items][' . $i . '][title]" value="' . h($it['title'] ?? '') . '" placeholder="Judul karya" class="' . $inp . '">';
                echo '<input name="block[' . $uid . '][items][' . $i . '][caption]" value="' . h($it['caption'] ?? '') . '" placeholder="Keterangan (mis. Jersey Printing)" class="' . $inp . '">';
                echo '</div>';
            }
            echo '</div>';
            break;
        case 'popup':
            image_field($uid, $b);
            echo '<input name="' . $n('title') . '" value="' . $v('title') . '" placeholder="Judul" class="' . $inp . '">';
            echo '<input name="' . $n('text') . '" value="' . $v('text') . '" placeholder="Teks singkat" class="' . $inp . '">';
            echo '<div class="grid grid-cols-2 gap-2"><input name="' . $n('btnText') . '" value="' . $v('btnText') . '" placeholder="Teks tombol" class="' . $inp . '"><input name="' . $n('btnLink') . '" value="' . $v('btnLink') . '" placeholder="Link tombol" class="' . $inp . '"></div>';
            echo '<input name="' . $n('link') . '" value="' . $v('link') . '" placeholder="Link saat gambar diklik (opsional)" class="' . $inp . '">';
            echo '<label class="flex items-center gap-2 text-sm text-slate-600"><input type="hidden" name="' . $n('once') . '" value="0"><input type="checkbox" name="' . $n('once') . '" value="1"' . (!empty($b['once']) ? ' checked' : '') . ' class="accent-brand"> Tampilkan sekali per hari per pengunjung</label>';
            break;
    }
}

function image_field(string $uid, array $b): void {
    $img = $b['image'] ?? '';
    echo '<div class="flex items-center gap-3">';
    echo '<div class="w-24 h-16 rounded-lg bg-slate-100 overflow-hidden shrink-0 grid place-items-center text-slate-300">';
    if ($img) echo '<img src="' . h($img) . '" class="w-full h-full object-cover">';
    else echo '<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16v12H4z"/></svg>';
    echo '</div><div class="flex-1">';
    echo '<input type="hidden" name="block[' . $uid . '][image]" value="' . h($img) . '">';
    echo '<input type="file" name="img_' . $uid . '" accept="image/*" class="block w-full text-xs text-slate-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-200 file:text-slate-700 file:font-semibold file:cursor-pointer">';
    if ($img) echo '<label class="mt-1 flex items-center gap-1.5 text-xs text-rose-500"><input type="checkbox" name="block[' . $uid . '][remove_image]" value="1" class="accent-rose-500"> Hapus gambar</label>';
    echo '</div></div>';
}
?>

<div class="flex items-center justify-between gap-3 mb-4 flex-wrap">
    <div class="inline-flex p-1 rounded-xl bg-slate-100">
        <a href="appearance.php?pg=home" class="px-4 py-1.5 rounded-lg text-sm font-semibold <?= $page === 'home' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700' ?>">Beranda</a>
        <a href="appearance.php?pg=profil" class="px-4 py-1.5 rounded-lg text-sm font-semibold <?= $page === 'profil' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700' ?>">Profil</a>
        <a href="appearance.php?pg=portofolio" class="px-4 py-1.5 rounded-lg text-sm font-semibold <?= $page === 'portofolio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700' ?>">Portofolio</a>
    </div>
    <a href="<?= h($pageFile) ?>" target="_blank" class="text-sm font-medium text-brand hover:underline">Lihat Halaman →</a>
</div>
<p class="text-sm text-slate-500 mb-4">Susun halaman <b><?= h($pageLabel) ?></b>: seret untuk mengurutkan, atur tiap blok, lalu simpan.</p>

<?php if ($msg): ?><div class="mb-4 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm"><?= h($msg) ?></div><?php endif; ?>

<form method="post" enctype="multipart/form-data" id="builderForm">
    <input type="hidden" name="pg" value="<?= h($page) ?>">
    <input type="hidden" name="action" id="actionField">
    <input type="hidden" name="param" id="paramField">
    <input type="hidden" name="order" id="orderField">

    <div class="grid lg:grid-cols-3 gap-6 items-start">
        <!-- Daftar blok -->
        <div class="lg:col-span-2">
            <div id="blockList" class="space-y-4">
                <?php foreach ($layout as $i => $b): $uid = (string)$i; ?>
                    <div class="blk bg-white rounded-2xl border border-slate-200 overflow-hidden" data-uid="<?= $uid ?>">
                        <div class="flex items-center gap-2 px-4 py-3 border-b border-slate-100 bg-slate-50">
                            <span class="handle cursor-grab text-slate-300 hover:text-slate-500" title="Seret">
                                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M7 4a1 1 0 11-2 0 1 1 0 012 0zM7 10a1 1 0 11-2 0 1 1 0 012 0zM6 17a1 1 0 100-2 1 1 0 000 2zM15 4a1 1 0 11-2 0 1 1 0 012 0zM14 10a1 1 0 11-2 0 1 1 0 012 0zM14 17a1 1 0 100-2 1 1 0 000 2z"/></svg>
                            </span>
                            <span class="font-bold text-slate-800"><?= h($types[$b['type']] ?? $b['type']) ?></span>
                            <input type="hidden" name="block[<?= $uid ?>][type]" value="<?= h($b['type']) ?>">
                            <label class="ml-auto flex items-center gap-1.5 text-xs text-slate-500">
                                <input type="hidden" name="block[<?= $uid ?>][enabled]" value="0">
                                <input type="checkbox" name="block[<?= $uid ?>][enabled]" value="1" <?= ($b['enabled'] ?? true) ? 'checked' : '' ?> class="accent-brand"> Aktif
                            </label>
                            <button type="button" onclick="submitAction('delete','<?= $uid ?>')" class="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50" title="Hapus blok">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                            </button>
                        </div>
                        <div class="p-4 space-y-3"><?php editor_fields($uid, $b, $cats); ?></div>
                    </div>
                <?php endforeach; ?>
            </div>

            <div class="mt-5 flex items-center gap-3">
                <button type="button" onclick="submitAction('save','')" class="px-6 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold hover:opacity-90 transition">Simpan Tampilan</button>
                <button type="button" onclick="if(confirm('Kembalikan ke tampilan bawaan?'))submitAction('reset','')" class="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition">Reset</button>
            </div>
        </div>

        <!-- Sidebar kanan: tambah blok + preview -->
        <div class="space-y-6">
        <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <h3 class="font-bold text-slate-900 mb-1">Tambah Blok</h3>
            <p class="text-xs text-slate-400 mb-4">Klik untuk menambahkan ke bawah.</p>
            <div class="grid grid-cols-2 gap-2">
                <?php foreach ($addable as $key => $label): ?>
                    <button type="button" onclick="submitAction('add','<?= h($key) ?>')" class="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:border-brand hover:text-brand hover:bg-brand/5 transition text-left"><?= h($label) ?></button>
                <?php endforeach; ?>
            </div>
            <p class="text-xs text-slate-400 mt-4">Perubahan yang belum disimpan ikut tersimpan saat menambah/menghapus blok.</p>
        </div>

        <!-- Preview halaman (kecil, di bawah Tambah Blok) -->
        <div class="bg-white rounded-2xl border border-slate-200 p-4">
            <div class="flex items-center justify-between gap-2 mb-3">
                <h3 class="font-bold text-slate-900 text-sm">Preview</h3>
                <div class="flex items-center gap-1">
                    <button type="button" onclick="document.getElementById('pagePreview').contentWindow.location.reload()" class="px-2.5 py-1 rounded-lg text-xs font-semibold text-brand hover:bg-brand/5">Muat ulang</button>
                    <a href="<?= h($pageFile) ?>" target="_blank" class="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50">Buka</a>
                </div>
            </div>
            <div class="rounded-xl border border-slate-200 bg-slate-100 p-2">
                <iframe id="pagePreview" src="<?= h($pageFile) ?>" class="w-full bg-white rounded-lg border border-slate-200" style="height:440px" loading="lazy"></iframe>
            </div>
            <p class="text-[11px] text-slate-400 mt-2">Menampilkan hasil tersimpan.</p>
        </div>
        </div>
    </div>
</form>

<script>
const sortable = new Sortable(document.getElementById('blockList'), { handle: '.handle', animation: 150 });
function submitAction(action, param) {
    document.getElementById('actionField').value = action;
    document.getElementById('paramField').value = param || '';
    document.getElementById('orderField').value = [...document.querySelectorAll('#blockList .blk')].map(e => e.dataset.uid).join(',');
    document.getElementById('builderForm').submit();
}
</script>

<?php include __DIR__ . '/admin_footer.php'; ?>
