'use client';

import { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
    value: number; // 0..5
    onChange?: (v: number) => void;
    readOnly?: boolean;
    size?: number; // px
    className?: string;
}

/** Bintang 1–5 reusable. Interaktif (onChange) atau readOnly untuk menampilkan rata-rata. */
export function StarRating({ value, onChange, readOnly = false, size = 40, className = '' }: StarRatingProps) {
    const [hover, setHover] = useState(0);
    const active = hover || value;

    return (
        <div className={`inline-flex items-center gap-1 ${className}`} role={readOnly ? undefined : 'radiogroup'}>
            {[1, 2, 3, 4, 5].map((n) => {
                const filled = n <= active;
                return (
                    <button
                        key={n}
                        type="button"
                        disabled={readOnly}
                        aria-label={`${n} bintang`}
                        onMouseEnter={() => !readOnly && setHover(n)}
                        onMouseLeave={() => !readOnly && setHover(0)}
                        onClick={() => !readOnly && onChange?.(n)}
                        className={readOnly ? 'cursor-default' : 'cursor-pointer transition-transform hover:scale-110'}
                    >
                        <Star
                            style={{ width: size, height: size }}
                            className={filled ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-muted-foreground/40'}
                        />
                    </button>
                );
            })}
        </div>
    );
}

export default StarRating;
