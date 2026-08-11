<?php
// Script sekali-jalan: kompres semua gambar lama di toko/uploads/ (REKURSIF —
// termasuk subfolder seperti uploads/mirror/ tempat gambar kartu produk).
// Dua cara jalan (boleh diulang — file yang sudah kecil otomatis dilewati):
//   1) CLI:     php compress_old_images.php
//   2) BROWSER (tanpa SSH): LOGIN admin toko dulu, lalu buka URL file ini.
//      Dibatasi per-request agar tak timeout — cukup REFRESH untuk melanjutkan.
require_once __DIR__ . '/lib.php';  // bootstrap toko: config.php (session) + db.php (uploads_dir/compress) + is_admin()

$isCli = PHP_SAPI === 'cli';
if (!$isCli) {
    if (!function_exists('is_admin') || !is_admin()) {
        http_response_code(403);
        header('Content-Type: text/plain; charset=utf-8');
        exit("403 — Login sebagai admin toko dulu, lalu buka URL ini lagi.\n");
    }
    header('Content-Type: text/plain; charset=utf-8');
    @set_time_limit(0);
    @ini_set('max_execution_time', '0');
    @ini_set('memory_limit', '512M');
    while (ob_get_level() > 0) { @ob_end_flush(); }
}
$startTs = time();

$dir = uploads_dir();
$mimeMap = [IMAGETYPE_JPEG => 'image/jpeg', IMAGETYPE_PNG => 'image/png', IMAGETYPE_WEBP => 'image/webp'];
$totBefore = $totAfter = $count = $skip = 0;

$rii = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)
);
foreach ($rii as $fileinfo) {
    if (!$fileinfo->isFile()) continue;
    $path = $fileinfo->getPathname();
    $before = filesize($path);
    if ($before < 200 * 1024) { $skip++; continue; }          // sudah kecil
    $info = @getimagesize($path);
    if (!$info || !isset($mimeMap[$info[2]])) { $skip++; continue; } // bukan raster yang didukung (SVG/GIF dll)
    compress_uploaded_image($path, $mimeMap[$info[2]]);
    clearstatcache(true, $path);
    $after = filesize($path);
    $count++; $totBefore += $before; $totAfter += $after;
    $rel = ltrim(str_replace($dir, '', $path), '/\\');
    printf("%-50s %8.2f MB -> %7.2f MB%s\n", $rel, $before / 1e6, $after / 1e6, $after < $before ? '' : '  (tetap)');
    if (!$isCli) {
        @flush();
        // Berhenti sebelum timeout gateway (Cloudflare/Hostinger ~100s). Idempoten:
        // cukup REFRESH URL untuk melanjutkan file yang belum terkompres.
        if (time() - $startTs > 55) {
            echo "\n… batas waktu per-request tercapai. REFRESH halaman ini untuk melanjutkan (aman diulang).\n";
            break;
        }
    }
}
printf("\n%d file dikompres, %d dilewati. Total %.1f MB -> %.1f MB (hemat %.1f MB)\n",
    $count, $skip, $totBefore / 1e6, $totAfter / 1e6, ($totBefore - $totAfter) / 1e6);
