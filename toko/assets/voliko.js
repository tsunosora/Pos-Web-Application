/* Voliko storefront interactions — PRD §5 & §7.
   Semua fitur degrade dengan aman: tanpa CDN/JS, konten tetap tampil. */
(function () {
    'use strict';
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Navbar shrink saat scroll > 40px (§5.1) ─────────────────────
    var nav = document.querySelector('.nav-glass');
    if (nav) {
        var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 40); };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    // ── Hero Swiper (§5.2): autoplay 6s, pause on hover, swipe ──────
    document.querySelectorAll('[data-hero-swiper]').forEach(function (el) {
        if (typeof Swiper === 'undefined') return;
        var slides = el.querySelectorAll('.swiper-slide').length;
        new Swiper(el, {
            loop: slides > 1,
            speed: 650,
            effect: 'slide',
            slidesPerView: 1,
            autoHeight: false,
            autoplay: slides > 1 && !reduced ? { delay: 6000, pauseOnMouseEnter: true, disableOnInteraction: false } : false,
            pagination: { el: el.querySelector('.swiper-pagination'), clickable: true },
            navigation: { nextEl: el.querySelector('.hero2-next'), prevEl: el.querySelector('.hero2-prev') },
        });
    });

    // ── Parallax mouse untuk objek float (max 20px, lerp .05) ───────
    (function () {
        if (reduced) return;
        var zones = document.querySelectorAll('[data-parallax-zone]');
        if (!zones.length) return;
        var tx = 0, ty = 0, cx = 0, cy = 0, raf = null;
        function tick() {
            cx += (tx - cx) * 0.05;
            cy += (ty - cy) * 0.05;
            zones.forEach(function (z) {
                z.querySelectorAll('.float-wrap').forEach(function (w, i) {
                    var depth = 0.4 + (i % 3) * 0.3; // tiap objek beda kedalaman
                    w.style.transform = 'translate(' + (cx * depth) + 'px,' + (cy * depth) + 'px)';
                });
            });
            raf = requestAnimationFrame(tick);
        }
        window.addEventListener('mousemove', function (e) {
            tx = (e.clientX / window.innerWidth - 0.5) * 40;  // -20..20px
            ty = (e.clientY / window.innerHeight - 0.5) * 40;
            if (!raf) raf = requestAnimationFrame(tick);
        }, { passive: true });
    })();

    // ── Count-up statistik (angka di-parse dari teks, mis. "1.600+") ─
    function countUp(el) {
        var raw = el.getAttribute('data-count') || el.textContent;
        // Lewati angka desimal (mis. "4.9/5") — titik desimal diikuti 1-2 digit;
        // titik ribuan Indonesia selalu diikuti tepat 3 digit ("1.600+").
        if (/[.,]\d{1,2}(\D|$)/.test(raw)) return;
        var m = raw.replace(/\./g, '').match(/^(\D*)(\d+)(.*)$/);
        if (!m) return;
        var target = parseInt(m[2], 10), pre = m[1], post = m[3];
        if (!target || reduced) return;
        var t0 = null, dur = 1400;
        function fmt(n) { return n.toLocaleString('id-ID'); }
        function step(ts) {
            if (!t0) t0 = ts;
            var p = Math.min((ts - t0) / dur, 1);
            var eased = 1 - Math.pow(1 - p, 3);
            el.textContent = pre + fmt(Math.round(target * eased)) + post;
            if (p < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }
    if ('IntersectionObserver' in window) {
        var seen = new WeakSet();
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting && !seen.has(en.target)) { seen.add(en.target); countUp(en.target); }
            });
        }, { threshold: 0.4 });
        document.querySelectorAll('[data-count]').forEach(function (el) { io.observe(el); });
    }

    // ── Scroll reveal (fade-up 24px + stagger) ──────────────────────
    // IntersectionObserver + CSS, BUKAN GSAP: tahan terhadap layout shift
    // gambar lazy & restorasi posisi scroll saat refresh/anchor jump.
    // Konten tidak pernah disembunyikan tanpa JS; safety net 3 dtk
    // memaksa tampil apa pun yang terlewat.
    (function () {
        var els = [];
        document.querySelectorAll('[data-reveal]').forEach(function (sec) {
            var items = sec.querySelectorAll('[data-reveal-item]');
            (items.length ? items : [sec]).forEach(function (t, i) {
                t.style.transitionDelay = Math.min(i * 80, 480) + 'ms';
                t.classList.add('rv');
                els.push(t);
            });
        });
        if (!els.length) return;
        function showAll() { els.forEach(function (t) { t.classList.add('rv-in'); }); }
        if (reduced || !('IntersectionObserver' in window)) { showAll(); return; }
        var io = new IntersectionObserver(function (ents) {
            ents.forEach(function (en) {
                if (en.isIntersecting) { en.target.classList.add('rv-in'); io.unobserve(en.target); }
            });
        }, { rootMargin: '0px 0px -8% 0px' });
        els.forEach(function (t) { io.observe(t); });
        setTimeout(showAll, 3000);
    })();

    // ── Modal video YouTube (§5.4) — lazy: iframe dibuat saat play ──
    document.querySelectorAll('[data-video-open]').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var id = btn.getAttribute('data-video-open');
            var modal = document.getElementById('vmodal');
            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'vmodal';
                modal.className = 'fixed inset-0 z-[80] hidden items-center justify-center bg-slate-950/90 p-4';
                modal.innerHTML = '<button type="button" data-video-close class="absolute top-4 right-4 h-10 w-10 grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Tutup">&#10005;</button><div class="w-full max-w-3xl aspect-video rounded-2xl overflow-hidden shadow-2xl" data-video-body></div>';
                document.body.appendChild(modal);
                modal.addEventListener('click', function (e) { if (e.target === modal) closeV(); });
                modal.querySelector('[data-video-close]').addEventListener('click', closeV);
                document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeV(); });
            }
            function closeV() {
                modal.classList.add('hidden'); modal.classList.remove('flex');
                modal.querySelector('[data-video-body]').innerHTML = '';
                document.body.style.overflow = '';
            }
            modal.querySelector('[data-video-body]').innerHTML =
                '<iframe class="w-full h-full" src="https://www.youtube-nocookie.com/embed/' + id +
                '?autoplay=1&rel=0" title="Video profil" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>';
            modal.classList.remove('hidden'); modal.classList.add('flex');
            document.body.style.overflow = 'hidden';
        });
    });
})();
