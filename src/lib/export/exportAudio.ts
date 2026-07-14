import type { ChatProject } from '../parser/types';
import { buildSoundEvents } from '../video/chatTimeline';

/**
 * Browser-side audio track for the WebCodecs exporters: renders the message
 * sounds at their timeline positions with an OfflineAudioContext and encodes
 * them to AAC. Best-effort — returns null (silent video) when the browser
 * lacks AudioEncoder/AAC support or no sound files are reachable.
 */

const CHANNELS = 2;
const SOUND_VOLUME = 0.9;

// AAC first (plays everywhere), then Opus — open Chromium builds ship no AAC
// encoder. Opus-in-MP4 requires 48kHz.
const AUDIO_CODEC_CANDIDATES: { codec: string; muxerCodec: 'aac' | 'opus'; sampleRate: number }[] = [
  { codec: 'mp4a.40.2', muxerCodec: 'aac', sampleRate: 44100 },
  { codec: 'opus', muxerCodec: 'opus', sampleRate: 48000 },
];

const SOUND_FILE_NAMES = {
  send: 'message-send.wav',
  receive: 'message-receive.wav',
  reaction: 'reaction-pop.wav',
} as const;

type SoundName = keyof typeof SOUND_FILE_NAMES;

export interface EncodedAudioTrack {
  muxerCodec: 'aac' | 'opus';
  sampleRate: number;
  numberOfChannels: number;
  chunks: { chunk: EncodedAudioChunk; meta?: EncodedAudioChunkMetadata }[];
}

async function negotiateAudioConfig(): Promise<{ config: AudioEncoderConfig; muxerCodec: 'aac' | 'opus' } | null> {
  for (const candidate of AUDIO_CODEC_CANDIDATES) {
    const config: AudioEncoderConfig = {
      codec: candidate.codec,
      sampleRate: candidate.sampleRate,
      numberOfChannels: CHANNELS,
      bitrate: 96_000,
    };
    if (typeof AudioEncoder.isConfigSupported !== 'function') return { config, muxerCodec: candidate.muxerCodec };
    const support = await AudioEncoder.isConfigSupported(config).catch(() => null);
    if (support?.supported) return { config: support.config ?? config, muxerCodec: candidate.muxerCodec };
  }
  return null;
}

function soundUrls(name: SoundName, platform: string): string[] {
  const fileName = SOUND_FILE_NAMES[name];
  const urls: string[] = [];
  if (/^[a-z0-9_-]+$/i.test(platform)) urls.push(`/sounds/${platform}/${fileName}`);
  urls.push(`/sounds/${fileName}`);
  return urls;
}

async function fetchSoundBuffer(ctx: OfflineAudioContext, urls: string[]): Promise<AudioBuffer | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      return await ctx.decodeAudioData(await response.arrayBuffer());
    } catch {
      // try the next candidate
    }
  }
  return null;
}

export async function encodeMessageSoundTrack(
  project: ChatProject,
  durationSec: number,
): Promise<EncodedAudioTrack | null> {
  if (typeof AudioEncoder === 'undefined' || typeof OfflineAudioContext === 'undefined') return null;

  const events = buildSoundEvents(project.messages, project.participants);
  if (events.length === 0 || durationSec <= 0) return null;

  const negotiated = await negotiateAudioConfig();
  if (!negotiated) return null;
  const { config, muxerCodec } = negotiated;
  const sampleRate = config.sampleRate;

  const offline = new OfflineAudioContext(CHANNELS, Math.ceil(durationSec * sampleRate), sampleRate);

  const buffers = new Map<SoundName, AudioBuffer | null>();
  for (const name of [...new Set(events.map((e) => e.sound))]) {
    buffers.set(name, await fetchSoundBuffer(offline, soundUrls(name, project.platform)));
  }
  if ([...buffers.values()].every((b) => b === null)) return null;

  const gain = offline.createGain();
  gain.gain.value = SOUND_VOLUME;
  gain.connect(offline.destination);
  for (const event of events) {
    const buffer = buffers.get(event.sound);
    if (!buffer || event.timeSec >= durationSec) continue;
    const source = offline.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.start(event.timeSec);
  }

  const rendered = await offline.startRendering();

  const chunks: EncodedAudioTrack['chunks'] = [];
  let encoderError: unknown = null;
  const encoder = new AudioEncoder({
    output: (chunk, meta) => chunks.push({ chunk, meta }),
    error: (e) => { encoderError = e; },
  });
  encoder.configure(config);

  const ch0 = rendered.getChannelData(0);
  const ch1 = rendered.numberOfChannels > 1 ? rendered.getChannelData(1) : ch0;
  const BLOCK = 4096;
  for (let offset = 0; offset < rendered.length; offset += BLOCK) {
    if (encoderError) throw encoderError;
    const n = Math.min(BLOCK, rendered.length - offset);
    const data = new Float32Array(n * CHANNELS);
    data.set(ch0.subarray(offset, offset + n), 0);
    data.set(ch1.subarray(offset, offset + n), n);
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: n,
      numberOfChannels: CHANNELS,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data,
    });
    encoder.encode(audioData);
    audioData.close();
  }
  await encoder.flush();
  if (encoderError) throw encoderError;

  return { muxerCodec, sampleRate, numberOfChannels: CHANNELS, chunks };
}

/** Safe wrapper: any audio failure degrades to a silent video, never a failed export. */
export async function tryEncodeMessageSoundTrack(
  project: ChatProject,
  durationSec: number,
  includeSounds: boolean,
): Promise<EncodedAudioTrack | null> {
  if (!includeSounds) return null;
  try {
    return await encodeMessageSoundTrack(project, durationSec);
  } catch (e) {
    console.warn('Sound track generation failed, exporting silent video:', e);
    return null;
  }
}
