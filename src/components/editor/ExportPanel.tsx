import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageDown, Clapperboard, Volume2, ChevronDown, Smartphone, ScrollText } from 'lucide-react';
import { useEditorStore } from '../../lib/state/editorStore';
import { exportPng, type PngScope } from '../../lib/export/exportPng';
import { exportMp4, type ProgressState } from '../../lib/export/exportMp4';
import { exportCompositeMp4 } from '../../lib/export/exportComposite';
import { exportStoryMp4 } from '../../lib/export/exportStory';
import { exportPlaywrightVideo, RecorderUnavailableError } from '../../lib/export/exportPlaywrightVideo';
import {
  trackConsentAccepted,
  trackExportCompleted,
  trackExportFailed,
  trackExportStarted,
} from '../../lib/track';

const LOADING_MESSAGES = [
  { from: 0, to: 10, text: 'Starting the chat...' },
  { from: 11, to: 22, text: 'Setting the scene...' },
  { from: 23, to: 35, text: 'Adding the bubbles...' },
  { from: 36, to: 48, text: 'Making it flow...' },
  { from: 49, to: 60, text: 'Bringing it alive...' },
  { from: 61, to: 72, text: 'Making your video...' },
  { from: 73, to: 84, text: 'Adding final touches...' },
  { from: 85, to: 96, text: 'Finalizing the video...' },
  { from: 97, to: 99, text: 'Preparing download...' },
  { from: 100, to: 100, text: 'Ready to download!' },
];

function getLoadingMsg(pct: number): string {
  return LOADING_MESSAGES.find((message) => pct >= message.from && pct <= message.to)?.text ?? 'Starting the chat...';
}

/**
 * The mobile export bar is `position: sticky` at the bottom of a short strip
 * (checkbox rows + the button row). Anchoring the PNG menu with a plain
 * `absolute bottom-full` inside that strip meant the menu — taller than the
 * strip's own content above the button — poked out above the bar's
 * translucent backdrop into the raw, independently-scrolled Script panel
 * behind it, so it read as a stray box colliding with unrelated content
 * instead of a menu. Compute a `fixed` position from the caret's own rect
 * instead (the same approach every other floating menu in this app already
 * uses — see `getMenuOverlayStyle` in TelegramPreview/MessengerPreview), so
 * it always sits directly above the caret and never depends on how much
 * room its narrow ancestor happens to have.
 */
function getPngMenuStyle(anchor: DOMRect): React.CSSProperties {
  const width = 224;
  const height = 116;
  const gap = 8;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  const top = Math.max(8, anchor.top - height - gap);
  return { position: 'fixed', left, top, width, zIndex: 9999 };
}

