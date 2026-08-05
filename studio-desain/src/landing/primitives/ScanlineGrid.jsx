export default function ScanlineGrid({ className = '', fade = true, dots = false }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 ${
        dots ? 'dot-bg' : 'grid-bg'
      } ${fade ? 'grid-bg-fade' : ''} ${className}`}
    />
  );
}
