import type { StoryAspect, StorySettings } from '../parser/types';

/**
 * Story mode keeps the chat column at the SAME width as the phone feed
 * (390px) so every bubble component, its wrapping, and the video
 * compositor's sprite/geometry logic (built around that 390px feed) work
 * completely unchanged — only the stage around the column grows.
 */
export const STORY_COLUMN_W = 390;

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

export function defaultStorySettings(aspect: StoryAspect = '9:16'): StorySettings {
  return {
    enabled: true,
    aspect,
    background: { kind: 'color', presetId: 'midnight', blur: aspect === '16:9' ? 12 : 0, dim: 0.35, loop: true },
    scrim: 0.45,
    showNamePill: true,
    anchor: 'top',
  };
}
