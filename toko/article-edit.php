<?php
require_once __DIR__ . '/lib.php';
require_admin();
ensure_article_columns();

function unique_slug(string $base, ?int $exceptId): string {
    $base = $base ?: 'artikel';
    $slug = $base; $i = 2;
    while (true) {
        $q = db()->prepare('SELECT id FROM articles WHERE slug = ?' . ($exceptId ? ' AND id <> ?' : '') . ' LIMIT 1');
        $q->execute($exceptId ? [$slug, $exceptId] : [$slug]);
        if (!$q->fetch()) return $slug;
        $slug = $base . '-' . $i++;
    }
}

$id = (int)($_GET['id'] ?? 0);
$a = null;
if ($id) {
    $st = db()->prepare('SELECT * FROM articles WHERE id = ?');
    $st->execute([$id]);
    $a = $st->fetch();
    if (!$a) { header('Location: articles.php'); exit; }
}

$error = null;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $title   = trim($_POST['title'] ?? '');
    $slugIn  = trim($_POST['slug'] ?? '');
    $content = $_POST['content'] ?? '';
    $excerpt = trim($_POST['excerpt'] ?? '');
    $keyword = trim($_POST['seo_keyword'] ?? '');
    $metaT   = trim($_POST['meta_title'] ?? '');
    $metaD   = trim($_POST['meta_description'] ?? '');
    $score   = max(0, min(100, (int)($_POST['seo_score'] ?? 0)));

    // Status: DRAFT | PUBLISHED | SCHEDULED (terjadwal)
    $statusIn = $_POST['status'] ?? 'DRAFT';
    $schedRaw = trim($_POST['scheduled_at'] ?? '');
    $status = 'DRAFT'; $scheduledAt = null;
    if ($statusIn === 'PUBLISHED') {
        $status = 'PUBLISHED';
    } elseif ($statusIn === 'SCHEDULED') {
        $ts = $schedRaw !== '' ? strtotime(str_replace('T', ' ', $schedRaw)) : false;
        if ($ts === false) {
            $error = 'Pilih waktu tayang yang valid untuk artikel terjadwal.';
        } elseif ($ts <= time()) {
            $status = 'PUBLISHED'; // waktu sudah lewat → langsung terbit
        } else {
            $status = 'SCHEDULED';
            $scheduledAt = date('Y-m-d H:i:s', $ts);
        }
    }

    if ($title === '') {
        $error = 'Judul wajib diisi.';
    } elseif (!$error) {
        $slug = unique_slug(slugify($slugIn !== '' ? $slugIn : $title), $id ?: null);
        if ($excerpt === '') $excerpt = mb_substr(trim(preg_replace('/\s+/', ' ', strip_tags($content))), 0, 200);

        // Cover: upload baru kalau ada, jika tidak pertahankan lama
        $cover = $a['cover_url'] ?? null;
        if (!empty($_FILES['cover']['name'])) {
            $up = save_upload($_FILES['cover']);
            if ($up) $cover = $up; else $error = 'Cover bukan gambar yang valid.';
        }
        if (($_POST['remove_cover'] ?? '') === '1') $cover = null;

        if (!$error) {
            if ($id) {
                $sql = 'UPDATE articles SET title=?, slug=?, excerpt=?, content=?, cover_url=?, status=?, seo_keyword=?, meta_title=?, meta_description=?, seo_score=?, scheduled_at=?';
                $params = [$title, $slug, $excerpt, $content, $cover, $status, $keyword, $metaT, $metaD, $score, $scheduledAt];
                if ($status === 'PUBLISHED' && empty($a['published_at'])) $sql .= ', published_at=NOW()';
                $sql .= ' WHERE id=?'; $params[] = $id;
                db()->prepare($sql)->execute($params);
            } else {
                $pub = $status === 'PUBLISHED' ? date('Y-m-d H:i:s') : null;
                db()->prepare('INSERT INTO articles (title, slug, excerpt, content, cover_url, status, author_id, seo_keyword, meta_title, meta_description, seo_score, scheduled_at, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
                    ->execute([$title, $slug, $excerpt, $content, $cover, $status, current_user()['id'], $keyword, $metaT, $metaD, $score, $scheduledAt, $pub]);
            }
            $flash = $status === 'SCHEDULED' ? 'Artikel dijadwalkan tayang ' . date('d/m/Y H:i', strtotime($scheduledAt)) . '.' : 'Artikel disimpan.';
            header('Location: articles.php?msg=' . urlencode($flash));
            exit;
        }
    }
    // repopulate on error
    $a = array_merge($a ?? [], compact('title', 'content', 'excerpt', 'keyword', 'metaT', 'metaD', 'status') + ['slug' => $slugIn]);
}

