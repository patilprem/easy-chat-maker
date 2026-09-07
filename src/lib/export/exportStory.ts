import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ChatProject } from '../parser/types';
import { buildRevealSchedule, framePlansFromSchedule, FPS } from '../video/chatTimeline';
import { tryEncodeStoryAudioTrack } from './exportAudio';
import { drainEncoderQueue, getExportScale, negotiateVideoConfig, type ExportOptions, type ProgressCallback } from './exportMp4';
import { captureChatSprites, createFeedComposer, openRenderIframe, sleep, triggerDownload, type FeedComposer } from './compositeCore';
import { createStoryBackgroundSource } from './storyBackground';
import { storyStage, STORY_SCRIM, STORY_SCRIM_PAD } from '../story/storyLayout';
import { buildStoryPages, pageIndexForRevealIdx } from '../story/storyCycle';
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

/**
 * Encode one output frame per this many timeline frames — 2, so a 30fps
 * timeline becomes a 15fps video. Bubbles are static between reveals and the
 * background source only decodes ~15 new frames a second either way, so the
 * skipped frames were near-duplicates that cost a composite, an encode and
 * their share of the bitrate for nothing visible.
 */
const STORY_FRAME_STEP = 2;

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
  // Negotiated at the OUTPUT framerate, not the timeline's — the bitrate
  // budget scales with framerate, so a 15fps video asks for half the bits a
  // 30fps one would.
  const { config, muxerCodec } = await negotiateVideoConfig(VIDEO_W, VIDEO_H, FPS / STORY_FRAME_STEP);

  const background = await createStoryBackgroundSource(story.background, VIDEO_W, VIDEO_H);

  // The chat column always restarts from the top once a page's bubbles
  // instead of scrolling forever, like textingstory.app. Each page is an
  // independent mini-chat, so it gets its own render pass and its own
  // FeedComposer — the shared `schedule`/`plans` above (and therefore the
  // background, music, voiceover and per-message timing) are completely
  // unaffected and keep running across page boundaries; only which
  // composer draws a given frame, and its bubbles resetting to empty at the
  // top, changes.
  // Page sizes come from measuring the real text (see buildStoryPages), so
  // the real font has to be loaded before measuring — a fallback font
  // measures ALL CAPS slightly narrower, the one direction that could
  // under-count a line and overfill a page.
  await document.fonts?.ready;
  const pages = buildStoryPages(messages, story.aspect, project.isGroup);

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
        composers.push(createFeedComposer(sprites, SCALE, {
          scrim: {
            color: `rgba(0, 0, 0, ${STORY_SCRIM})`,
            padPx: STORY_SCRIM_PAD,
            radiusPx: 22,
            maxBoxHPx: stage.maxBoxH,
            // StoryStage pins the box to the stage's top for the capture
            // (bakeScrim=false), so the header's offset above the feed is a
            // known constant the composer can move the box by.
            boxTopRootY: 0,
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

    // Encode every other timeline frame. The chat itself is static between
    // reveals and the background source only decodes a new frame every
    // ~15/sec anyway (see storyBackground's BG_STEP), so the dropped frames
    // were near-duplicates — but they cost a full composite + encode each,
    // and their bits. Halving them roughly halves both export time and file
    // size for no visible difference.
    const outputFps = FPS / STORY_FRAME_STEP;
    const totalOutFrames = Math.ceil(plans.length / STORY_FRAME_STEP);

    for (let out = 0; out < totalOutFrames; out++) {
      if (encoderError) throw encoderError;
      const f = Math.min(out * STORY_FRAME_STEP, plans.length - 1);
      await background.drawAt(ctx, f / FPS);
      const plan = plans[f];
      const pIdx = Math.min(pageIndexForRevealIdx(pages, plan.visibleCount), composers.length - 1);
      const relativePlan = { ...plan, visibleCount: plan.visibleCount - pages[pIdx].startRevealIdx };
      composers[pIdx].drawFrame(ctx, relativePlan, f);

      const videoFrame = new VideoFrame(outCanvas, {
        timestamp: Math.round((out / outputFps) * 1_000_000),
        duration: Math.round((1 / outputFps) * 1_000_000),
      });
      encoder.encode(videoFrame, { keyFrame: out % Math.round(outputFps * 2) === 0 });
      videoFrame.close();
      await drainEncoderQueue(encoder);
      if (out % 3 === 0) onProgress('encoding', 18 + (out / totalOutFrames) * 70);
      if (out % 30 === 0) await sleep(0);
    }

    // Everything past here works on the whole movie at once and can take a
    // while on a long export, so it reports its own steps rather than
    // sitting on one number — flush drains the encoder's queue, finalize
    // rewrites the file with its index at the front, and the Blob copies the
    // result out.
    onProgress('muxing', 88, 'Finishing the video…');
    await encoder.flush();
    if (audioTrack) {
      onProgress('muxing', 92, 'Adding the audio…');
      for (const { chunk, meta } of audioTrack.chunks) muxer.addAudioChunk(chunk, meta);
    }
    onProgress('muxing', 94, 'Packaging the MP4…');
    await sleep(0); // let the progress paint before finalize blocks the thread
    muxer.finalize();
    const { buffer } = muxer.target as ArrayBufferTarget;
    onProgress('downloading', 98, 'Saving…');
    await sleep(0);
    triggerDownload(new Blob([buffer], { type: 'video/mp4' }), filename);
    onProgress('idle', 100);
  } finally {
    background.close();
  }
}
