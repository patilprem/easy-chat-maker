import html2canvas from 'html2canvas';
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
const VIDEO_W = PHONE_W;
const VIDEO_H = PHONE_H;
const EXPORT_FPS = 12;
const FRAME_STEP = Math.max(1, Math.round(FPS / EXPORT_FPS));
// Codec preference order: H.264 (plays everywhere), then VP9 (available in
// every Chromium build, including ones without proprietary codecs).
const CODEC_CANDIDATES: { codec: string; muxerCodec: 'avc' | 'vp9' }[] = [
  { codec: 'avc1.42001f', muxerCodec: 'avc' },
  { codec: 'vp09.00.10.08', muxerCodec: 'vp9' },
];

const baseVideoConfig = (codec: string): VideoEncoderConfig => ({
  codec,
  width: VIDEO_W,
  height: VIDEO_H,
  bitrate: 1_800_000,
  framerate: EXPORT_FPS,
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

async function getSupportedVideoConfig(): Promise<{ config: VideoEncoderConfig; muxerCodec: 'avc' | 'vp9' }> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('MP4 export needs WebCodecs. Please try Chrome or Edge desktop.');
  }

  if (typeof VideoEncoder.isConfigSupported !== 'function') {
    return { config: baseVideoConfig(CODEC_CANDIDATES[0].codec), muxerCodec: CODEC_CANDIDATES[0].muxerCodec };
  }

  for (const candidate of CODEC_CANDIDATES) {
    const attempt = baseVideoConfig(candidate.codec);
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
  const { config: supportedConfig, muxerCodec } = await getSupportedVideoConfig();

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
  outCanvas.width = VIDEO_W;
  outCanvas.height = VIDEO_H;
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

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: muxerCodec, width: VIDEO_W, height: VIDEO_H },
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
        iframeWin.postMessage({ type: 'SET_FRAME', frame: f, plan }, '*');
        await new Promise((r) => setTimeout(r, 20));

        phoneCanvas = await html2canvas(phoneEl, {
          scale: 1,
          useCORS: true,
          backgroundColor: null,
          logging: false,
          window: iframeWin,
        } as Parameters<typeof html2canvas>[1] & { window: Window });
        lastCapturedSignature = signature;
      }

      ctx.clearRect(0, 0, VIDEO_W, VIDEO_H);
      if (!phoneCanvas) throw new Error('Could not render video frame.');
      ctx.drawImage(phoneCanvas, 0, 0, VIDEO_W, VIDEO_H);

      const videoFrame = new VideoFrame(outCanvas, {
        timestamp: Math.round((outFrame / EXPORT_FPS) * 1_000_000),
        duration: Math.round((1 / EXPORT_FPS) * 1_000_000),
      });
      encoder.encode(videoFrame, { keyFrame: outFrame % (EXPORT_FPS * 2) === 0 });
      videoFrame.close();

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
