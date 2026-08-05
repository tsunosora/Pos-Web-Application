import React from 'react';
import { CONFIG } from '../config.js';

/**
 * Top-level error boundary.
 * Catches uncaught render errors and shows a recovery UI with:
 *   1. Reload page (try again)
 *   2. Clear app data & reload (nukes corrupt localStorage)
 *
 * Without this, ANY uncaught error → entire React tree unmounts → blank white
 * screen → user is stuck and must manually clear browser data.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, info: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ info });
    if (typeof console !== 'undefined') {
      console.error('[ErrorBoundary]', error, info);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearAndReload = () => {
    try {
      // Wipe all Auto Feeds keys (af_* prefix), leave other site data alone
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('af_')) keys.push(k);
      }
      keys.forEach((k) => localStorage.removeItem(k));
    } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error?.message || String(this.state.error);

    return (
      <div style={{
        minHeight: '100vh',
        background: '#0a0405',
        color: '#fafafa',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}>
        <div style={{
          maxWidth: 540,
          width: '100%',
          background: '#1a0a0c',
          border: '1px solid rgba(var(--accent-rgb),0.3)',
          borderRadius: 16,
          padding: 32,
          boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(var(--accent-rgb),0.15)',
        }}>
          <div style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
            borderRadius: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 900, fontSize: 28,
            marginBottom: 20,
            boxShadow: '0 0 24px rgba(var(--accent-rgb),0.55)',
          }}>!</div>

          <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px 0' }}>
            Ada sedikit masalah loading
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: '0 0 20px 0' }}>
            Aplikasi gak bisa render karena data lokal mungkin korup atau format-nya berubah.
            Coba <strong style={{ color: '#fff' }}>Muat Ulang</strong> dulu. Kalau masih error,
            klik <strong style={{ color: '#fff' }}>Hapus Data & Mulai Lagi</strong> untuk reset bersih.
          </p>

          {/* Technical detail (collapsed) */}
          <details style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 24,
          }}>
            <summary style={{
              cursor: 'pointer',
              fontSize: 11,
              color: 'rgba(255,255,255,0.45)',
              fontFamily: 'JetBrains Mono, monospace',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Detail teknis (opsional)
            </summary>
            <pre style={{
              fontSize: 11,
              fontFamily: 'JetBrains Mono, monospace',
              color: 'rgba(255,200,200,0.8)',
              marginTop: 10,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 180,
              overflow: 'auto',
            }}>{msg}</pre>
          </details>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={this.handleReload}
              style={{
                flex: '1 1 200px',
                padding: '12px 20px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
              onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
            >
              ↻ Muat Ulang
            </button>
            <button
              onClick={this.handleClearAndReload}
              style={{
                flex: '1 1 200px',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-deep))',
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(var(--accent-rgb),0.35)',
                transition: 'transform 0.15s ease',
              }}
              onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
            >
              🗑 Hapus Data & Mulai Lagi
            </button>
          </div>

          <p style={{
            marginTop: 16,
            fontSize: 11,
            color: 'rgba(255,255,255,0.35)',
            textAlign: 'center',
            fontFamily: 'JetBrains Mono, monospace',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}>
            {CONFIG.brandName} · Recovery Mode
          </p>
        </div>
      </div>
    );
  }
}
