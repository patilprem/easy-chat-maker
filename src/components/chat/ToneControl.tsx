import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Drama } from 'lucide-react';
import { TONES, toneById, type Tone } from '../../lib/story/tones';

/**
 * Story-mode "voice tone" control for one message: a 🎭 button that goes
 * in a bubble's hover action strip (next to 😊 and ⋮) and opens a row of
 * tone chips. Editor-only — the platform previews only render it when the
 * story editor passes `onSetTone`, so /editor and the export capture never
 * see it. The parent owns the `open` state so its strip stays visible
 * while the picker is up, exactly like its reaction picker.
 */

interface ToneButtonProps {
  msgId: string;
  value: Tone | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetTone: (id: string, tone: Tone | null) => void;
  isDark: boolean;
  isSelf: boolean;
  className: string;
}

function getPickerStyle(anchor: DOMRect, isSelf: boolean): React.CSSProperties {
  const width = 236;
  const height = 40;
  const gap = 6;
  const preferredLeft = isSelf ? anchor.right - width : anchor.left;
  const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - width - 8));
  const top = anchor.top - height - gap >= 8 ? anchor.top - height - gap : anchor.bottom + gap;
  return { position: 'fixed', top, left, width, zIndex: 9999 };
}

export const ToneButton: React.FC<ToneButtonProps> = ({ msgId, value, open, onOpenChange, onSetTone, isDark, isSelf, className }) => {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<DOMRect | null>(null);
  const current = toneById(value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (pickerRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      onOpenChange(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open, onOpenChange]);

  return (
    <>
      <button
        ref={buttonRef}
        onClick={() => {
          const next = !open;
          setAnchor(next ? buttonRef.current?.getBoundingClientRect() ?? null : null);
          onOpenChange(next);
        }}
        className={className}
        title="Voice tone"
        aria-label="Voice tone"
      >
        {current ? <span className="text-[14px] leading-none">{current.emoji}</span> : <Drama size={15} />}
      </button>
      {open && anchor && typeof document !== 'undefined' && createPortal(
        <div
          ref={pickerRef}
          style={getPickerStyle(anchor, isSelf)}
          className={`flex items-center justify-between gap-0.5 rounded-full border px-1.5 py-1 shadow-[0_8px_28px_rgba(0,0,0,0.28)] ${
            isDark ? 'border-white/10 bg-[#233138]' : 'border-black/10 bg-white'
          }`}
        >
          {TONES.map((t) => (
            <button
              key={t.id}
              onClick={() => { onSetTone(msgId, value === t.id ? null : t.id); onOpenChange(false); }}
              className={`flex h-7 w-7 items-center justify-center rounded-full text-[16px] transition-transform hover:scale-125 ${
                value === t.id ? (isDark ? 'bg-white/20' : 'bg-black/10') : ''
              }`}
              title={`${t.label} voice`}
              aria-label={`${t.label} voice`}
              aria-pressed={value === t.id}
            >
              {t.emoji}
            </button>
          ))}
          <button
            onClick={() => { onSetTone(msgId, null); onOpenChange(false); }}
            className={`ml-0.5 h-6 rounded-full px-1.5 text-[10px] font-semibold ${isDark ? 'text-white/60 hover:bg-white/10' : 'text-black/50 hover:bg-black/5'}`}
            title="No tone"
          >
            None
          </button>
        </div>,
        document.body
      )}
    </>
  );
};

/** Small editor-only corner badge showing a message's tone. */
export const ToneBadge: React.FC<{ tone: Tone | undefined; isSelf: boolean; isDark: boolean }> = ({ tone, isSelf, isDark }) => {
  const spec = toneById(tone);
  if (!spec) return null;
  return (
    <span
      className={`tone-badge pointer-events-none absolute -top-2 ${isSelf ? '-left-1.5' : '-right-1.5'} z-20 flex h-[18px] w-[18px] items-center justify-center rounded-full border text-[11px] leading-none shadow-sm ${
        isDark ? 'border-black/40 bg-[#1f2c34]' : 'border-white bg-white'
      }`}
      title={`${spec.label} voice`}
    >
      {spec.emoji}
    </span>
  );
};
