import React, { useRef, useState } from 'react';
import { Clapperboard, Music, Smartphone, Upload, X } from 'lucide-react';
import { useEditorStore } from '../../lib/state/editorStore';
import { STORY_COLOR_PRESETS, presetCss } from '../../lib/story/storyColors';
import { VoicePanel } from './VoicePanel';
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
    project, setStoryEnabled, setStoryAspect, setStoryBackgroundPreset,
    setStoryBackgroundUpload, setStoryBackgroundOption,
    setStoryMusicUpload, setStoryMusicVolume, clearStoryMusic,
  } = useEditorStore();
  const bgFileRef = useRef<HTMLInputElement>(null);
  const musicFileRef = useRef<HTMLInputElement>(null);
  const [bgError, setBgError] = useState<string | null>(null);
  const [musicError, setMusicError] = useState<string | null>(null);

  const story = project.story;
  const enabled = story?.enabled ?? false;
  const aspect: StoryAspect = story?.aspect ?? '9:16';
  const activePresetId = story?.background.kind === 'color' ? story.background.presetId : undefined;
  const isUpload = story?.background.kind === 'upload' && !!story.background.mediaUrl;
  const hasMusic = !!story?.music?.mediaUrl;

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
            <div className="flex items-center justify-between">
              <label className="text-white/50 text-xs font-medium">Background</label>
              {isUpload && (
                <button
                  onClick={() => { setStoryBackgroundPreset('midnight'); setBgError(null); }}
                  className="text-white/40 hover:text-white/80 text-[11px] font-medium transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {STORY_COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => setStoryBackgroundPreset(preset.id)}
                  title={preset.name}
                  style={{ background: presetCss(preset) }}
                  className={`aspect-square rounded-lg border transition-all ${
                    !isUpload && activePresetId === preset.id
                      ? 'border-[#60EFFF] ring-1 ring-[#60EFFF]/50'
                      : 'border-white/15 hover:border-white/40'
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => bgFileRef.current?.click()}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 text-[11.5px] font-medium text-white/70 transition-colors hover:border-white/25 hover:text-white"
              >
                <Upload size={13} />
                {isUpload ? 'Change video/photo' : 'Upload your own video or photo'}
              </button>
              {isUpload && (
                <button
                  onClick={() => { setStoryBackgroundPreset('midnight'); setBgError(null); }}
                  title="Remove"
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 hover:text-white"
                >
                  <X size={13} strokeWidth={2.5} />
                </button>
              )}
            </div>
            <p className="text-white/30 text-[10.5px]">
              MP4/WebM up to 60 MB, or an image. Bring your own gameplay clip, satisfying video, or photo — we don't bundle game footage for licensing reasons.
            </p>

            {bgError && <p className="text-[11px] text-red-400">{bgError}</p>}

            <input
              ref={bgFileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setBgError(null);
                try {
                  await setStoryBackgroundUpload(file);
                } catch (err) {
                  setBgError(err instanceof Error ? err.message : 'Could not use that file');
                }
              }}
            />

            {isUpload && (
              <>
                <label className="flex items-center gap-2">
                  <span className="text-white/45 text-[11px] whitespace-nowrap">Blur</span>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={2}
                    value={story.background.blur ?? 0}
                    onChange={(e) => setStoryBackgroundOption({ blur: Number(e.target.value) })}
                    className="h-1 flex-1 accent-[#60EFFF]"
                  />
                </label>
                <label className="flex items-center gap-2">
                  <span className="text-white/45 text-[11px] whitespace-nowrap">Dim</span>
                  <input
                    type="range"
                    min={0}
                    max={70}
                    step={5}
                    value={Math.round((story.background.dim ?? 0) * 100)}
                    onChange={(e) => setStoryBackgroundOption({ dim: Number(e.target.value) / 100 })}
                    className="h-1 flex-1 accent-[#60EFFF]"
                  />
                </label>
                {story.background.mediaType === 'video' && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={story.background.loop !== false}
                      onChange={(e) => setStoryBackgroundOption({ loop: e.target.checked })}
                      className="h-3.5 w-3.5 flex-shrink-0 rounded accent-[#00FF87]"
                    />
                    <span className="text-white/45 text-[11px]">Loop the video</span>
                  </label>
                )}
              </>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-white/50 text-xs font-medium">
                <Music size={13} className="text-[#60EFFF]" />
                Background music
              </label>
              {hasMusic && (
                <button
                  onClick={() => { clearStoryMusic(); setMusicError(null); }}
                  className="text-white/40 hover:text-white/80 text-[11px] font-medium transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            <button
              onClick={() => musicFileRef.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] py-1.5 text-[11.5px] font-medium text-white/70 transition-colors hover:border-white/25 hover:text-white"
            >
              <Upload size={13} />
              {hasMusic ? 'Change track' : 'Upload a music track'}
            </button>
            <p className="text-white/30 text-[10.5px]">MP3, M4A, WAV or OGG up to 20 MB. Loops to fill the video, ducks under any voiceover.</p>
            {musicError && <p className="text-[11px] text-red-400">{musicError}</p>}

            <input
              ref={musicFileRef}
              type="file"
              accept="audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/wav,audio/ogg"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                setMusicError(null);
                try {
                  await setStoryMusicUpload(file);
                } catch (err) {
                  setMusicError(err instanceof Error ? err.message : 'Could not use that file');
                }
              }}
            />

            {hasMusic && (
              <label className="flex items-center gap-2">
                <span className="text-white/45 text-[11px] whitespace-nowrap">Volume</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={Math.round((story.music?.volume ?? 0.35) * 100)}
                  onChange={(e) => setStoryMusicVolume(Number(e.target.value) / 100)}
                  className="h-1 flex-1 accent-[#60EFFF]"
                />
              </label>
            )}
          </div>

          <VoicePanel project={project} />
        </>
      )}
    </div>
  );
};
