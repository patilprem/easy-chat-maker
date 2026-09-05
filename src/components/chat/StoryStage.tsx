import React from 'react';
import type { ChatProject, StoryAspect, StoryBackground } from '../../lib/parser/types';
import { storyStage } from '../../lib/story/storyLayout';
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
  // The platform's own header (when kept — see showHeader below) already
  // shows the name and avatar, so the floating pill would just duplicate it.
  const showNamePill = (story?.showNamePill ?? true) && !story?.showHeader;

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
