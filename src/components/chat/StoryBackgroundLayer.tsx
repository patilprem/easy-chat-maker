import React from 'react';
import type { StoryBackground } from '../../lib/parser/types';
import { findColorPreset, presetCss } from '../../lib/story/storyColors';

interface Props {
  background: StoryBackground;
}

/**
 * Story-mode background for the editor preview: a gradient, an uploaded
 * still image, or an uploaded looping video, with optional blur and a dark
 * dim overlay. Mirrors what the exporter paints per-frame in
 * lib/export/storyBackground.ts, but as plain DOM/CSS since this only ever
 * renders live in the browser, never inside the capture iframe (the export
 * render route always passes `renderBackground={false}` to StoryStage).
 */
export const StoryBackgroundLayer: React.FC<Props> = ({ background }) => {
  const blur = background.blur ?? 0;
  const dim = background.dim ?? 0;

  if (background.kind === 'upload' && background.mediaUrl) {
    const mediaStyle: React.CSSProperties = {
      filter: blur > 0 ? `blur(${blur}px)` : undefined,
      transform: blur > 0 ? 'scale(1.06)' : undefined,
    };
    return (
      <div className="absolute inset-0 overflow-hidden">
        {background.mediaType === 'video' ? (
          <video
            key={background.mediaUrl}
            src={background.mediaUrl}
            autoPlay
            muted
            loop={background.loop !== false}
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
            style={mediaStyle}
          />
        ) : (
          <img
            src={background.mediaUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={mediaStyle}
          />
        )}
        {dim > 0 && <div className="absolute inset-0" style={{ background: `rgba(0, 0, 0, ${dim})` }} />}
      </div>
    );
  }

  const preset = findColorPreset(background.kind === 'color' ? background.presetId : undefined);
  return (
    <div className="absolute inset-0" style={{ background: presetCss(preset) }}>
      {dim > 0 && <div className="absolute inset-0" style={{ background: `rgba(0, 0, 0, ${dim})` }} />}
    </div>
  );
};
