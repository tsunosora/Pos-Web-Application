import { useEffect, Suspense } from 'react';
import lazyWithRetry from '../lazyWithRetry.js';

// EAGER imports — above-the-fold critical (load with main bundle)
import LandingNav  from './sections/LandingNav.jsx';
import Hero        from './sections/Hero.jsx';
import TopShowcase from './sections/TopShowcase.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// LAZY imports — below-the-fold sections (code-split, load on demand).
// Halaman load dari ATAS dulu (Hero cepat tampil), section bawah menyusul.
// lazyWithRetry: kalau chunk gagal (deploy baru → hash lama 404), auto-reload
// sekali — bukan section blank.
const MarqueeLogos     = lazyWithRetry(() => import('./sections/MarqueeLogos.jsx'), 'mq');
const ProblemBlock     = lazyWithRetry(() => import('./sections/ProblemBlock.jsx'), 'pb');
const SolutionIntro    = lazyWithRetry(() => import('./sections/SolutionIntro.jsx'), 'si');
const DesignMarquee    = lazyWithRetry(() => import('./sections/DesignMarquee.jsx'), 'dm');
const ModeShowcase     = lazyWithRetry(() => import('./sections/ModeShowcase.jsx'), 'ms');
const GridFeedShowcase = lazyWithRetry(() => import('./sections/GridFeedShowcase.jsx'), 'gf');
const CarouselShowcase = lazyWithRetry(() => import('./sections/CarouselShowcase.jsx'), 'cs');
const FaceCardShowcase = lazyWithRetry(() => import('./sections/FaceCardShowcase.jsx'), 'fc');
const MenuFBShowcase   = lazyWithRetry(() => import('./sections/MenuFBShowcase.jsx'), 'mf');
const AffiliateShowcase = lazyWithRetry(() => import('./sections/AffiliateShowcase.jsx'), 'as');
const HowItWorks       = lazyWithRetry(() => import('./sections/HowItWorks.jsx'), 'hw');
const WhyDifferent     = lazyWithRetry(() => import('./sections/WhyDifferent.jsx'), 'wd');
const AudienceCards    = lazyWithRetry(() => import('./sections/AudienceCards.jsx'), 'ac');
const Comparison       = lazyWithRetry(() => import('./sections/Comparison.jsx'), 'cp');
const Testimonials     = lazyWithRetry(() => import('./sections/Testimonials.jsx'), 'ts');
const BottomShowcase   = lazyWithRetry(() => import('./sections/BottomShowcase.jsx'), 'bs');
const Faq              = lazyWithRetry(() => import('./sections/Faq.jsx'), 'fq');
const Pricing          = lazyWithRetry(() => import('./sections/Pricing.jsx'), 'pr');
const FinalCta         = lazyWithRetry(() => import('./sections/FinalCta.jsx'), 'fcta');
const LandingFooter    = lazyWithRetry(() => import('./sections/LandingFooter.jsx'), 'ft');
const MayarNotification = lazyWithRetry(() => import('./components/MayarNotification.jsx'), 'mn');

// Minimal placeholder — just reserves vertical space so layout doesn't jump
function SectionPlaceholder() {
  return <div style={{ minHeight: '200px' }} />;
}

// Per-section: kalau 1 section gagal render / chunk-nya gagal load,
// section itu jadi gap kosong — halaman lain tetap hidup (bukan blank total).
function SafeSection({ children }) {
  return (
    <ErrorBoundary fallback={<SectionPlaceholder />}>
      <Suspense fallback={<SectionPlaceholder />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function LandingPage() {
  // Landing must always render dark-red regardless of user's studio toggle.
  // ThemeProvider re-applies stored preference asynchronously, so use a
  // MutationObserver to defensively re-assert dark while landing is mounted.
  // On unmount, restore the user's saved preference for the studio.
  useEffect(() => {
    const root = document.documentElement;

    const applyDark = () => {
      if (root.classList.contains('theme-light')) {
        root.classList.remove('theme-light');
      }
      if (!root.classList.contains('theme-dark')) {
        root.classList.add('theme-dark');
      }
    };
    applyDark();
    root.style.scrollBehavior = 'smooth';

    const obs = new MutationObserver(applyDark);
    obs.observe(root, { attributes: true, attributeFilter: ['class'] });

    return () => {
      obs.disconnect();
      root.style.scrollBehavior = '';
      let stored = 'dark';
      try {
        const s = localStorage.getItem('af_theme');
        if (s === 'light' || s === 'dark') stored = s;
      } catch {}
      root.classList.remove('theme-dark', 'theme-light');
      root.classList.add(stored === 'light' ? 'theme-light' : 'theme-dark');
    };
  }, []);

  return (
    <div className="relative min-h-screen bg-bg text-text overflow-x-clip">
      <LandingNav />
      <main>
        {/* Above-the-fold — render immediately */}
        <Hero />
        <TopShowcase />

        {/* Below-the-fold — code-split, stream in as chunks load.
            Each wrapped in SafeSection so one failure can't blank the page. */}
        <SafeSection><MarqueeLogos /></SafeSection>
        <SafeSection><ProblemBlock /></SafeSection>
        <SafeSection><SolutionIntro /></SafeSection>
        <SafeSection><DesignMarquee /></SafeSection>
        <SafeSection><ModeShowcase /></SafeSection>
        <SafeSection><GridFeedShowcase /></SafeSection>
        <SafeSection><CarouselShowcase /></SafeSection>
        <SafeSection><AffiliateShowcase /></SafeSection>
        <SafeSection><FaceCardShowcase /></SafeSection>
        <SafeSection><MenuFBShowcase /></SafeSection>
        <SafeSection><HowItWorks /></SafeSection>
        <SafeSection><WhyDifferent /></SafeSection>
        <SafeSection><AudienceCards /></SafeSection>
        <SafeSection><Comparison /></SafeSection>
        <SafeSection><Testimonials /></SafeSection>
        <SafeSection><BottomShowcase /></SafeSection>
        <SafeSection><Pricing /></SafeSection>
        <SafeSection><Faq /></SafeSection>
        <SafeSection><FinalCta /></SafeSection>
      </main>
      <ErrorBoundary fallback={null}>
        <Suspense fallback={null}>
          <LandingFooter />
          <MayarNotification />
        </Suspense>
      </ErrorBoundary>
    </div>
  );
}