$v = fn($k, $d = '') => h($a[$k] ?? $d);
$page_title = $id ? 'Edit Artikel' : 'Tulis Artikel';
$active = 'articles';
$head_extra = '<link href="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.snow.css" rel="stylesheet"><style>'
    . '#editor{min-height:340px}.ql-editor{font-size:15px;line-height:1.7}.ql-editor img{cursor:pointer;max-width:100%;height:auto}'
    . '.ql-toolbar.ql-snow,.ql-container.ql-snow{border-color:#e2e8f0}.ql-toolbar.ql-snow{border-radius:12px 12px 0 0}.ql-container.ql-snow{border-radius:0 0 12px 12px}'
    . '.img-resizer{position:absolute;border:2px solid ' . h(BRAND_COLOR) . ';z-index:50;pointer-events:none;box-sizing:border-box}'
    . '.img-resizer-handle{position:absolute;width:12px;height:12px;background:' . h(BRAND_COLOR) . ';border:2px solid #fff;border-radius:50%;pointer-events:auto;box-shadow:0 1px 3px rgba(0,0,0,.3)}'
    . '.img-resizer-handle.nw{left:-7px;top:-7px;cursor:nwse-resize}.img-resizer-handle.ne{right:-7px;top:-7px;cursor:nesw-resize}'
    . '.img-resizer-handle.sw{left:-7px;bottom:-7px;cursor:nesw-resize}.img-resizer-handle.se{right:-7px;bottom:-7px;cursor:nwse-resize}'
    . '</style>';
include __DIR__ . '/admin_header.php';
?>

<form method="post" enctype="multipart/form-data" id="artForm">
<?php $schedVal = !empty($a['scheduled_at']) ? date('Y-m-d\TH:i', strtotime($a['scheduled_at'])) : ''; ?>
<div class="sticky top-20 z-20 mb-6 bg-white/90 backdrop-blur rounded-2xl border border-slate-200 shadow-sm px-4 py-3">
    <div class="flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-3 min-w-0">
            <a href="articles.php" class="grid place-items-center h-9 w-9 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 transition shrink-0" title="Kembali ke daftar">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
            </a>
            <div class="min-w-0">
                <h1 class="font-extrabold text-slate-900 leading-tight truncate"><?= $id ? 'Edit Artikel' : 'Tulis Artikel Baru' ?></h1>
                <p class="text-xs text-slate-400">Tulis, atur SEO, lalu terbitkan atau jadwalkan.</p>
            </div>
        </div>
        <div class="flex items-center gap-2 flex-wrap justify-end">
            <input type="datetime-local" name="scheduled_at" id="scheduled_at" value="<?= h($schedVal) ?>"
                   class="<?= ($a['status'] ?? '') === 'SCHEDULED' ? '' : 'hidden' ?> px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50">
            <select name="status" id="statusSel" class="px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand/50">
                <option value="DRAFT" <?= ($a['status'] ?? 'DRAFT') === 'DRAFT' ? 'selected' : '' ?>>Simpan sebagai Draf</option>
                <option value="PUBLISHED" <?= ($a['status'] ?? '') === 'PUBLISHED' ? 'selected' : '' ?>>Terbitkan sekarang</option>
                <option value="SCHEDULED" <?= ($a['status'] ?? '') === 'SCHEDULED' ? 'selected' : '' ?>>Jadwalkan</option>
            </select>
            <button type="submit" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand text-white text-sm font-semibold shadow-sm shadow-brand/30 hover:opacity-90 transition">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>
                Simpan
            </button>
        </div>
    </div>
</div>

<?php if ($error): ?><div class="mb-4 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm"><?= h($error) ?></div><?php endif; ?>

