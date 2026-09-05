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
  pill: { x: number; y: number };
}

const STAGES: Record<StoryAspect, StoryStageGeometry> = {
  '9:16': {
    w: 540,
    h: 960,
    column: { x: 75, y: 150, w: STORY_COLUMN_W, h: 690 },
    pill: { x: 75, y: 96 },
  },
  '16:9': {
    w: 960,
    h: 540,
    column: { x: 285, y: 30, w: STORY_COLUMN_W, h: 480 },
    pill: { x: 285, y: 8 },
  },
};

/** Stage size + chat-column placement (CSS px, pre-SCALE) for an aspect. */
export function storyStage(aspect: StoryAspect): StoryStageGeometry {
  return STAGES[aspect];
}

/**
 * How tall the auto-height chat box (see StoryStage.tsx) is allowed to grow
 * before it clips, in CSS px, EXCLUDING its own padding. `column.h` was
 * originally the box's fixed, always-on height; now that the box only
 * grows to fit whatever's actually visible, there's no cosmetic downside to
 * letting it use the rest of the room the stage design left around it —
 * `column.h` stays as a floor so this can only grow the ceiling, never
 * shrink it below what the layout already accounted for.
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
