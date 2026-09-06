import type { TtsCapability } from './capability';

export interface VoiceClip {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
}

export type ModelProgress = { status: 'downloading' | 'ready'; pct: number };

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let ttsPromise: Promise<any> | null = null;
let loadedDevice: TtsCapability['device'] | null = null;

interface HfProgressEvent {
  status?: string;
  progress?: number;
  loaded?: number;
  total?: number;
}

/**
 * Lazily loads kokoro-js and the Kokoro-82M model (~86MB, q8, cached by the
 * browser after the first download) and returns a singleton TTS instance.
 * Never imported at the top of a module that loads on every page — story
 * mode's voiceover is the only caller, and it always goes through this
 * function so the ~30MB kokoro-js + transformers.js bundle stays out of the
 * main editor chunk.
 */
export async function getKokoro(device: TtsCapability['device'], onProgress?: (p: ModelProgress) => void) {
  if (ttsPromise && loadedDevice === device) return ttsPromise;
  loadedDevice = device;

  ttsPromise = (async () => {
    const { KokoroTTS } = await import('kokoro-js');
    // q4 trades a little voice quality for a much smaller one-time download
    // than q8 — the editor preview generates the same clips through this
    // same path (see clipPlayback.ts), so there's only one model tier to
    // download, not a cheap-preview/real-export split.
    const dtype = device === 'webgpu' ? 'fp32' : 'q4';

    // transformers.js reports progress per file (weights, tokenizer, config,
    // ...), not as one overall percentage — good enough for a "downloading
    // the voice model" indicator without pretending to more precision than
    // the callback actually gives us.
    const model = await KokoroTTS.from_pretrained(MODEL_ID, {
      dtype,
      device,
      progress_callback: (e: HfProgressEvent) => {
        if (!onProgress) return;
        if (e.status === 'progress' && typeof e.total === 'number' && typeof e.loaded === 'number' && e.total > 0) {
          onProgress({ status: 'downloading', pct: Math.min(99, Math.round((e.loaded / e.total) * 100)) });
        }
      },
    });
    onProgress?.({ status: 'ready', pct: 100 });
    return model;
  })();

  try {
    return await ttsPromise;
  } catch (err) {
    ttsPromise = null;
    loadedDevice = null;
    throw err;
  }
}

/** Runs generations one at a time — Kokoro's WASM session isn't safe for concurrent calls. */
let queue: Promise<unknown> = Promise.resolve();

export async function speak(
  device: TtsCapability['device'],
  text: string,
  voice: string,
  speed: number,
  onModelProgress?: (p: ModelProgress) => void,
): Promise<VoiceClip> {
  const run = queue.then(async () => {
    const tts = await getKokoro(device, onModelProgress);
    const raw = await tts.generate(text, { voice, speed });
    const samples = raw.audio as Float32Array;
    return {
      samples,
      sampleRate: raw.sampling_rate as number,
      durationSec: samples.length / (raw.sampling_rate as number),
    };
  });
  queue = run.catch(() => undefined);
  return run;
}