<div class="grid lg:grid-cols-3 gap-6 items-start">
    <!-- Kolom utama: judul + editor -->
    <div class="lg:col-span-2 space-y-6">
        <div class="bg-white rounded-3xl border border-slate-200 p-6">
            <input type="text" name="title" id="title" required value="<?= $v('title') ?>" placeholder="Judul artikel yang menarik..."
                   class="w-full text-3xl font-extrabold text-slate-900 placeholder:text-slate-300 focus:outline-none leading-tight">
            <div class="mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5 text-sm text-slate-400">
                <svg class="w-4 h-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
                <span class="text-slate-400 shrink-0">URL: /artikel/</span>
                <input type="text" name="slug" id="slug" value="<?= $v('slug') ?>" placeholder="otomatis-dari-judul"
                       class="flex-1 bg-transparent focus:outline-none text-slate-600 min-w-0">
            </div>
        </div>

        <div class="bg-white rounded-3xl border border-slate-200 p-6">
            <div class="flex items-center justify-between mb-3 gap-2 flex-wrap">
                <h3 class="font-bold text-slate-900">Isi Artikel</h3>
                <span class="text-xs text-slate-400">Format teks, gambar & video lewat toolbar</span>
            </div>
            <div id="editor"></div>
            <textarea name="content" id="content" class="hidden"><?= $v('content') ?></textarea>
        </div>
    </div>

    <!-- Sidebar: cover + SEO + ringkasan -->
    <div class="space-y-6">
        <!-- Cover -->
        <div class="bg-white rounded-3xl border border-slate-200 p-6">
            <h3 class="font-bold text-slate-900">Gambar Cover</h3>
            <p class="text-xs text-slate-400 mb-3">Rasio 16:9 — tampil di kartu & atas artikel.</p>
            <label for="cover" class="block cursor-pointer group">
                <div id="coverPreview" class="aspect-[16/9] rounded-2xl bg-slate-100 overflow-hidden grid place-items-center text-slate-400 group-hover:bg-slate-200 transition <?= empty($a['cover_url']) ? 'border-2 border-dashed border-slate-200 group-hover:border-brand/40' : '' ?>">
                    <?php if (!empty($a['cover_url'])): ?>
                        <img src="<?= h($a['cover_url']) ?>" class="w-full h-full object-cover">
                    <?php else: ?>
                        <div class="text-center">
                            <svg class="w-9 h-9 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.4"><path stroke-linecap="round" stroke-linejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                            <span class="text-xs font-medium">Klik untuk unggah cover</span>
                        </div>
                    <?php endif; ?>
                </div>
            </label>
            <input type="file" name="cover" id="cover" accept="image/*" class="hidden">
            <div class="mt-3 flex items-center justify-between">
                <label for="cover" class="text-sm font-semibold text-brand cursor-pointer hover:underline">Pilih / ganti gambar</label>
                <?php if (!empty($a['cover_url'])): ?>
                    <label class="flex items-center gap-1.5 text-xs text-rose-500 cursor-pointer"><input type="checkbox" name="remove_cover" value="1" class="accent-rose-500"> Hapus</label>
                <?php endif; ?>
            </div>
        </div>

        <!-- SEO -->
        <div class="bg-white rounded-3xl border border-slate-200 p-6">
            <div class="flex items-center gap-4 mb-5">
                <div class="relative w-16 h-16 shrink-0">
                    <svg viewBox="0 0 36 36" class="w-16 h-16 -rotate-90">
                        <circle cx="18" cy="18" r="15.915" fill="none" stroke="#f1f5f9" stroke-width="3.5"/>
                        <circle id="seoRing" cx="18" cy="18" r="15.915" fill="none" stroke="#f43f5e" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="0 100" style="transition:stroke-dasharray .4s, stroke .4s"/>
                    </svg>
                    <div class="absolute inset-0 grid place-items-center">
                        <span id="seoScoreNum" class="text-lg font-extrabold text-rose-500">0</span>
                    </div>
                </div>
                <div class="min-w-0">
                    <h3 class="font-bold text-slate-900">Analisis SEO</h3>
                    <p id="seoLabel" class="text-xs font-semibold text-rose-500">Perlu perbaikan</p>
                    <p class="text-xs text-slate-400"><span id="seoPassed">0</span> dari <span id="seoTotal">0</span> kriteria terpenuhi</p>
                </div>
            </div>
            <input type="hidden" name="seo_score" id="seo_score" value="<?= (int)($a['seo_score'] ?? 0) ?>">

            <div class="space-y-3">
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-1.5">Kata kunci fokus</label>
                    <input type="text" name="seo_keyword" id="seo_keyword" value="<?= $v('seo_keyword') ?>" placeholder="mis. sablon kaos jogja"
                           class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50">
                </div>
                <div>
                    <label class="block text-sm font-semibold text-slate-700 mb-1.5">Meta title <span class="text-slate-400 font-normal">(opsional)</span></label>
                    <input type="text" name="meta_title" id="meta_title" value="<?= $v('meta_title') ?>" placeholder="Default: judul artikel"
                           class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50">
                </div>
                <div>
                    <div class="flex items-center justify-between mb-1.5">
                        <label class="text-sm font-semibold text-slate-700">Meta description</label>
                        <span class="text-xs text-slate-400"><span id="metaLen">0</span>/160</span>
                    </div>
                    <textarea name="meta_description" id="meta_description" rows="3" placeholder="Ringkasan 120-160 karakter untuk hasil pencarian Google"
                              class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"><?= $v('meta_description') ?></textarea>
                </div>
            </div>

            <!-- Google preview -->
            <div class="rounded-xl bg-slate-50 border border-slate-100 p-3 mt-4">
                <p class="text-[11px] font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Pratinjau Google</p>
                <p id="gTitle" class="text-[#1a0dab] text-sm font-medium leading-snug truncate">Judul artikel</p>
                <p id="gUrl" class="text-[#006621] text-xs truncate">.../artikel/slug</p>
                <p id="gDesc" class="text-[#545454] text-xs leading-snug line-clamp-2">Meta description akan tampil di sini...</p>
            </div>

            <div class="mt-4 pt-4 border-t border-slate-100">
                <p class="text-xs font-semibold text-slate-500 mb-2">Checklist</p>
                <ul id="seoChecks" class="space-y-1.5 text-xs"></ul>
            </div>
        </div>

        <!-- Ringkasan kartu -->
        <div class="bg-white rounded-3xl border border-slate-200 p-6">
            <h3 class="font-bold text-slate-900">Ringkasan kartu <span class="text-slate-400 text-sm font-normal">(opsional)</span></h3>
            <p class="text-xs text-slate-400 mb-3">Teks singkat di kartu daftar artikel. Kosongkan untuk ambil otomatis dari isi.</p>
            <textarea name="excerpt" rows="3" placeholder="Tulis ringkasan menarik..." class="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand/50"><?= $v('excerpt') ?></textarea>
        </div>
    </div>
