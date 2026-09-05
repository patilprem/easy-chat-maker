import type { StoryAspect, StorySettings } from '../parser/types';

/**
 * Story mode keeps the chat column at the SAME width as the phone feed
 * (390px) so every bubble component, its wrapping, and the video
 * compositor's sprite/geometry logic (built around that 390px feed) work
 * completely unchanged — only the stage around the column grows.
 */
export const STORY_COLUMN_W = 390;

/** CSS px inset between the dark backdrop's edge and the bubbles inside it. */
export const STORY_SCRIM_PAD = 12;

/**
 * Fixed defaults for the settings that used to be user-adjustable sliders
 * — kept simple on purpose rather than exposing more knobs. Every reader
 * of `story.scrim`/`story.showHeader` uses these constants directly instead
 * of the per-project stored value, so behavior stays consistent across
 * every project (old ones included), not just newly created ones.
 */
export const STORY_SCRIM = 0.8;
export const STORY_SHOW_HEADER = true;

export interface StoryStageGeometry {
  w: number;
  h: number;
  column: { x: number; y: number; w: number; h: number };
}

// The chat box TARGETS about 60% of the stage's height, centered with
// roughly equal margins above and below — but this is a floor, not a hard
// cap: a page whose bubbles need more room than that grows the box taller
// (see maxStoryContentH) rather than cropping a bubble's text, so the
// actual on-screen split isn't pinned to exactly 20/60/20 in every case.
const BOX_TOP_FRAC = 0.2;
const BOX_HEIGHT_FRAC = 0.6;

function makeStage(w: number, h: number): StoryStageGeometry {
  const outerTop = h * BOX_TOP_FRAC;
  const outerHeight = h * BOX_HEIGHT_FRAC;
  return {
    w,
    h,
    column: {
      x: (w - STORY_COLUMN_W) / 2,
      y: outerTop + STORY_SCRIM_PAD,
      w: STORY_COLUMN_W,
      h: outerHeight - STORY_SCRIM_PAD * 2,
    },
  };
}

const STAGES: Record<StoryAspect, StoryStageGeometry> = {
  '9:16': makeStage(540, 960),
  '16:9': makeStage(960, 540),
};

/** Stage size + chat-column placement (CSS px, pre-SCALE) for an aspect. */
export function storyStage(aspect: StoryAspect): StoryStageGeometry {
  return STAGES[aspect];
}

/**
 * How tall the chat box (see StoryStage.tsx) is allowed to grow before it
 * has to clip, in CSS px, EXCLUDING its own padding — a safety net for an
 * unusually long page, not the box's normal size. `column.h` (~60% of the
 * stage) is the floor it targets when content is short; this is the
 * ceiling it can grow into using the rest of the room the stage design
 * left around it, so a long bubble stretches the box instead of being cut
 * off.
 */
export function maxStoryContentH(stage: StoryStageGeometry, anchor: 'top' | 'bottom' = 'top'): number {
  const boxTopY = stage.column.y - STORY_SCRIM_PAD;
  const boxBottomY = stage.column.y + stage.column.h + STORY_SCRIM_PAD;
  const available = anchor === 'bottom' ? boxBottomY : stage.h - boxTopY;
  return Math.max(stage.column.h, available - STORY_SCRIM_PAD * 2);
}

export function defaultStorySettings(aspect: StoryAspect = '9:16'): StorySettings {
  return {
    enabled: true,
    aspect,
    background: { kind: 'color', presetId: 'midnight', blur: aspect === '16:9' ? 12 : 0, dim: 0.35, loop: true },
    scrim: STORY_SCRIM,
    showNamePill: true,
    showHeader: STORY_SHOW_HEADER,
    anchor: 'top',
  };
}
