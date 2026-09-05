import type { StoryBackground } from '../parser/types';
import { findColorPreset, paintPreset } from '../story/storyColors';

export interface StoryBackgroundSource {
  /** Paints the background for time `tSec` into `ctx` at (0,0,W,H). */
  drawAt(ctx: CanvasRenderingContext2D, tSec: number): Promise<void>;
  close(): void;
}

function coverRect(srcW: number, srcH: number, dstW: number, dstH: number): { sx: number; sy: number; sw: number; sh: number } {
  if (!srcW || !srcH) return { sx: 0, sy: 0, sw: dstW, sh: dstH };
  const srcRatio = srcW / srcH;
  const dstRatio = dstW / dstH;
  if (srcRatio > dstRatio) {
    const sh = srcH;
    const sw = sh * dstRatio;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh };
  }
  const sw = srcW;
  const sh = sw / dstRatio;
  return { sx: 0, sy: (srcH - sh) / 2, sw, sh };
}

/**
 * Draws `source` cover-fit into a W×H canvas, blurred (via a quarter-size
 * intermediate canvas — cheap and visually indistinguishable from a
 * full-res blur for a background element) and dimmed per the background's
 * settings. Returns the finished canvas.
 */
function paintCovered(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  w: number,
  h: number,
  blur: number,
  dim: number,
  out: HTMLCanvasElement,
): HTMLCanvasElement {
  const octx = out.getContext('2d');
  if (!octx) return out;
  const { sx, sy, sw, sh } = coverRect(srcW, srcH, w, h);

  if (blur > 0) {
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.round(w / 4));
    small.height = Math.max(1, Math.round(h / 4));
    const sctx = small.getContext('2d');
    if (sctx) {
      sctx.filter = `blur(${Math.max(1, blur / 4)}px)`;
      sctx.drawImage(source, sx, sy, sw, sh, 0, 0, small.width, small.height);
      octx.clearRect(0, 0, w, h);
      octx.drawImage(small, 0, 0, w, h);
    }
  } else {
    octx.clearRect(0, 0, w, h);
    octx.drawImage(source, sx, sy, sw, sh, 0, 0, w, h);
  }

  if (dim > 0) {
    octx.fillStyle = `rgba(0, 0, 0, ${dim})`;
    octx.fillRect(0, 0, w, h);
  }

  return out;
}

function createColorSource(bg: StoryBackground, w: number, h: number): StoryBackgroundSource {
  const preset = findColorPreset(bg.kind === 'color' ? bg.presetId : undefined);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    paintPreset(ctx, preset, w, h);
    const dim = bg.dim ?? 0;
    if (dim > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${dim})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
  return {
    async drawAt(destCtx) {
      destCtx.drawImage(canvas, 0, 0, w, h);
    },
    close() {},
  };
}

async function createImageSource(bg: StoryBackground, w: number, h: number): Promise<StoryBackgroundSource> {
  const img = new Image();
  img.src = bg.mediaUrl!;
  await img.decode().catch(
    () => new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); })
  );
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  paintCovered(img, img.naturalWidth || w, img.naturalHeight || h, w, h, bg.blur ?? 0, bg.dim ?? 0, canvas);

  return {
    async drawAt(destCtx) {
      destCtx.drawImage(canvas, 0, 0, w, h);
    },
    close() {},
  };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Seeks the background video roughly every other output frame (~15fps for a
 * 30fps export) rather than every frame — full-rate seeking on a long-GOP
 * upload can dominate export time, and a background rarely needs to be
 * sharper than that. Each seek awaits the browser's `seeked` event with a
 * timeout guard so a stuck decode can't hang the export forever.
 */
async function createVideoSource(bg: StoryBackground, w: number, h: number): Promise<StoryBackgroundSource> {
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.src = bg.mediaUrl!;

  await Promise.race([
    new Promise<void>((resolve) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => resolve();
    }),
    sleep(8000),
  ]);

  const duration = video.duration || 0;
  const offset = Math.max(0, bg.startOffsetSec ?? 0);
  const loop = bg.loop !== false;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const blur = bg.blur ?? 0;
  const dim = bg.dim ?? 0;

  const BG_STEP = typeof navigator !== 'undefined' && navigator.hardwareConcurrency >= 8 ? 1 : 2;
  let frameCounter = -1;
  let lastPaintedTime = -1;

  async function seekTo(t: number): Promise<void> {
    if (Math.abs(video.currentTime - t) < 1 / 240) return;
    await Promise.race([
      new Promise<void>((resolve) => {
        const done = () => { video.removeEventListener('seeked', done); resolve(); };
        video.addEventListener('seeked', done);
        video.currentTime = t;
      }),
      sleep(2000),
    ]);
  }

  return {
    async drawAt(destCtx, tSec) {
      frameCounter++;
      if (duration > 0 && frameCounter % BG_STEP === 0) {
        const raw = offset + tSec;
        const t = loop ? raw % duration : Math.min(raw, Math.max(0, duration - 1 / 60));
        if (Math.abs(t - lastPaintedTime) > 1 / 240) {
          await seekTo(t);
          lastPaintedTime = t;
          paintCovered(video, video.videoWidth || w, video.videoHeight || h, w, h, blur, dim, canvas);
        }
      }
      destCtx.drawImage(canvas, 0, 0, w, h);
    },
    close() {
      video.pause();
      video.removeAttribute('src');
      video.load();
    },
  };
}

/**
 * Builds the per-frame background painter for a story export: a static
 * gradient, an uploaded still image (drawn once, cover-fit), or an uploaded
 * video (re-seeked at a reduced rate as the export progresses). All three
 * apply the same blur/dim pipeline so switching background types doesn't
 * change how legible the chat column stays.
 */
export async function createStoryBackgroundSource(bg: StoryBackground, w: number, h: number): Promise<StoryBackgroundSource> {
  if (bg.kind === 'upload' && bg.mediaUrl && bg.mediaType === 'video') {
    try {
      return await createVideoSource(bg, w, h);
    } catch {
      // Fall through to a plain color background rather than failing the export.
    }
  }
  if (bg.kind === 'upload' && bg.mediaUrl && bg.mediaType === 'image') {
    try {
      return await createImageSource(bg, w, h);
    } catch {
      // Fall through to a plain color background rather than failing the export.
    }
  }
  return createColorSource(bg, w, h);
}
