/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:        'var(--bg)',
        'bg-panel':'var(--bg-panel)',
        'bg-elev': 'var(--bg-elev)',
        'bg-deep': 'var(--bg-deep)',
        border:    'var(--border)',
        text:      'var(--text)',
        'text-mut':'var(--text-muted)',
        'text-dim':'var(--text-dim)',
        accent:    'var(--accent)',
        'accent-h':'var(--accent-hover)',
        'accent-sm':'var(--accent-soft)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        'panel': '0 4px 20px -4px rgba(0,0,0,0.25)',
        'glow':  '0 0 20px var(--accent-soft)',
        'glow-strong': '0 0 32px var(--accent), 0 0 60px var(--accent-soft)',
      },
      animation: {
        'fade-in':    'fade-in 0.3s ease-out both',
        'slide-up':   'slide-up 0.35s cubic-bezier(0.16,1,0.3,1) both',
        'flash':      'flash 0.5s ease-out',
      },
      keyframes: {
        'fade-in':  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        'slide-up': { '0%': { transform: 'translateY(20px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        'flash':    { '0%': { backgroundColor: 'var(--accent-soft)' }, '100%': { backgroundColor: 'transparent' } },
      },
    },
  },
  plugins: [],
};
