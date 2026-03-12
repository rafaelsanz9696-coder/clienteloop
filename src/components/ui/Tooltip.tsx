/**
 * Tooltip.tsx — Small ? icon with explanatory bubble on hover/click.
 * Uses a portal + fixed positioning so it escapes overflow:hidden parents.
 */

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';

interface TooltipProps {
  text: string;
  className?: string;
}

export default function Tooltip({ text, className }: TooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLButtonElement>(null);

  function updatePos() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({
      top: r.top - 8,           // just above the button
      left: r.left + r.width / 2,
    });
  }

  function show() { updatePos(); setVisible(true); }
  function hide() { setVisible(false); }

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

  const bubble = visible
    ? createPortal(
        <span
          role="tooltip"
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: 'translate(-50%, -100%)',
            zIndex: 9999,
          }}
          className="w-52 rounded-xl bg-slate-900 text-white text-xs leading-relaxed px-3 py-2 shadow-xl pointer-events-none"
        >
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </span>,
        document.body
      )
    : null;

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        ref={ref}
        type="button"
        aria-label="Más información"
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => { e.stopPropagation(); visible ? hide() : show(); }}
        className="w-4 h-4 rounded-full bg-white/30 hover:bg-white/50 text-white text-[10px] font-bold leading-none flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white/60"
      >
        ?
      </button>
      {bubble}
    </span>
  );
}
