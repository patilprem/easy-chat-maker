import type { VoiceClip } from './kokoro';
import type { ToneSpec } from '../story/tones';

/**
 * Renders a generated Kokoro clip through the tone's Web Audio chain
 * (playback rate → filters → gain/compressor) in an OfflineAudioContext and
 * returns a new clip. Doing this offline, once, means the editor preview
 * and the exported video play the identical processed audio, and the
 * clip's `durationSec` already reflects the rate change (story mode holds
 * each bubble for exactly its clip's length).
 */
export async function applyTone(clip: VoiceClip, tone: ToneSpec): Promise<VoiceClip> {
  const isNoop = tone.rate === 1 && tone.gain === 1 && !tone.compress && !tone.lowpassHz && !tone.highpassHz;
  if (isNoop || typeof OfflineAudioContext === 'undefined') return clip;

  const outLength = Math.ceil(clip.samples.length / tone.rate) + Math.round(clip.sampleRate * 0.05);
  const offline = new OfflineAudioContext(1, outLength, clip.sampleRate);

  const buffer = offline.createBuffer(1, clip.samples.length, clip.sampleRate);
  buffer.copyToChannel(new Float32Array(clip.samples), 0);
  const source = offline.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = tone.rate;

  let node: AudioNode = source;
  if (tone.highpassHz) {
    const hp = offline.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = tone.highpassHz;
    node.connect(hp);
    node = hp;
  }
  if (tone.lowpassHz) {
    const lp = offline.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = tone.lowpassHz;
    node.connect(lp);
    node = lp;
  }
  const gain = offline.createGain();
  gain.gain.value = tone.gain;
  node.connect(gain);
  node = gain;
  if (tone.compress) {
    const comp = offline.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    node.connect(comp);
    node = comp;
  }
  node.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  const samples = rendered.getChannelData(0);
  // Trim trailing silence introduced by the safety margin above.
  let end = samples.length;
  while (end > 0 && Math.abs(samples[end - 1]) < 1e-4) end--;
  const trimmed = samples.slice(0, Math.max(end, 1));
  return { samples: trimmed, sampleRate: clip.sampleRate, durationSec: trimmed.length / clip.sampleRate };
}
