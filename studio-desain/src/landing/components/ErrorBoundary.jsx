import { Component } from 'react';

/**
 * Cegah BLANK PAGE: kalau ada section landing yang error saat render atau
 * lazy chunk-nya gagal di-load (mis. hash lama 404 setelah deploy), tampilkan
 * fallback + tombol reload — bukan layar putih kosong.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[Landing ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div
          style={{
            minHeight: '220px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '14px',
            padding: '40px 20px',
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#9aa0a6', fontSize: '13px', margin: 0 }}>
            Ada bagian yang gagal dimuat.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#fff',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '8px',
              padding: '8px 18px',
              cursor: 'pointer',
            }}
          >
            Muat ulang
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
