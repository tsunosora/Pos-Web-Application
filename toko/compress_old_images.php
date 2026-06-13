<?php
// Script sekali-jalan: kompres semua gambar lama di toko/uploads/.
// Jalankan dari CLI:  php compress_old_images.php
// (boleh diulang kapan saja — file yang sudah kecil otomatis dilewati)
if (PHP_SAPI !== 'cli') { http_response_code(403); exit("CLI only\n"); }
require_once __DIR__ . '/db.php';

$dir = uploads_dir();
$mimeMap = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
$totBefore = $totAfter = $count = $skip = 0;

foreach (scandir($dir) as $f) {
    $path = $dir . '/' . $f;
    if (!is_file($path)) continue;
    $before = filesize($path);
    if ($before < 200 * 1024) { $skip++; continue; }          // sudah kecil
    $info = @getimagesize($path);
    if (!$info || !isset($mimeMap[$info[2]])) { $skip++; continue; } // bukan raster yang didukung (SVG/GIF dll)
    compress_uploaded_image($path, $mimeMap[$info[2]]);
    clearstatcache(true, $path);
    $after = filesize($path);
    $count++; $totBefore += $before; $totAfter += $after;
    printf("%-40s %8.2f MB -> %7.2f MB%s\n", $f, $before / 1e6, $after / 1e6, $after < $before ? '' : '  (tetap)');
}
printf("\n%d file dikompres, %d dilewati. Total %.1f MB -> %.1f MB (hemat %.1f MB)\n",
    $count, $skip, $totBefore / 1e6, $totAfter / 1e6, ($totBefore - $totAfter) / 1e6);
