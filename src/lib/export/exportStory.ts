import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ChatProject } from '../parser/types';
import { buildRevealSchedule, framePlansFromSchedule, FPS } from '../video/chatTimeline';
import { tryEncodeStoryAudioTrack } from './exportAudio';
import { drainEncoderQueue, getExportScale, negotiateVideoConfig, type ExportOptions, type ProgressCallback } from './exportMp4';
import { captureChatSprites, createFeedComposer, openRenderIframe, sleep, triggerDownload, type FeedComposer } from './compositeCore';
import { createStoryBackgroundSource } from './storyBackground';
import { storyStage, maxStoryContentH, STORY_SCRIM, STORY_SCRIM_PAD } from '../story/storyLayout';
import { buildStoryPages, normalizeCycleCount, pageIndexForRevealIdx } from '../story/storyCycle';
import { ensureVoiceClips } from '../tts/voiceClips';
import type { VoiceClip } from '../tts/kokoro';

/**
 * Story-mode video exporter: chat bubbles over a background, at 9:16 or
 * 16:9, no phone chrome. Shares its capture/composite core with the phone
 * exporter (compositeCore.ts) — the only real difference is what's captured
 * (a chrome-less, story-sized stage instead of a phone) and that a moving
 * background is painted under the (transparent) capture every frame instead
 * of a solid page color. No typing indicator and no pause between bubbles —
 * the next one appears the instant this one's hold time is up. When
 * voiceover is on, that hold time IS the spoken line's duration (see
 * buildRevealSchedule), so bubble and narration stay in lockstep; the clips
 * are mixed into the same audio track as message sounds and music.
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
  // System/date messages ("X created group", "Monday") are chrome that
  // doesn't belong in the chrome-less story look — drop them entirely
  // rather than giving them a reveal slot.
  const messages = project.messages.filter((m) => m.kind !== 'system' && m.kind !== 'date');

  let voiceClips: Map<string, VoiceClip> = new Map();
  if (story.voice?.enabled) {
    onProgress('preparing', 1, 'Preparing voiceover…');
    voiceClips = await ensureVoiceClips(project, (msg, pct) => onProgress('preparing', Math.min(pct, 15), msg));
  }

  const holdSecById: Record<string, number> = {};
  for (const [msgId, clip] of voiceClips) holdSecById[msgId] = clip.durationSec;

  const schedule = buildRevealSchedule(messages, project.participants, {
    speed: project.playbackSpeed,
    holdSecById: voiceClips.size > 0 ? holdSecById : undefined,
    noTypingNoPause: true,
  });
  const plans = framePlansFromSchedule(schedule);

  const audioTrack = await tryEncodeStoryAudioTrack(
    project,
    schedule,
    voiceClips.size > 0 ? voiceClips : null,
    plans.length / FPS,
    options.includeSounds !== false,
  );

  let SCALE = getExportScale();
  if (stage.w * stage.h * SCALE * SCALE > MAX_TALL_CAPTURE_AREA) SCALE = 1;
  const VIDEO_W = Math.round(stage.w * SCALE);
  const VIDEO_H = Math.round(stage.h * SCALE);
  const { config, muxerCodec } = await negotiateVideoConfig(VIDEO_W, VIDEO_H, FPS);

  const background = await createStoryBackgroundSource(story.background, VIDEO_W, VIDEO_H);

  // The chat column always restarts from the top every `cycleCount` bubbles
  // instead of scrolling forever, like textingstory.app. Each page is an
  // independent mini-chat, so it gets its own render pass and its own
  // FeedComposer — the shared `schedule`/`plans` above (and therefore the
  // background, music, voiceover and per-message timing) are completely
  // unaffected and keep running across page boundaries; only which
  // composer draws a given frame, and its bubbles resetting to empty at the
  // top, changes.
  const cycleCount = normalizeCycleCount(story.aspect);
  const pages = buildStoryPages(messages, cycleCount);

  try {
    const composers: FeedComposer[] = [];
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      localStorage.setItem('ecm:v1:export-payload', JSON.stringify({ ...project, messages: page.messages }));
      const render = await openRenderIframe(
        `${window.location.origin}/render/chat/?mode=video&story=1&w=${stage.w}&h=${stage.h}`,
        stage.w,
        stage.h,
      );
      try {
        const { win, doc, root } = render;
        const pagePlans = framePlansFromSchedule(
          buildRevealSchedule(page.messages, project.participants, { speed: project.playbackSpeed, noTypingNoPause: true }),
        );
        // No page background, and no scrim either — the story stage is
        // captured transparent (header baked in, no phone chrome, no scrim)
        // so the canvas background painted below shows through everywhere
        // the chat column doesn't cover, and the fixed-size scrim drawn
        // below shows through the gaps around it.
        const sprites = await captureChatSprites({
          win, doc, root, messages: page.messages, plans: pagePlans, scale: SCALE,
          onProgress: (pct) => onProgress('preparing', 16 + Math.round(((i + pct / 100) / pages.length) * 2)),
        });
        const scrimAnchor = story.anchor ?? 'top';
        // Same fixed edge StoryStage.tsx positions the CSS box at — the
        // box's top for 'top' (covers the header, when kept, which sits
        // above the feed inside it), or its bottom for 'bottom'.
        const fixedEdgeRootY = scrimAnchor === 'bottom'
          ? stage.column.y + stage.column.h + STORY_SCRIM_PAD
          : stage.column.y - STORY_SCRIM_PAD;
        composers.push(createFeedComposer(sprites, SCALE, {
          scrim: {
            color: `rgba(0, 0, 0, ${STORY_SCRIM})`,
            padPx: STORY_SCRIM_PAD,
            radiusPx: 22,
            minContentHPx: stage.column.h,
            maxContentHPx: maxStoryContentH(stage, scrimAnchor),
            anchor: scrimAnchor,
            fixedEdgeRootY,
          },
        }));
      } finally {
        render.close();
      }
    }

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
      await background.drawAt(ctx, f / FPS);
      const plan = plans[f];
      const pIdx = Math.min(pageIndexForRevealIdx(plan.visibleCount, cycleCount), composers.length - 1);
      const relativePlan = { ...plan, visibleCount: plan.visibleCount - pages[pIdx].startRevealIdx };
      composers[pIdx].drawFrame(ctx, relativePlan, f);

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
    background.close();
  }
}