</div>
</form>

<script src="https://cdn.jsdelivr.net/npm/quill@2.0.2/dist/quill.js"></script>
<script>
// ── Editor Quill ─────────────────────────────────────────────────────────────
// Pakai inline-style attributor agar format (align/size/font/indent) tetap
// tampil benar di halaman publik tanpa CSS Quill.
const AlignStyle = Quill.import('attributors/style/align');
const DirStyle   = Quill.import('attributors/style/direction');
const SizeStyle  = Quill.import('attributors/style/size');
const FontStyle  = Quill.import('attributors/style/font');
SizeStyle.whitelist = ['12px', '14px', '16px', '18px', '24px', '32px'];
FontStyle.whitelist = ['', 'serif', 'monospace'];
Quill.register(AlignStyle, true);
Quill.register(DirStyle, true);
Quill.register(SizeStyle, true);
Quill.register(FontStyle, true);

// Gambar yang menyimpan atribut width/height/style (untuk resize)
const BaseImage = Quill.import('formats/image');
const IMG_ATTRS = ['alt', 'height', 'width', 'style'];
class StyledImage extends BaseImage {
    static formats(domNode) {
        return IMG_ATTRS.reduce((f, a) => { if (domNode.hasAttribute(a)) f[a] = domNode.getAttribute(a); return f; }, {});
    }
    format(name, value) {
        if (IMG_ATTRS.indexOf(name) > -1) {
            if (value) this.domNode.setAttribute(name, value); else this.domNode.removeAttribute(name);
        } else { super.format(name, value); }
    }
}
Quill.register(StyledImage, true);

const quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Tulis isi artikel di sini...',
    modules: {
        toolbar: {
            container: [
                [{ header: [1, 2, 3, 4, 5, 6, false] }],
                [{ font: FontStyle.whitelist }, { size: SizeStyle.whitelist }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ color: [] }, { background: [] }],
                [{ script: 'sub' }, { script: 'super' }],
                ['blockquote', 'code-block'],
                [{ list: 'ordered' }, { list: 'bullet' }, { list: 'check' }],
                [{ indent: '-1' }, { indent: '+1' }],
                [{ align: [] }],
                ['link', 'image', 'video'],
                ['clean'],
            ],
            handlers: { image: imageHandler },
        },
    },
});
// muat konten lama
const initial = document.getElementById('content').value;
if (initial) quill.clipboard.dangerouslyPasteHTML(initial);

