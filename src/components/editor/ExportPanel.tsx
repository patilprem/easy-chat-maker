import React, { useState } from 'react';
import { ImageDown, Clapperboard, Volume2 } from 'lucide-react';
import { useEditorStore } from '../../lib/state/editorStore';
import { exportPng } from '../../lib/export/exportPng';
import { exportMp4, type ProgressState } from '../../lib/export/exportMp4';
import { exportCompositeMp4 } from '../../lib/export/exportComposite';
import { exportPlaywrightVideo, RecorderUnavailableError } from '../../lib/export/exportPlaywrightVideo';

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

export const ExportPanel: React.FC<{ hideDivider?: boolean }> = ({ hideDivider }) => {
  const { project, setExportConsent } = useEditorStore();
  const [pngLoading, setPngLoading] = useState(false);
  const [mp4Progress, setMp4Progress] = useState<{ state: ProgressState; pct: number; msg: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [includeSounds, setIncludeSounds] = useState(true);

  const handleExportPng = async () => {
    if (!project.exportConsentAccepted) return;
    setError(null);
    setPngLoading(true);
    try {
      await exportPng(project);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PNG export failed');
    } finally {
      setPngLoading(false);
    }
  };

  const handleExportMp4 = async () => {
    if (!project.exportConsentAccepted) return;
    setError(null);
    setMp4Progress({ state: 'preparing', pct: 0, msg: getLoadingMsg(0) });
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

    try {
      // Prefer the local Playwright recorder (used by the desktop Run App.bat
      // workflow). On the live site, render in-browser instead: the sprite
      // compositor first (30fps, smooth scroll and typing animation), and the
      // legacy per-frame capturer only if a platform layout defeats it.
      try {
        await exportPlaywrightVideo(project, onProgress, { includeSounds });
      } catch (e) {
        if (!(e instanceof RecorderUnavailableError)) throw e;
        try {
          await exportCompositeMp4(project, onProgress, { includeSounds });
        } catch (compositeError) {
          console.warn('Composite export failed, using frame capture:', compositeError);
          await exportMp4(project, onProgress, { includeSounds });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'MP4 export failed');
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
              onChange={(e) => setExportConsent(e.target.checked)}
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
          <button
            onClick={handleExportPng}
            disabled={!project.exportConsentAccepted || pngLoading || isMp4Running}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-[#00FF87] hover:bg-[#35FFA1] disabled:opacity-40 disabled:cursor-not-allowed text-[#061116] text-xs font-semibold transition-colors"
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
                <Clapperboard size={14} /> Export Video
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
