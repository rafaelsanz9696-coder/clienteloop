/**
 * Tooltip.tsx — Small ? icon with explanatory bubble on hover/click.
 * Designed to sit on colored gradient backgrounds (stat cards).
 */

import { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';

interface TooltipProps {
  text: string;
  className?: string;
}

export default function Tooltip({ text, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  // Close on outside click (mobile tap-away)
  useEffect(() => {
    if (!visible) return;
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setVisible(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [visible]);

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        ref={ref}
        type="button"
        aria-label="Más información"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        onClick={(e) => { e.stopPropagation(); setVisible((v) => !v); }}
        className="w-4 h-4 rounded-full bg-white/30 hover:bg-white/50 text-white text-[10px] font-bold leading-none flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        ?
      </button>

      {visible && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-xl bg-slate-900 text-white text-xs leading-relaxed px-3 py-2 shadow-xl z-50 pointer-events-none"
        >
          {text}
          {/* CSS arrow pointing down */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>
      )}
    </span>
  );
}
