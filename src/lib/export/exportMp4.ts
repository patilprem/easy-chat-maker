import { toCanvas, getFontEmbedCSS } from 'html-to-image';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ChatProject, FramePlan } from '../parser/types';
import { buildFramePlan, FPS } from '../video/chatTimeline';

export type ProgressState = 'idle' | 'preparing' | 'encoding' | 'muxing' | 'downloading' | 'error';
export type ProgressCallback = (state: ProgressState, pct: number, msg?: string) => void;

const CREATIVE_MSGS = [
  'Cooking your chat...',
  'Adding chat bubbles...',
  'Sprinkling the texts...',
  'Mixing it all together...',
  'Almost ready...',
];

const PHONE_W = 390;
const PHONE_H = 844;
// Step the 30fps timeline by an integer divisor so playback speed is exact
// (12fps with a 3-frame step used to play 20% too fast).
const EXPORT_FPS = 15;
const FRAME_STEP = Math.max(1, Math.round(FPS / EXPORT_FPS));
// Codec preference order: H.264 (plays everywhere) High profile first —
// Baseline noticeably blurs small text at the same bitrate — then Main,
// then Baseline, then VP9 (available in every Chromium build, including
// ones without proprietary codecs). Levels are high enough for the
// 780x1688 frame.
const CODEC_CANDIDATES: { codec: string; muxerCodec: 'avc' | 'vp9' }[] = [
  { codec: 'avc1.64002A', muxerCodec: 'avc' },
  { codec: 'avc1.4D002A', muxerCodec: 'avc' },
  { codec: 'avc1.42002A', muxerCodec: 'avc' },
  { codec: 'avc1.42001f', muxerCodec: 'avc' },
  { codec: 'vp09.00.40.08', muxerCodec: 'vp9' },
  { codec: 'vp09.00.10.08', muxerCodec: 'vp9' },
];

const baseVideoConfig = (codec: string, width: number, height: number, framerate: number): VideoEncoderConfig => ({
  codec,
  width,
  height,
  // Scale the bitrate budget with resolution (~0.12 bits/pixel/frame) so
  // text stays sharp at 2x without bloating 1x files.
  bitrate: Math.min(10_000_000, Math.max(2_500_000, Math.round(width * height * framerate * 0.12))),
  framerate,
});

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function getMsgForProgress(pct: number): string {
  const idx = Math.min(Math.floor((pct / 100) * CREATIVE_MSGS.length), CREATIVE_MSGS.length - 1);
  return CREATIVE_MSGS[idx];
}

function getFrameSignature(plan: FramePlan): string {
  return [
    plan.visibleCount,
    plan.typingParticipantId ?? '',
    plan.activeReactionIds.join(','),
    Math.round(plan.scrollY),
  ].join('|');
}

/**
 * Capture/encode scale: 2x for crisp text everywhere now that the encoder
 * queue is bounded (the mobile tab crashes were queue growth, not the 2x
 * buffers). Only genuinely low-memory devices drop to 1x.
 */
export function getExportScale(): number {
  if (typeof navigator === 'undefined') return 2;
  const deviceMemory = (navigator as { deviceMemory?: number }).deviceMemory;
  return typeof deviceMemory === 'number' && deviceMemory <= 2 ? 1 : 2;
}

/**
 * Keep the WebCodecs encoder queue bounded. Without this, a slow (often
 * software) encoder falls behind the frame producer and queued VideoFrames
 * pile up until the tab is killed — the usual cause of "Aw, Snap!" during
 * export on phones.
 */
export async function drainEncoderQueue(encoder: VideoEncoder, maxQueued = 4): Promise<void> {
  while (encoder.encodeQueueSize > maxQueued) {
    await new Promise((r) => setTimeout(r, 5));
  }
}

export async function negotiateVideoConfig(
  width: number,
  height: number,
  framerate: number
): Promise<{ config: VideoEncoderConfig; muxerCodec: 'avc' | 'vp9' }> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('MP4 export needs WebCodecs. Please try Chrome or Edge desktop.');
  }

  if (typeof VideoEncoder.isConfigSupported !== 'function') {
    return { config: baseVideoConfig(CODEC_CANDIDATES[0].codec, width, height, framerate), muxerCodec: CODEC_CANDIDATES[0].muxerCodec };
  }

  for (const candidate of CODEC_CANDIDATES) {
    const attempt = baseVideoConfig(candidate.codec, width, height, framerate);
    const support = await VideoEncoder.isConfigSupported(attempt).catch(() => null);
    if (support?.supported) {
      return { config: support.config ?? attempt, muxerCodec: candidate.muxerCodec };
    }
  }

  throw new Error('MP4 export is not supported by this browser/device. Please try Chrome or Edge desktop.');
}

