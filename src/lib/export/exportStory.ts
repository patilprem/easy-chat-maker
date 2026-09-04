import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ChatProject } from '../parser/types';
import { buildFramePlan, FPS } from '../video/chatTimeline';
import { tryEncodeMessageSoundTrack } from './exportAudio';
import { drainEncoderQueue, getExportScale, negotiateVideoConfig, type ExportOptions, type ProgressCallback } from './exportMp4';
import { captureChatSprites, createFeedComposer, openRenderIframe, sleep, triggerDownload } from './compositeCore';
import { createStoryBackgroundSource } from './storyBackground';
import { storyStage } from '../story/storyLayout';

/**
 * Story-mode video exporter: chat bubbles over a background, at 9:16 or
 * 16:9, no phone chrome. Shares its capture/composite core with the phone
 * exporter (compositeCore.ts) — the only real difference is what's captured
 * (a chrome-less, story-sized stage instead of a phone) and that a moving
 * background is painted under the (transparent) capture every frame instead
 * of a solid page color.
 */

// Canvas-area safety net, mirroring exportPng's fitPixelRatio: a very long
// chat at 2x on a 1080x1920 stage could otherwise produce a browser-crashing
// tall capture.
const MAX_TALL_CAPTURE_AREA = 60_000_000;

export async function exportStoryMp4(
  project: ChatProject,
  onProgress: ProgressCallback,
  options: ExportOptions = {},
): Promise<void> {
  const story = project.story;
  if (!story?.enabled) throw new Error('Story mode is not enabled for this chat.');

  const stage = storyStage(story.aspect);
  const filename = `${project.platform}-story-${story.aspect === '9:16' ? '9x16' : '16x9'}.mp4`;
  const messages = project.messages;
  const plans = buildFramePlan(messages, project.participants, project.playbackSpeed);
  const audioTrack = await tryEncodeMessageSoundTrack(project, plans.length / FPS, options.includeSounds !== false);

  let SCALE = getExportScale();
  if (stage.w * stage.h * SCALE * SCALE > MAX_TALL_CAPTURE_AREA) SCALE = 1;
  const VIDEO_W = Math.round(stage.w * SCALE);
  const VIDEO_H = Math.round(stage.h * SCALE);
  const { config, muxerCodec } = await negotiateVideoConfig(VIDEO_W, VIDEO_H, FPS);

  const background = createStoryBackgroundSource(story.background, VIDEO_W, VIDEO_H);

  localStorage.setItem('ecm:v1:export-payload', JSON.stringify(project));
  onProgress('preparing', 2);

  const render = await openRenderIframe(
    `${window.location.origin}/render/chat/?mode=video&story=1&w=${stage.w}&h=${stage.h}`,
    stage.w,
    stage.h,
  );

  try {
    const { win, doc, root } = render;
    // No page background — the story stage is captured transparent (scrim +
    // name pill baked in, no phone chrome) so the canvas background painted
    // below shows through everywhere the chat column doesn't cover.
    const sprites = await captureChatSprites({
      win, doc, root, messages, plans, scale: SCALE,
      onProgress: (pct) => onProgress('preparing', pct),
    });
    const composer = createFeedComposer(sprites, SCALE);

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
      background.drawAt(ctx, f / FPS);
      composer.drawFrame(ctx, plans[f], f);

      const videoFrame = new VideoFrame(outCanvas, {
        timestamp: Math.round((f / FPS) * 1_000_000),
        duration: Math.round((1 / FPS) * 1_000_000),
      });
      encoder.encode(videoFrame, { keyFrame: f % (FPS * 2) === 0 });
      videoFrame.close();
      await drainEncoderQueue(encoder);
      if (f % 3 === 0) onProgress('encoding', 18 + (f / plans.length) * 72);
      if (f % 30 === 0) await sleep(0);
    }

    await encoder.flush();
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
    background.close();
  }
}
