import type { StoryBackground } from '../parser/types';
import { findColorPreset, paintPreset } from '../story/storyColors';

export interface StoryBackgroundSource {
  /** Paints the background for time `tSec` into `ctx` at (0,0,W,H). */
  drawAt(ctx: CanvasRenderingContext2D, tSec: number): void;
  close(): void;
}

/**
 * Builds the per-frame background painter for a story export.
 *
 * Phase 1 only implements `kind: 'color'` (a static gradient — `drawAt`
 * ignores `tSec` and just repaints the same canvas). Image and looping/seeked
 * video backgrounds land in Phase 2 without changing this interface.
 */
export function createStoryBackgroundSource(bg: StoryBackground, w: number, h: number): StoryBackgroundSource {
  const preset = findColorPreset(bg.kind === 'color' ? bg.presetId : undefined);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) paintPreset(ctx, preset, w, h);

  return {
    drawAt(destCtx) {
      destCtx.drawImage(canvas, 0, 0, w, h);
    },
    close() {},
  };
}