export async function exportMp4(project: ChatProject, onProgress: ProgressCallback): Promise<void> {
  const filename = `${project.platform}-chat.mp4`;
  const frames = buildFramePlan(project.messages, project.participants);
  const totalFrames = frames.length;
  const totalOutputFrames = Math.ceil(totalFrames / FRAME_STEP);
  const videoScale = getExportScale();
  const videoW = PHONE_W * videoScale;
  const videoH = PHONE_H * videoScale;
  const { config: supportedConfig, muxerCodec } = await negotiateVideoConfig(videoW, videoH, EXPORT_FPS);

  localStorage.setItem('ecm:v1:export-payload', JSON.stringify(project));
  onProgress('preparing', 2, CREATIVE_MSGS[0]);

  const iframe = document.createElement('iframe');
  iframe.src = `${window.location.origin}/render/chat/?mode=video`;
  Object.assign(iframe.style, {
    position: 'fixed',
    left: '-9999px',
    top: '-9999px',
    width: `${PHONE_W}px`,
    height: `${PHONE_H}px`,
    border: 'none',
  });
  document.body.appendChild(iframe);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = videoW;
  outCanvas.height = videoH;
  const ctx = outCanvas.getContext('2d');
  if (!ctx) throw new Error('Could not create export canvas.');

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Iframe load failed'));
      setTimeout(() => reject(new Error('Iframe load timeout')), 15000);
    });

    const iframeWin = iframe.contentWindow;
    const iframeDoc = iframe.contentDocument;
    if (!iframeWin || !iframeDoc) throw new Error('Iframe inaccessible');

    let phoneEl: HTMLElement | null = null;
    for (let i = 0; i < 40; i++) {
      phoneEl = iframeDoc.getElementById('phone-screen-export');
      if (phoneEl) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    if (!phoneEl) throw new Error('#phone-screen-export not found in iframe');

    // Same readiness waits as the PNG exporter — fonts and images must be
    // loaded in the hidden render document before the first capture.
    await Promise.allSettled([
      iframeDoc.fonts?.ready ?? Promise.resolve(),
      ...Array.from(iframeDoc.images).map(
        (img) => new Promise((r) => { img.complete ? r(null) : (img.onload = img.onerror = r); })
      ),
    ]);
    // Serialize the font CSS once and reuse it for every frame capture.
    const fontEmbedCSS = await getFontEmbedCSS(phoneEl).catch(() => '');

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: muxerCodec, width: videoW, height: videoH },
      fastStart: 'in-memory',
    });

    let encoderError: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encoderError = e; },
    });

    encoder.configure(supportedConfig);
    onProgress('encoding', 5, CREATIVE_MSGS[1]);

    let lastCapturedSignature = '';
    let phoneCanvas: HTMLCanvasElement | null = null;

    for (let outFrame = 0; outFrame < totalOutputFrames; outFrame++) {
      if (encoderError) throw encoderError;

      const f = Math.min(outFrame * FRAME_STEP, totalFrames - 1);
      const plan = frames[f];
      const signature = getFrameSignature(plan);
      const shouldCapture = signature !== lastCapturedSignature || phoneCanvas === null;

      if (shouldCapture) {
        // `pin: true` makes the renderer pin the feed to its latest content
        // with a transform (live scrollTop is lost when html-to-image clones
        // the DOM). The token round-trip replaces a fixed delay, so capture
        // happens only after the frame is committed and pinned.
        const token = `mp4-${outFrame}`;
        iframeWin.postMessage({ type: 'SET_FRAME', frame: f, plan, token, pin: true }, '*');
        for (let i = 0; i < 60; i++) {
          if ((iframeWin as Window & { __ECM_FRAME_READY?: string }).__ECM_FRAME_READY === token) break;
          await new Promise((r) => setTimeout(r, 15));
        }

        phoneCanvas = await toCanvas(phoneEl, {
          width: PHONE_W,
          height: PHONE_H,
          style: { width: `${PHONE_W}px`, height: `${PHONE_H}px` },
          pixelRatio: videoScale,
          fontEmbedCSS,
          backgroundColor: project.theme === 'dark' ? '#0b141a' : '#ffffff',
        });
        lastCapturedSignature = signature;
      }

      ctx.clearRect(0, 0, videoW, videoH);
      if (!phoneCanvas) throw new Error('Could not render video frame.');
      ctx.drawImage(phoneCanvas, 0, 0, videoW, videoH);

      const videoFrame = new VideoFrame(outCanvas, {
        timestamp: Math.round((outFrame / EXPORT_FPS) * 1_000_000),
        duration: Math.round((1 / EXPORT_FPS) * 1_000_000),
      });
      encoder.encode(videoFrame, { keyFrame: outFrame % (EXPORT_FPS * 2) === 0 });
      videoFrame.close();
      await drainEncoderQueue(encoder);

      const pct = 5 + (outFrame / totalOutputFrames) * 80;
      onProgress('encoding', pct, getMsgForProgress(pct));
    }

    await encoder.flush();
    onProgress('muxing', 90, CREATIVE_MSGS[3]);
    muxer.finalize();

    const { buffer } = muxer.target as ArrayBufferTarget;
    const blob = new Blob([buffer], { type: 'video/mp4' });
    onProgress('downloading', 98, CREATIVE_MSGS[4]);
    triggerDownload(blob, filename);
    onProgress('idle', 100);
  } catch (err) {
    console.error('MP4 export failed:', err);
    onProgress('error', 0, err instanceof Error ? err.message : 'Export failed');
    throw err;
  } finally {
    document.body.removeChild(iframe);
  }
}
