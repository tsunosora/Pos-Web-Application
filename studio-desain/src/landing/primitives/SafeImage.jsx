import { useState } from 'react';

/**
 * SafeImage — img wrapper with fallback on error.
 * Default lazy-loads, but use `priority={true}` for above-the-fold images
 * (hero, first paint critical) so they don't cause blank top-of-page.
 */
export default function SafeImage({ src, alt = '', className = '', fallback = null, priority = false, ...rest }) {
  const [errored, setErrored] = useState(false);
  if (errored || !src) return fallback;
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchpriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
      onError={() => setErrored(true)}
      {...rest}
    />
  );
}
