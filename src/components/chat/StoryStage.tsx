import React from 'react';
import type { ChatProject, StoryAspect } from '../../lib/parser/types';
import { storyStage } from '../../lib/story/storyLayout';
import { findColorPreset, presetCss } from '../../lib/story/storyColors';

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
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * The story-mode "stage": a fixed-size box (see lib/story/storyLayout.ts)
 * holding the background, a name pill, and the chat column. The column stays
 * the same 390px width as the phone feed so every bubble component and the
 * video compositor's row-geometry logic keep working completely unchanged —
 * only what surrounds the column changes between phone mode and story mode.
 */
export const StoryStage: React.FC<Props> = ({ project, aspect, id, renderBackground, children, style }) => {
  const stage = storyStage(aspect);
  const story = project.story;
  const scrim = story?.scrim ?? 0.45;
  const showNamePill = story?.showNamePill ?? true;

  const otherParticipant = project.participants.find((p) => !p.isSelf) ?? project.participants[0];
  const pillAvatar = project.isGroup
    ? project.participants[0]?.avatarUrl
    : otherParticipant?.avatarUrl;

  return (
    <div
      id={id}
      className="relative overflow-hidden"
      style={{ width: stage.w, height: stage.h, ...style }}
    >
      {renderBackground && (
        <div
          className="absolute inset-0"
          style={
            story?.background.kind === 'color' || !story?.background
              ? { background: presetCss(findColorPreset(story?.background.presetId)) }
              : undefined
          }
        >
          {/* Image/video backgrounds render here in Phase 2 (StoryBackgroundLayer). */}
        </div>
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

      {/* Rounded dark scrim so bubbles stay readable over any background. */}
      <div
        className="absolute z-[1] rounded-[22px]"
        style={{
          left: stage.column.x - 12,
          top: stage.column.y - 12,
          width: stage.column.w + 24,
          height: stage.column.h + 24,
          background: `rgba(0, 0, 0, ${scrim})`,
        }}
      />

      <div
        className="absolute z-[3] overflow-hidden"
        style={{ left: stage.column.x, top: stage.column.y, width: stage.column.w, height: stage.column.h }}
      >
        {children}
      </div>
    </div>
  );
};
