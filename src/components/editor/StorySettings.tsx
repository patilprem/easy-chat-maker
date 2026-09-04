import React from 'react';
import { Clapperboard, Smartphone } from 'lucide-react';
import { useEditorStore } from '../../lib/state/editorStore';
import { STORY_COLOR_PRESETS, presetCss } from '../../lib/story/storyColors';
import type { StoryAspect } from '../../lib/parser/types';

const segBtn = (active: boolean) =>
  `flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
    active
      ? 'bg-gradient-to-r from-[#00FF87] to-[#60EFFF] text-[#061116] shadow-sm'
      : 'text-white/55 hover:text-white/85'
  }`;

/**
 * Story mode: a chrome-less chat column floating over a background (video,
 * image or gradient), rendered at 9:16 or 16:9 instead of the phone frame.
 * Sits alongside PlatformSettings in the settings column and mirrors its
 * visual language (section header, segmented control, swatch grid).
 */
export const StorySettings: React.FC = () => {
  const {
    project, setStoryEnabled, setStoryAspect, setStoryBackgroundPreset, setStoryScrim, setStoryNamePill,
  } = useEditorStore();

  const story = project.story;
  const enabled = story?.enabled ?? false;
  const aspect: StoryAspect = story?.aspect ?? '9:16';
  const activePresetId = story?.background.kind === 'color' ? story.background.presetId : undefined;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Clapperboard size={16} className="text-[#60EFFF]" />
        <span className="text-white font-semibold text-sm">Story mode</span>
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-medium">Format</label>
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          <button onClick={() => setStoryEnabled(false)} className={segBtn(!enabled)}>
            <Smartphone size={14} strokeWidth={2.5} />
            Phone
          </button>
          <button onClick={() => setStoryEnabled(true)} className={segBtn(enabled)}>
            <Clapperboard size={14} strokeWidth={2.5} />
            Story
          </button>
        </div>
      </div>

      {enabled && story && (
        <>
          <div className="space-y-1.5">
            <label className="text-white/50 text-xs font-medium">Aspect ratio</label>
            <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
              <button onClick={() => setStoryAspect('9:16')} className={segBtn(aspect === '9:16')}>
                9:16 TikTok / Reels
              </button>
              <button onClick={() => setStoryAspect('16:9')} className={segBtn(aspect === '16:9')}>
                16:9 YouTube
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-white/50 text-xs font-medium">Background</label>
            <div className="grid grid-cols-6 gap-1.5">
              {STORY_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setStoryBackgroundPreset(preset.id)}
                  title={preset.name}
                  style={{ background: presetCss(preset) }}
                  className={`aspect-square rounded-lg border transition-all ${
                    activePresetId === preset.id
                      ? 'border-[#60EFFF] ring-1 ring-[#60EFFF]/50'
                      : 'border-white/15 hover:border-white/40'
                  }`}
                />
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2">
            <span className="text-white/45 text-[11px] whitespace-nowrap">Scrim</span>
            <input
              type="range"
              min={0}
              max={80}
              step={5}
              value={Math.round(story.scrim * 100)}
              onChange={(e) => setStoryScrim(Number(e.target.value) / 100)}
              className="h-1 flex-1 accent-[#60EFFF]"
            />
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={story.showNamePill}
              onChange={(e) => setStoryNamePill(e.target.checked)}
              className="h-3.5 w-3.5 flex-shrink-0 rounded accent-[#00FF87]"
            />
            <span className="text-white/45 text-[11px]">Show name over the chat</span>
          </label>
        </>
      )}
    </div>
  );
};
