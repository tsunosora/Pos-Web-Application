export default function GlowOrb({
  size = 480,
  color = 'rgba(var(--accent-rgb),0.22)',
  className = '',
  drift = true,
  style = {},
}) {
  return (
    <div
      className={`glow-orb ${className}`}
      style={{
        width: size,
        height: size,
        background: color,
        animation: drift ? 'glow-drift 14s ease-in-out infinite' : undefined,
        ...style,
      }}
    />
  );
}
