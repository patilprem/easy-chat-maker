import React from 'react';
import type { ChatProject, StoryAspect, StoryBackground } from '../../lib/parser/types';
import { storyStage, maxStoryContentH, STORY_SCRIM_PAD } from '../../lib/story/storyLayout';
import { StoryBackgroundLayer } from './StoryBackgroundLayer';

const FALLBACK_BACKGROUND: StoryBackground = { kind: 'color', presetId: 'midnight' };

interface Props {
  project: ChatProject;
  aspect: StoryAspect;
  id?: string;
  /**
   * Editor preview paints its own background (gradient/image/video) here;
   * the video-export render route sets this false and captures a transparent
   * stage, because the video exporter paints the background itself on the
   * canvas, frame by frame (see lib/export/storyBackground.ts).
   */
  renderBackground: boolean;
  /**
   * Draw the rounded dark backdrop behind the chat column as CSS (default,
   * used by the editor preview). The video exporter turns this off and
   * instead draws the same backdrop on the canvas each frame, sized to that
   * frame's actual bubble content — see compositeCore.ts's `scrim` option —
   * so the DOM captured for export only ever contains the pill and bubbles.
   */
  bakeScrim?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * The story-mode "stage": a fixed-size box (see lib/story/storyLayout.ts)
 * holding the background, a name pill, and the chat column. The column stays
 * the same 390px width as the phone feed so every bubble component and the
 * video compositor's row-geometry logic keep working completely unchanged —
 * only what surrounds the column changes between phone mode and story mode.
 *
 * The dark backdrop behind the column hugs however many bubbles are
 * currently on screen instead of reserving a fixed-height slab — plain
 * `height: auto` (capped by `maxHeight` as a safety net for an unusually
 * long page) does that. It's anchored at the top (grows downward) or bottom
 * (grows upward) of the stage's original column slot depending on
 * `story.anchor`.
 */
export const StoryStage: React.FC<Props> = ({ project, aspect, id, renderBackground, bakeScrim = true, children, style }) => {
  const stage = storyStage(aspect);
  const story = project.story;
  const scrim = story?.scrim ?? 0.45;
  const anchor = story?.anchor ?? 'top';
  // The platform's own header (when kept — see showHeader below) already
  // shows the name and avatar, so the floating pill would just duplicate it.
  const showNamePill = (story?.showNamePill ?? true) && !story?.showHeader;

  const otherParticipant = project.participants.find((p) => !p.isSelf) ?? project.participants[0];
  const pillAvatar = project.isGroup
    ? project.participants[0]?.avatarUrl
    : otherParticipant?.avatarUrl;

  const maxBoxH = maxStoryContentH(stage, anchor) + STORY_SCRIM_PAD * 2;
  const boxPositionStyle: React.CSSProperties = anchor === 'bottom'
    ? { bottom: stage.h - (stage.column.y + stage.column.h) - STORY_SCRIM_PAD }
    : { top: stage.column.y - STORY_SCRIM_PAD };

  return (
    <div
      id={id}
      className="relative overflow-hidden"
      style={{ width: stage.w, height: stage.h, ...style }}
    >
      {renderBackground && (
        <StoryBackgroundLayer background={story?.background ?? FALLBACK_BACKGROUND} />
      )}

      {showNamePill && (
        <div
          className="absolute z-[2] flex items-center gap-2 rounded-full bg-black/55 px-3 py-1.5 backdrop-blur-sm"
          style={{ left: stage.pill.x, top: stage.pill.y }}
        >
          {pillAvatar && (
            <img src={pillAvatar} alt="" className="h-6 w-6 flex-shrink-0 rounded-full object-cover" />
          )}
          <div className="min-w-0 leading-tight">
            <div className="truncate text-[13px] font-semibold text-white">{project.title}</div>
            {project.subtitle && (
              <div className="truncate text-[10.5px] text-white/70">{project.subtitle}</div>
            )}
          </div>
        </div>
      )}

      {/* Rounded dark backdrop + chat column, merged into one auto-height
          box so it hugs whatever's currently visible instead of a fixed
          slab. `bakeScrim=false` (export capture) skips painting it here —
          the exporter draws the equivalent shape on the canvas instead. */}
      <div
        className="absolute z-[3] overflow-hidden rounded-[22px]"
        style={{
          left: stage.column.x - STORY_SCRIM_PAD,
          width: stage.column.w + STORY_SCRIM_PAD * 2,
          maxHeight: maxBoxH,
          padding: STORY_SCRIM_PAD,
          background: bakeScrim ? `rgba(0, 0, 0, ${scrim})` : 'transparent',
          ...boxPositionStyle,
        }}
      >
        <div style={{ width: stage.column.w }}>{children}</div>
      </div>
    </div>
  );
};