// ── Resize gambar: klik gambar → handle sudut → tarik untuk ubah ukuran ──────
(function () {
    const root = quill.root; // .ql-editor
    let box = null, target = null, startX = 0, startW = 0;

    function clear() {
        if (box) { box.remove(); box = null; }
        target = null;
        window.removeEventListener('scroll', place, true);
        window.removeEventListener('resize', place);
    }
    function place() {
        if (!box || !target) return;
        const r = target.getBoundingClientRect();
        box.style.left = (window.scrollX + r.left) + 'px';
        box.style.top = (window.scrollY + r.top) + 'px';
        box.style.width = r.width + 'px';
        box.style.height = r.height + 'px';
    }
    function select(img) {
        clear();
        target = img;
        box = document.createElement('div');
        box.className = 'img-resizer';
        ['nw', 'ne', 'sw', 'se'].forEach(p => {
            const hd = document.createElement('span');
            hd.className = 'img-resizer-handle ' + p;
            hd.addEventListener('mousedown', start);
            box.appendChild(hd);
        });
        document.body.appendChild(box);
        place();
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
    }
    function start(e) {
        e.preventDefault(); e.stopPropagation();
        startX = e.clientX;
        startW = target.getBoundingClientRect().width;
        const move = (ev) => {
            const w = Math.round(Math.max(40, Math.min(root.clientWidth, startW + (ev.clientX - startX))));
            target.setAttribute('width', w);
            target.style.width = w + 'px';
            place();
        };
        const up = () => {
            document.removeEventListener('mousemove', move);
            document.removeEventListener('mouseup', up);
            quill.update('user'); // simpan ukuran ke model Quill
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
    }
    root.addEventListener('click', (e) => {
        if (e.target && e.target.tagName === 'IMG') { e.stopPropagation(); select(e.target); }
    });
    document.addEventListener('mousedown', (e) => {
        if (!box) return;
        if (e.target.tagName === 'IMG' || box.contains(e.target)) return;
        clear();
    });
    quill.on('text-change', () => { if (box) place(); });
})();

function imageHandler() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*';
    input.onchange = async () => {
        const file = input.files[0]; if (!file) return;
        const fd = new FormData(); fd.append('image', file);
        try {
            const res = await fetch('upload.php', { method: 'POST', body: fd });
            const data = await res.json();
            if (data.url) {
                const range = quill.getSelection(true);
                quill.insertEmbed(range.index, 'image', data.url);
                quill.setSelection(range.index + 1);
            } else { alert('Gagal upload gambar.'); }
        } catch (e) { alert('Gagal upload gambar.'); }
    };
    input.click();
}

// ── Cover preview ────────────────────────────────────────────────────────────
document.getElementById('cover').addEventListener('change', function () {
    const f = this.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    const cp = document.getElementById('coverPreview');
    cp.className = 'aspect-[16/9] rounded-2xl bg-slate-100 overflow-hidden grid place-items-center';
    cp.innerHTML = '<img src="' + url + '" class="w-full h-full object-cover">';
    runSeo();
});

// ── Slug otomatis dari judul ─────────────────────────────────────────────────
const slugEl = document.getElementById('slug');
let slugTouched = slugEl.value !== '';
slugEl.addEventListener('input', () => slugTouched = true);
function slugify(s) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''); }
document.getElementById('title').addEventListener('input', function () {
    if (!slugTouched) slugEl.value = slugify(this.value);
    runSeo();
});

