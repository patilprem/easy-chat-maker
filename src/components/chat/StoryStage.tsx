import React from 'react';
import type { ChatProject, StoryAspect, StoryBackground } from '../../lib/parser/types';
import { storyStage, maxStoryContentH, STORY_SCRIM, STORY_SCRIM_PAD } from '../../lib/story/storyLayout';
import { StoryBackgroundLayer } from './StoryBackgroundLayer';

const FALLBACK_BACKGROUND: StoryBackground = { kind: 'color', presetId: 'midnight' };

/** Slightly larger than 1:1 so bubble text reads a bit bigger in story mode without touching every platform's own font sizes — see the zoom usage below. */
const STORY_FONT_ZOOM = 1.08;

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
   * instead draws the same backdrop on the canvas each frame — see
   * compositeCore.ts's `scrim` option — so the DOM captured for export only
   * ever contains the header and bubbles.
   */
  bakeScrim?: boolean;
  /**
   * Editor preview only: cap the box at its ~60% target height and let the
   * chat feed scroll internally instead of growing to fit every bubble —
   * reuses the same fixed-height-ancestor + `.phone-chat-scroll` mechanism
   * phone mode already relies on (PhonePreview's feedRef auto-scrolls it to
   * the latest bubble). Export capture leaves this off: a baked video can't
   * be scrolled by the viewer, so it still needs the box to grow up to
   * `maxStoryContentH` rather than cropping.
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
 * The dark backdrop TARGETS about 60% of the stage's height, centered with
 * roughly even margins above and below, regardless of how many bubbles are
 * visible — but that's a floor, not a hard cap: a page whose bubbles need
 * more room grows the box taller (up to a generous safety-net ceiling)
 * rather than cropping a bubble's text.
 */
export const StoryStage: React.FC<Props> = ({ project, aspect, id, renderBackground, bakeScrim = true, scrollable = false, children, style }) => {
  const stage = storyStage(aspect);
  const story = project.story;
  const anchor = story?.anchor ?? 'top';

  const minBoxH = stage.column.h + STORY_SCRIM_PAD * 2;
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

      {/* Rounded dark backdrop + chat column. In export capture (scrollable
          false), it targets ~60% of the stage's height (min-height) but
          grows with content up to a generous cap (max-height) instead of
          cropping. In the editor preview (scrollable true), it's pinned to
          that same ~60% target and the chat feed scrolls internally instead
          — see the fixed inner height below. `bakeScrim=false` (export
          capture) skips painting the backdrop here, since the exporter
          draws the equivalent shape on the canvas instead. */}
      <div
        className="absolute z-[3] overflow-hidden rounded-[22px]"
        style={{
          left: stage.column.x - STORY_SCRIM_PAD,
          width: stage.column.w + STORY_SCRIM_PAD * 2,
          ...(scrollable ? { height: minBoxH } : { minHeight: minBoxH, maxHeight: maxBoxH }),
          padding: STORY_SCRIM_PAD,
          background: bakeScrim ? `rgba(0, 0, 0, ${STORY_SCRIM})` : 'transparent',
          ...boxPositionStyle,
        }}
      >
        {/* `zoom` (not `transform: scale`) genuinely affects layout, so the
            video compositor's DOM measurements (getBoundingClientRect) pick
            up the enlarged bubble text automatically — the pre-zoom size is
            shrunk by the same factor so the POST-zoom box matches the CSS
            px values above. Export capture leaves height intrinsic so the
            box above can grow with it; the editor preview instead pins a
            fixed height here so ChatPreview's own `h-full` flex chain gets
            a real bound and its `.phone-chat-scroll` feed scrolls instead
            of pushing the box taller. */}
        <div
          style={{
            width: stage.column.w / STORY_FONT_ZOOM,
            zoom: STORY_FONT_ZOOM,
            ...(scrollable ? { height: stage.column.h / STORY_FONT_ZOOM, overflow: 'hidden' } : {}),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
