<?php
/**
 * Uji unit murni (tanpa DB) untuk logika INTI anti-timpa SEO Machine:
 *   - seo_normalize_slug()  : normalisasi judul/slug → slug URL-aman
 *   - seo_next_free_slug()  : resolusi bentrok slug → -2/-3/... (kebijakan "new")
 *
 * Jalankan: php toko/api/tests/slug-resolution.test.php
 * Loop ini MERAH bila endpoint melanggar kontrak brief (slug lama tertimpa),
 * HIJAU bila resolusi slug benar. Deterministik, cepat, agent-runnable.
 */
declare(strict_types=1);

// Muat HANYA definisi fungsi dari endpoint (flag test → handler tidak dieksekusi).
putenv('SEO_ENDPOINT_TEST=1');
require __DIR__ . '/../seo-publish.php';

$fail = 0; $pass = 0;
function check(string $name, $got, $want): void {
    global $fail, $pass;
    if ($got === $want) { $pass++; return; }
    $fail++;
    fwrite(STDERR, "FAIL: $name\n  got  = " . var_export($got, true) . "\n  want = " . var_export($want, true) . "\n");
}

/* ---- seo_normalize_slug ---- */
check('normalize spaces+case', seo_normalize_slug('Uji Coba Artikel'), 'uji-coba-artikel');
check('normalize punctuation',  seo_normalize_slug('Halo, Dunia!! (2026)'), 'halo-dunia-2026');
check('normalize trim dashes',  seo_normalize_slug('  --Tepi--  '), 'tepi');
check('normalize already-slug', seo_normalize_slug('sudah-slug'), 'sudah-slug');

/* ---- seo_next_free_slug (INTI anti-timpa) ---- */
$taken = fn(array $set) => fn(string $s) => in_array($s, $set, true);

// slug bebas → dipakai apa adanya (tak ada rename)
check('free slug unchanged', seo_next_free_slug('uji', $taken([])), 'uji');

// slug bentrok → -2 (artikel lama TIDAK tertimpa)
check('collision → -2', seo_next_free_slug('uji', $taken(['uji'])), 'uji-2');

// -2 juga dipakai → -3
check('collision → -3', seo_next_free_slug('uji', $taken(['uji', 'uji-2'])), 'uji-3');

// lompatan berurutan sampai yang bebas
check('collision → -4', seo_next_free_slug('uji', $taken(['uji', 'uji-2', 'uji-3'])), 'uji-4');

/* ---- seo_col_maxlen / seo_fit (anti 1406 "Data too long") ---- */
check('maxlen varchar', seo_col_maxlen('varchar(300)'), 300);
check('maxlen char',    seo_col_maxlen('char(20)'), 20);
check('maxlen text=0',  seo_col_maxlen('mediumtext'), 0);

// nilai lebih panjang dari kolom → dipotong tepat ke lebar kolom
check('fit truncates',  seo_fit(str_repeat('x', 500), 'varchar(300)'), str_repeat('x', 300));
// nilai lebih pendek → utuh
check('fit keeps short', seo_fit('halo', 'varchar(300)'), 'halo');
// kolom TEXT (tanpa batas) → tak dipotong
check('fit text untouched', seo_fit(str_repeat('y', 1000), 'mediumtext'), str_repeat('y', 1000));

echo "\n" . ($fail === 0 ? "OK" : "FAILED") . ": $pass passed, $fail failed\n";
exit($fail === 0 ? 0 : 1);
