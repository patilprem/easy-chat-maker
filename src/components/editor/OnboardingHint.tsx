import React, { useCallback, useState } from 'react';
import { Pencil, MoreHorizontal, X } from 'lucide-react';

const STORAGE_KEY = 'ecm:v1:onboardingHintSeen';

interface Props {
  visible: boolean;
}

export const OnboardingHint: React.FC<Props> = ({ visible }) => {
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
      return false;
    }
  });

  const dismiss = useCallback(() => {
    setDismissed(true);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore quota/privacy errors */
    }
  }, []);

  if (dismissed || !visible) return null;

  return (
    <div
      className="absolute left-1/2 top-24 z-50 w-[230px] -translate-x-1/2 rounded-xl border border-white/10 bg-[#0d1424] p-3 text-white shadow-2xl"
      style={{ boxShadow: '0 16px 40px rgba(0,0,0,0.5)' }}
    >
      <div className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-gradient-to-r from-[#00FF87] to-[#60EFFF]" />
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 text-white/40 hover:text-white/80"
      >
        <X size={13} />
      </button>

      <div className="flex items-start gap-2 pr-3">
        <Pencil size={13} className="mt-0.5 flex-shrink-0 text-[#00FF87]" />
        <p className="text-[11.5px] leading-snug text-white/90">Tap any message to edit its text.</p>
      </div>
      <div className="mt-2 flex items-start gap-2 pr-3">
        <MoreHorizontal size={13} className="mt-0.5 flex-shrink-0 text-[#60EFFF]" />
        <p className="text-[11.5px] leading-snug text-white/90">
          Hover a message for more — add photos, replies, dates &amp; more.
        </p>
      </div>

      <button
        onClick={dismiss}
        className="mt-2.5 w-full rounded-full bg-gradient-to-r from-[#00FF87] to-[#60EFFF] py-1.5 text-[11px] font-semibold text-[#061116] hover:brightness-110"
      >
        Got it
      </button>
    </div>
  );
};
