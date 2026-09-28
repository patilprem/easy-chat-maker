import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ChatProject } from '../parser/types';
import { buildFramePlan, FPS } from '../video/chatTimeline';
import { tryEncodeMessageSoundTrack } from './exportAudio';
import { drainEncoderQueue, flushEncoder, getExportScale, negotiateVideoConfig, type ExportOptions, type ProgressCallback } from './exportMp4';
import {
  captureChatSprites, createFeedComposer, openRenderIframe, sleep, triggerDownload,
} from './compositeCore';

export { CompositeUnsupportedError } from './compositeCore';

/**
 * Sprite-compositing video exporter (phone frame).
 *
 * Captures each part of the chat ONCE with the browser's real renderer
 * (html-to-image): the phone chrome, the full message list as one tall
 * transparent image (with and without reactions), and the typing bubble in
 * three animation phases (see compositeCore.captureChatSprites). Every video
 * frame is then composed on a canvas at the timeline's native 30fps — smooth
 * scrolling, animated typing dots — and encoded with WebCodecs
 * (compositeCore.createFeedComposer). Preview fidelity without a recording
 * server. The story exporter (exportStory.ts) reuses the same core over a
 * chrome-less, story-sized render instead.
 */

const PHONE_W = 390;
const PHONE_H = 844;

export async function exportCompositeMp4(
  project: ChatProject,
  onProgress: ProgressCallback,
  options: ExportOptions = {},
): Promise<void> {
  const filename = `${project.platform}-chat.mp4`;
  const messages = project.messages;
  const plans = buildFramePlan(messages, project.participants, project.playbackSpeed);
  const audioTrack = await tryEncodeMessageSoundTrack(project, plans.length / FPS, options.includeSounds !== false);
  // 2x for crisp text on desktop, 1x on phones/low-memory devices (see
  // getExportScale) — the 2x buffers can OOM-crash a mobile tab.
  const SCALE = getExportScale();
  const VIDEO_W = PHONE_W * SCALE;
  const VIDEO_H = PHONE_H * SCALE;
  const { config, muxerCodec } = await negotiateVideoConfig(VIDEO_W, VIDEO_H, FPS);

  localStorage.setItem('ecm:v1:export-payload', JSON.stringify(project));
  onProgress('preparing', 2);

  const render = await openRenderIframe(`${window.location.origin}/render/chat/?mode=video`, PHONE_W, PHONE_H);

  try {
    const { win, doc, root } = render;
    const baseBg = project.theme === 'dark' ? '#0b141a' : '#ffffff';
    const sprites = await captureChatSprites({
      win, doc, root, messages, plans, scale: SCALE, baseBg,
      onProgress: (pct) => onProgress('preparing', pct),
    });
    const composer = createFeedComposer(sprites, SCALE);

    // ---- Encode ----
    onProgress('encoding', 18);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = VIDEO_W;
    outCanvas.height = VIDEO_H;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not create export canvas.');

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: muxerCodec, width: VIDEO_W, height: VIDEO_H },
      ...(audioTrack
        ? { audio: { codec: audioTrack.muxerCodec, sampleRate: audioTrack.sampleRate, numberOfChannels: audioTrack.numberOfChannels } }
        : {}),
      fastStart: 'in-memory',
    });
    let encoderError: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encoderError = e; },
    });
    encoder.configure(config);

    for (let f = 0; f < plans.length; f++) {
      if (encoderError) throw encoderError;
      composer.drawFrame(ctx, plans[f], f);

      const videoFrame = new VideoFrame(outCanvas, {
        timestamp: Math.round((f / FPS) * 1_000_000),
        duration: Math.round((1 / FPS) * 1_000_000),
      });
      encoder.encode(videoFrame, { keyFrame: f % (FPS * 2) === 0 });
      videoFrame.close();
      // Bound the encoder queue — on phones the encoder can't keep up with
      // frame production, and an unbounded queue OOM-kills the tab.
      await drainEncoderQueue(encoder);
      if (f % 3 === 0) onProgress('encoding', 18 + (f / plans.length) * 72);
      // Yield periodically so the UI stays responsive
      if (f % 30 === 0) await sleep(0);
    }

    await flushEncoder(encoder);
    onProgress('muxing', 92);
    if (audioTrack) {
      for (const { chunk, meta } of audioTrack.chunks) muxer.addAudioChunk(chunk, meta);
    }
    muxer.finalize();
    const { buffer } = muxer.target as ArrayBufferTarget;
    onProgress('downloading', 98);
    triggerDownload(new Blob([buffer], { type: 'video/mp4' }), filename);
    onProgress('idle', 100);
  } finally {
    render.close();
  }
}
