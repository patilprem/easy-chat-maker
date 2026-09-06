import type { VoiceClip } from './kokoro';

/**
 * Plays already-generated Kokoro clips (see kokoro.ts's speak()) through Web
 * Audio, so the editor preview and the "test voice" button hear the literal
 * audio that gets baked into the exported video — not a device-dependent
 * lookalike from the browser's own text-to-speech.
 */

let ctx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

/** Stops whatever clip is currently playing, if any — cancels the previous line the same way the old browser-TTS preview always interrupted itself on a new one. */
export function stopClipPlayback(): void {
  if (currentSource) {
    try {
      currentSource.onended = null;
      currentSource.stop();
    } catch {
      // Already stopped/finished — nothing to do.
    }
    currentSource = null;
  }
}

/** Plays one clip and resolves when playback actually finishes. */
export function playClip(clip: VoiceClip): Promise<void> {
  stopClipPlayback();
  const audioCtx = getContext();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => { /* needs a user gesture on some browsers — harmless */ });

  const buffer = audioCtx.createBuffer(1, clip.samples.length, clip.sampleRate);
  // Kokoro's output buffer isn't guaranteed to be backed by a plain
  // ArrayBuffer (vs. SharedArrayBuffer) — copy into a fresh typed array so
  // this satisfies copyToChannel's stricter generic signature.
  buffer.copyToChannel(new Float32Array(clip.samples), 0);
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  currentSource = source;

  return new Promise((resolve) => {
    source.onended = () => {
      if (currentSource === source) currentSource = null;
      resolve();
    };
    source.start();
  });
}