// ── Analisis SEO (live) ──────────────────────────────────────────────────────
function runSeo() {
    const title   = document.getElementById('title').value.trim();
    const metaT   = document.getElementById('meta_title').value.trim() || title;
    const metaD   = document.getElementById('meta_description').value.trim();
    const kw      = document.getElementById('seo_keyword').value.trim().toLowerCase();
    const slug    = slugEl.value.toLowerCase();
    const text    = quill.getText().trim();
    const html    = quill.root.innerHTML;
    const words    = text ? text.split(/\s+/).length : 0;
    const hasCover = !!document.querySelector('#coverPreview img');
    const hasInimg = /<img/i.test(html);
    const lc       = (title + ' ' + text).toLowerCase();

    const checks = [];
    const add = (ok, label, pts) => checks.push({ ok, label, pts });

    if (kw) {
        add(title.toLowerCase().includes(kw), 'Kata kunci ada di judul', 15);
        add(text.toLowerCase().includes(kw), 'Kata kunci ada di isi', 10);
        add(slug.includes(kw.replace(/\s+/g, '-')) || slug.includes(kw.replace(/\s+/g, '')), 'Kata kunci ada di slug/URL', 10);
        add(metaD.toLowerCase().includes(kw), 'Kata kunci ada di meta description', 10);
    } else {
        add(false, 'Isi kata kunci fokus dulu', 0);
    }
    add(title.length >= 40 && title.length <= 60, 'Panjang judul ideal (40-60 huruf: ' + title.length + ')', 15);
    add(metaD.length >= 120 && metaD.length <= 160, 'Meta description 120-160 huruf (' + metaD.length + ')', 15);
    add(words >= 300, 'Isi minimal 300 kata (' + words + ')', 15);
    add(hasCover, 'Punya gambar cover', 5);
    add(hasInimg, 'Ada gambar di dalam isi', 5);

    let score = 0; checks.forEach(c => { if (c.ok) score += c.pts; });
    score = Math.min(100, score);

    const passed = checks.filter(c => c.ok).length;
    document.getElementById('seoScoreNum').textContent = score;
    document.getElementById('seo_score').value = score;
    document.getElementById('seoPassed').textContent = passed;
    document.getElementById('seoTotal').textContent = checks.length;

    let ringColor, txtColor, txt;
    if (score >= 80)      { ringColor = '#10b981'; txtColor = 'text-emerald-600'; txt = 'Bagus, siap tayang'; }
    else if (score >= 50) { ringColor = '#f59e0b'; txtColor = 'text-amber-600';   txt = 'Cukup, bisa lebih baik'; }
    else                  { ringColor = '#f43f5e'; txtColor = 'text-rose-500';    txt = 'Perlu perbaikan'; }

    const ring = document.getElementById('seoRing');
    ring.setAttribute('stroke-dasharray', score + ' 100');
    ring.setAttribute('stroke', ringColor);
    const lbl = document.getElementById('seoLabel');
    lbl.textContent = txt;
    lbl.className = 'text-xs font-semibold ' + txtColor;
    document.getElementById('seoScoreNum').className = 'text-lg font-extrabold ' + txtColor;

    // Checklist
    document.getElementById('seoChecks').innerHTML = checks.map(c =>
        '<li class="flex items-start gap-2 ' + (c.ok ? 'text-slate-600' : 'text-slate-400') + '">' +
        (c.ok
            ? '<svg class="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>'
            : '<svg class="w-4 h-4 text-slate-300 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>') +
        '<span>' + c.label + '</span></li>'
    ).join('');

    // Google preview + meta counter
    document.getElementById('gTitle').textContent = metaT || 'Judul artikel';
    document.getElementById('gUrl').textContent = '.../artikel/' + (slug || 'slug');
    document.getElementById('gDesc').textContent = metaD || 'Meta description akan tampil di sini...';
    document.getElementById('metaLen').textContent = metaD.length;
}

['seo_keyword', 'meta_title', 'meta_description'].forEach(id =>
    document.getElementById(id).addEventListener('input', runSeo));
slugEl.addEventListener('input', runSeo);
quill.on('text-change', runSeo);

// ── Jadwal tayang: tampilkan input waktu saat status "Terjadwal" ─────────────
const statusSel = document.getElementById('statusSel');
const schedInput = document.getElementById('scheduled_at');
function toggleSched() {
    const on = statusSel.value === 'SCHEDULED';
    schedInput.classList.toggle('hidden', !on);
    if (on && !schedInput.value) {
        const t = new Date(Date.now() + 3600000); // default +1 jam
        t.setMinutes(t.getMinutes() - t.getTimezoneOffset());
        schedInput.value = t.toISOString().slice(0, 16);
    }
}
statusSel.addEventListener('change', toggleSched);

// ── Submit: salin konten editor ke textarea + validasi jadwal ────────────────
document.getElementById('artForm').addEventListener('submit', function (e) {
    document.getElementById('content').value = quill.root.innerHTML;
    if (statusSel.value === 'SCHEDULED' && !schedInput.value) {
        e.preventDefault();
        alert('Pilih waktu tayang untuk artikel terjadwal.');
    }
});

runSeo();
</script>

<?php include __DIR__ . '/admin_footer.php'; ?>