export const ExportPanel: React.FC<{ hideDivider?: boolean }> = ({ hideDivider }) => {
  const { project, setExportConsent } = useEditorStore();
  const [pngLoading, setPngLoading] = useState(false);
  const [mp4Progress, setMp4Progress] = useState<{ state: ProgressState; pct: number; msg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeSounds, setIncludeSounds] = useState(true);
  const [pngMenuOpen, setPngMenuOpen] = useState(false);
  const [pngMenuAnchor, setPngMenuAnchor] = useState<DOMRect | null>(null);
  const pngButtonGroupRef = useRef<HTMLDivElement>(null);
  const pngCaretRef = useRef<HTMLButtonElement>(null);
  const pngMenuRef = useRef<HTMLDivElement>(null);

  const openPngMenu = useCallback(() => {
    setPngMenuAnchor(pngCaretRef.current?.getBoundingClientRect() ?? null);
    setPngMenuOpen((v) => !v);
  }, []);

  useEffect(() => {
    if (!pngMenuOpen) return;

    const reposition = () => setPngMenuAnchor(pngCaretRef.current?.getBoundingClientRect() ?? null);
    // The menu is portaled to <body>, so its own ref must be checked too —
    // otherwise every click inside it (e.g. "Full chat") would be treated as
    // an outside click and close the menu before the item's onClick runs.
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      if (pngButtonGroupRef.current?.contains(target) || pngMenuRef.current?.contains(target)) return;
      setPngMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [pngMenuOpen]);

  const handleExportPng = async (scope: PngScope = 'preview') => {
    if (!project.exportConsentAccepted) return;
    setError(null);
    setPngMenuOpen(false);
    setPngLoading(true);
    trackExportStarted('png', project.platform, scope);
    try {
      await exportPng(project, scope);
      trackExportCompleted('png', project.platform, scope);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'PNG export failed';
      trackExportFailed('png', project.platform, message);
      setError(message);
    } finally {
      setPngLoading(false);
    }
  };

  const handleExportMp4 = async () => {
    if (!project.exportConsentAccepted) return;
    setError(null);
    setMp4Progress({ state: 'preparing', pct: 0, msg: getLoadingMsg(0) });
    trackExportStarted('mp4', project.platform);
    let simulatedPct = 0;
    const progressTimer = window.setInterval(() => {
      const step = simulatedPct < 84 ? 2 : 0.75;
      simulatedPct = Math.min(simulatedPct + step, 96);
      setMp4Progress((prev) => {
        if (!prev) return prev;
        const pct = Math.max(prev.pct, simulatedPct);
        return { ...prev, pct, msg: getLoadingMsg(pct) };
      });
    }, 900);

    const onProgress = (state: ProgressState, pct: number) => {
      simulatedPct = Math.max(simulatedPct, pct);
      setMp4Progress({ state, pct, msg: getLoadingMsg(pct) });
    };

    // Which renderer produced the file, reported alongside the completed event
    // so a silent slide down the fallback chain is visible in the data.
    let renderer: 'recorder' | 'composite' | 'frames' | 'story' = 'recorder';

    try {
      if (project.story?.enabled) {
        // Story mode has no phone chrome and a moving background to paint,
        // so it always uses the sprite compositor — the local recorder
        // records the phone frame, and the legacy per-frame capturer has no
        // moving-background support. A failure here is reported, not
        // silently downgraded to a plain phone export.
        renderer = 'story';
        await exportStoryMp4(project, onProgress, { includeSounds });
      } else {
        // Prefer the local Playwright recorder (used by the desktop Run App.bat
        // workflow). On the live site, render in-browser instead: the sprite
        // compositor first (30fps, smooth scroll and typing animation), and the
        // legacy per-frame capturer only if a platform layout defeats it.
        try {
          await exportPlaywrightVideo(project, onProgress, { includeSounds });
        } catch (e) {
          if (!(e instanceof RecorderUnavailableError)) throw e;
          try {
            renderer = 'composite';
            await exportCompositeMp4(project, onProgress, { includeSounds });
          } catch (compositeError) {
            console.warn('Composite export failed, using frame capture:', compositeError);
            renderer = 'frames';
            await exportMp4(project, onProgress, { includeSounds });
          }
        }
      }
      trackExportCompleted('mp4', project.platform, renderer);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'MP4 export failed';
      trackExportFailed('mp4', project.platform, `${renderer}: ${message}`);
      setError(message);
    } finally {
      window.clearInterval(progressTimer);
      setMp4Progress(null);
    }
  };

  const isMp4Running = mp4Progress !== null && mp4Progress.state !== 'idle' && mp4Progress.state !== 'error';

  return (
    <div className="flex flex-col gap-4">
      {!hideDivider && <div className="h-px bg-white/10" />}

      <div className="space-y-2">
        <label className="flex items-start gap-2.5 cursor-pointer group">
          <div className="mt-0.5 flex-shrink-0">
            <input
              type="checkbox"
              id="export-consent"
              checked={project.exportConsentAccepted}
              onChange={(e) => {
                setExportConsent(e.target.checked);
                // Only the tick — unticking isn't a funnel step.
                if (e.target.checked) trackConsentAccepted(project.platform);
              }}
              className="w-4 h-4 rounded accent-[#00FF87] cursor-pointer"
            />
          </div>
          <span className="text-white/40 text-[11px] leading-relaxed group-hover:text-white/60 transition-colors">
            I confirm this is a fictional/mock conversation and will not be used to deceive or mislead anyone.
          </span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer group">
          <input
            type="checkbox"
            id="export-sounds"
            checked={includeSounds}
            onChange={(e) => setIncludeSounds(e.target.checked)}
            className="w-4 h-4 rounded accent-[#60EFFF] cursor-pointer flex-shrink-0"
          />
          <span className="flex items-center gap-1.5 text-white/40 text-[11px] group-hover:text-white/60 transition-colors">
            <Volume2 size={12} /> Message sounds in video
          </span>
        </label>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2 text-red-400 text-xs">
            {error}
          </div>
        )}

        {isMp4Running && mp4Progress && (
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-white/60 text-xs animate-pulse">{mp4Progress.msg}</span>
              <span className="text-white/40 text-xs">{Math.round(mp4Progress.pct)}%</span>
            </div>
            <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00FF87] to-[#60EFFF] rounded-full transition-all duration-300"
                style={{ width: `${mp4Progress.pct}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {/* Split button: the main action keeps exporting exactly what the
              preview shows; the caret offers the full-chat screenshot. */}
          <div ref={pngButtonGroupRef} className="flex flex-1">
            <button
              onClick={() => handleExportPng('preview')}
              disabled={!project.exportConsentAccepted || pngLoading || isMp4Running}
              className="flex flex-1 items-center justify-center gap-1.5 py-2 rounded-l-xl bg-[#00FF87] hover:bg-[#35FFA1] disabled:opacity-40 disabled:cursor-not-allowed text-[#061116] text-xs font-semibold transition-colors"
            >
              {pngLoading ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-[#061116]/20 border-t-[#061116] rounded-full animate-spin" />
                  Cooking...
                </span>
              ) : (
                <>
                  <ImageDown size={14} /> Export PNG
                </>
              )}
            </button>
            <button
              ref={pngCaretRef}
              onClick={openPngMenu}
              disabled={!project.exportConsentAccepted || pngLoading || isMp4Running}
              title="PNG export options"
              aria-label="PNG export options"
              aria-expanded={pngMenuOpen}
              className="flex items-center justify-center px-1.5 rounded-r-xl bg-[#00FF87] hover:bg-[#35FFA1] disabled:opacity-40 disabled:cursor-not-allowed text-[#061116] border-l border-[#061116]/15 transition-colors"
            >
              <ChevronDown size={14} className={pngMenuOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
          </div>

          {pngMenuOpen && pngMenuAnchor && typeof document !== 'undefined' && createPortal(
            <div
              ref={pngMenuRef}
              style={getPngMenuStyle(pngMenuAnchor)}
              className="overflow-hidden rounded-xl border border-white/10 bg-[#111a2e] shadow-xl"
            >
              <button
                onClick={() => handleExportPng('preview')}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
              >
                <Smartphone size={14} className="mt-0.5 flex-shrink-0 text-[#00FF87]" />
                <span>
                  <span className="block text-[12px] font-semibold text-white">Preview</span>
                  <span className="block text-[10.5px] text-white/45">One screen, as shown now</span>
                </span>
              </button>
              <button
                onClick={() => handleExportPng('full')}
                className="flex w-full items-start gap-2 border-t border-white/5 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
              >
                <ScrollText size={14} className="mt-0.5 flex-shrink-0 text-[#60EFFF]" />
                <span>
                  <span className="block text-[12px] font-semibold text-white">Full chat</span>
                  <span className="block text-[10.5px] text-white/45">Every message, one tall image</span>
                </span>
              </button>
            </div>,
            document.body
          )}

          <button
            onClick={handleExportMp4}
            disabled={!project.exportConsentAccepted || pngLoading || isMp4Running}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#60EFFF] hover:bg-[#82F4FF] disabled:opacity-40 disabled:cursor-not-allowed text-[#061116] text-xs font-semibold transition-colors"
          >
            {isMp4Running ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 border-2 border-[#061116]/20 border-t-[#061116] rounded-full animate-spin" />
                {Math.round(mp4Progress?.pct ?? 0)}%
              </span>
            ) : (
              <>
                <Clapperboard size={14} /> {project.story?.enabled ? 'Export Story Video' : 'Export Video'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
