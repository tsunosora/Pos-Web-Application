</main>
<footer class="footer">
    <?= h(settings()['storeName'] ?? 'Toko') ?>
    <?php if (!empty(settings()['storePhone'])): ?> · <?= h(settings()['storePhone']) ?><?php endif; ?>
</footer>
</body>
</html>
