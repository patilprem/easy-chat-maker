import type { StoryAspect, StorySettings } from '../parser/types';

/**
 * Story mode's chat column is a little wider than the phone feed's 390px so
 * the bubbles fill more of the frame. Every bubble component is width-driven
 * (and the compositor measures whatever the DOM reports), so this is just a
 * number — nothing downstream is hardcoded to the phone's width.
 */
export const STORY_COLUMN_W = 420;

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
  column: { x: number; w: number };
  /** Tallest the box may grow, its own padding included (CSS px). */
  maxBoxH: number;
}

/**
 * The box HUGS its bubbles — it starts small and grows as each one appears,
 * staying vertically centred — and stops growing at this fraction of the
 * stage's height. 16:9's stage is barely half as tall as 9:16's, so the
 * same fraction there would leave room for about one bubble; landscape gets
 * a bigger share of its (much shorter) stage instead.
 */
const BOX_MAX_FRAC: Record<StoryAspect, number> = { '9:16': 0.7, '16:9': 0.8 };

function makeStage(w: number, h: number, aspect: StoryAspect): StoryStageGeometry {
  return {
    w,
    h,
    column: { x: (w - STORY_COLUMN_W) / 2, w: STORY_COLUMN_W },
    maxBoxH: Math.round(h * BOX_MAX_FRAC[aspect]),
  };
}

const STAGES: Record<StoryAspect, StoryStageGeometry> = {
  '9:16': makeStage(540, 960, '9:16'),
  '16:9': makeStage(960, 540, '16:9'),
};

/** Stage size + chat-column placement (CSS px, pre-SCALE) for an aspect. */
export function storyStage(aspect: StoryAspect): StoryStageGeometry {
  return STAGES[aspect];
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
