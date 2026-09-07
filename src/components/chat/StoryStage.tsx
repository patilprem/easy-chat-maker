import React from 'react';
import type { ChatProject, StoryAspect, StoryBackground } from '../../lib/parser/types';
import { storyStage, STORY_SCRIM, STORY_SCRIM_PAD } from '../../lib/story/storyLayout';
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
   * used by the editor preview). The video exporter turns this off — it
   * draws the same backdrop on the canvas each frame (see compositeCore.ts's
   * `scrim` option), so the DOM captured for export only ever contains the
   * header and bubbles.
   *
   * It also selects the CAPTURE layout: with the backdrop off, the box is
   * pinned to the stage's top and left completely unconstrained in height,
   * so nothing about the captured DOM (feed height, row geometry, whether
   * the feed becomes a scroller) depends on how much content a page has.
   * The compositor re-sizes and re-centres the box per frame instead — the
   * capture is only ever a source of sprites, never something a viewer sees.
   */
  bakeScrim?: boolean;
  /**
   * Editor preview only: pin the box at its maximum height and let the chat
   * feed scroll internally, so browsing/editing a long chat doesn't grow the
   * box past the stage. The exported video never scrolls — there the box
   * grows with each bubble instead (see compositeCore.ts's scrim).
   */
  scrollable?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

/**
 * The story-mode "stage": a fixed-size box (see lib/story/storyLayout.ts)
 * holding the background and the chat column, which keeps the platform's
 * own header (back arrow, avatar, name — the classic "texting story" look)
 * since ChatPreview is always rendered with showHeader on in this mode. The
 * column stays the same 390px width as the phone feed so every bubble
 * component and the video compositor's row-geometry logic keep working
 * completely unchanged — only what surrounds the column changes between
 * phone mode and story mode.
 *
 * The dark backdrop hugs the bubbles: it grows as each one appears and stops
 * at `stage.maxBoxH` (~60% of the stage for portrait), staying centred.
 */
export const StoryStage: React.FC<Props> = ({ project, aspect, id, renderBackground, bakeScrim = true, scrollable = false, children, style }) => {
  const stage = storyStage(aspect);
  const story = project.story;

  // Export capture: pinned to the top, height entirely unconstrained.
  // Editor preview: centred, pinned at the maximum height with the feed
  // scrolling inside it.
  const boxStyle: React.CSSProperties = bakeScrim
    ? {
        top: '50%',
        transform: 'translateY(-50%)',
        ...(scrollable ? { height: stage.maxBoxH } : { maxHeight: stage.maxBoxH }),
      }
    : { top: 0 };

  return (
    <div
      id={id}
      className="relative overflow-hidden"
      style={{ width: stage.w, height: stage.h, ...style }}
    >
      {renderBackground && (
        <StoryBackgroundLayer background={story?.background ?? FALLBACK_BACKGROUND} />
      )}

      <div
        className="absolute z-[3] overflow-hidden rounded-[22px]"
        style={{
          left: stage.column.x - STORY_SCRIM_PAD,
          width: stage.column.w + STORY_SCRIM_PAD * 2,
          padding: STORY_SCRIM_PAD,
          background: bakeScrim ? `rgba(0, 0, 0, ${STORY_SCRIM})` : 'transparent',
          ...boxStyle,
        }}
      >
        {/* `story-text` sizes the platform's own text up ~12% for story mode
            (see global.css) — real font sizes, so every measurement the video
            compositor takes stays truthful, unlike the CSS `zoom` this
            replaced. Fixed height only when the feed is meant to scroll
            (editor preview) — ChatPreview's own `h-full` flex chain needs a
            bounded ancestor for its `.phone-chat-scroll` to become a real
            scroller. Everywhere else the height stays intrinsic so the box
            hugs it. */}
        <div
          className="story-text"
          style={{
            width: stage.column.w,
            ...(scrollable ? { height: stage.maxBoxH - STORY_SCRIM_PAD * 2, overflow: 'hidden' } : {}),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
