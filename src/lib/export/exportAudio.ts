import type { ChatProject } from '../parser/types';
import { buildRevealSchedule, soundEventsFromSchedule, type RevealSchedule } from '../video/chatTimeline';
import { getMedia } from '../media/mediaStore';
import type { VoiceClip } from '../tts/kokoro';

/**
 * Browser-side audio track for the WebCodecs exporters: renders message
 * sounds (and, for story mode, background music and AI voiceover) at their
 * timeline positions with an OfflineAudioContext and encodes the mix to
 * AAC/Opus. Best-effort — returns null (silent video) when the browser lacks
 * AudioEncoder support or nothing could be decoded.
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

async function fetchSoundBuffer(ctx: BaseAudioContext, urls: string[]): Promise<AudioBuffer | null> {
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

async function encodeRenderedBuffer(
  rendered: AudioBuffer,
  config: AudioEncoderConfig,
  muxerCodec: 'aac' | 'opus',
): Promise<EncodedAudioTrack> {
  const sampleRate = config.sampleRate;
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

export async function encodeMessageSoundTrack(
  project: ChatProject,
  durationSec: number,
): Promise<EncodedAudioTrack | null> {
  if (typeof AudioEncoder === 'undefined' || typeof OfflineAudioContext === 'undefined') return null;

  const schedule = buildRevealSchedule(project.messages, project.participants, { speed: project.playbackSpeed });
  const events = soundEventsFromSchedule(schedule, project.participants);
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
  return encodeRenderedBuffer(rendered, config, muxerCodec);
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

// ---- Story mode: message sounds + background music + AI voiceover ----

async function decodeMusicBuffer(ctx: BaseAudioContext, project: ChatProject): Promise<AudioBuffer | null> {
  const music = project.story?.music;
  if (!music) return null;
  try {
    let arrayBuffer: ArrayBuffer;
    if (music.kind === 'upload' && music.mediaId) {
      const item = await getMedia(music.mediaId);
      if (!item) return null;
      arrayBuffer = await item.blob.arrayBuffer();
    } else if (music.mediaUrl) {
      const response = await fetch(music.mediaUrl);
      if (!response.ok) return null;
      arrayBuffer = await response.arrayBuffer();
    } else {
      return null;
    }
    return await ctx.decodeAudioData(arrayBuffer);
  } catch {
    return null;
  }
}

/**
 * Renders the full story audio bed: message sounds at their reveal times,
 * an optional looping music bed (ducked under any voice clip), and optional
 * AI voiceover clips at each text message's reveal time.
 */
export async function encodeStoryAudioTrack(
  project: ChatProject,
  schedule: RevealSchedule,
  voiceClips: Map<string, VoiceClip> | null,
  durationSec: number,
  includeSounds: boolean,
): Promise<EncodedAudioTrack | null> {
  if (typeof AudioEncoder === 'undefined' || typeof OfflineAudioContext === 'undefined') return null;
  if (durationSec <= 0) return null;

  const negotiated = await negotiateAudioConfig();
  if (!negotiated) return null;
  const { config, muxerCodec } = negotiated;
  const sampleRate = config.sampleRate;

  const offline = new OfflineAudioContext(CHANNELS, Math.ceil(durationSec * sampleRate), sampleRate);
  let hasAnyAudio = false;

  // Message sounds
  if (includeSounds) {
    const events = soundEventsFromSchedule(schedule, project.participants);
    if (events.length > 0) {
      const buffers = new Map<SoundName, AudioBuffer | null>();
      for (const name of [...new Set(events.map((e) => e.sound))]) {
        buffers.set(name, await fetchSoundBuffer(offline, soundUrls(name, project.platform)));
      }
      const soundGain = offline.createGain();
      soundGain.gain.value = SOUND_VOLUME;
      soundGain.connect(offline.destination);
      for (const event of events) {
        const buffer = buffers.get(event.sound);
        if (!buffer || event.timeSec >= durationSec) continue;
        const source = offline.createBufferSource();
        source.buffer = buffer;
        source.connect(soundGain);
        source.start(event.timeSec);
        hasAnyAudio = true;
      }
    }
  }

  // Voiceover — one buffer per reveal, scheduled at its reveal time.
  const voiceRanges: { startSec: number; endSec: number }[] = [];
  if (voiceClips && voiceClips.size > 0) {
    const voiceGain = offline.createGain();
    voiceGain.gain.value = 1;
    voiceGain.connect(offline.destination);
    for (const r of schedule.reveals) {
      const clip = voiceClips.get(r.msgId);
      if (!clip) continue;
      const startSec = r.revealFrame / schedule.fps;
      if (startSec >= durationSec) continue;
      const buffer = offline.createBuffer(1, clip.samples.length, clip.sampleRate);
      // Normalize to a plain ArrayBuffer-backed Float32Array: `samples` may
      // come from a library (Kokoro) whose typed array is backed by a more
      // general ArrayBufferLike, which copyToChannel's stricter type rejects.
      buffer.copyToChannel(new Float32Array(clip.samples), 0);
      const source = offline.createBufferSource();
      source.buffer = buffer;
      source.connect(voiceGain);
      source.start(startSec);
      voiceRanges.push({ startSec, endSec: startSec + clip.durationSec });
      hasAnyAudio = true;
    }
  }

  // Background music — loops under everything, ducked under each voice clip.
  const music = project.story?.music;
  if (music) {
    const musicBuffer = await decodeMusicBuffer(offline, project);
    if (musicBuffer) {
      const musicGain = offline.createGain();
      const volume = music.volume ?? 0.35;
      musicGain.connect(offline.destination);
      const duckUnder = music.duckUnderVoice !== false && voiceRanges.length > 0;
      const duckedVolume = duckUnder ? volume * 0.25 : volume;

      if (duckUnder) {
        musicGain.gain.setValueAtTime(volume, 0);
        for (const range of voiceRanges) {
          const rampStart = Math.max(0, range.startSec - 0.15);
          musicGain.gain.linearRampToValueAtTime(duckedVolume, Math.max(rampStart, 0.01));
          musicGain.gain.setValueAtTime(duckedVolume, range.endSec);
          musicGain.gain.linearRampToValueAtTime(volume, range.endSec + 0.35);
        }
      } else {
        musicGain.gain.setValueAtTime(volume, 0);
      }
      // Fade the very end so a looped track doesn't cut off abruptly.
      const fadeStart = Math.max(0, durationSec - 1.2);
      musicGain.gain.setValueAtTime(duckUnder ? duckedVolume : volume, fadeStart);
      musicGain.gain.linearRampToValueAtTime(0, durationSec);

      const loopDuration = musicBuffer.duration;
      for (let t = 0; t < durationSec && loopDuration > 0; t += loopDuration) {
        const source = offline.createBufferSource();
        source.buffer = musicBuffer;
        source.connect(musicGain);
        source.start(t);
      }
      hasAnyAudio = true;
    }
  }

  if (!hasAnyAudio) return null;

  const rendered = await offline.startRendering();
  return encodeRenderedBuffer(rendered, config, muxerCodec);
}

/** Safe wrapper: any audio failure degrades to a silent video, never a failed export. */
export async function tryEncodeStoryAudioTrack(
  project: ChatProject,
  schedule: RevealSchedule,
  voiceClips: Map<string, VoiceClip> | null,
  durationSec: number,
  includeSounds: boolean,
): Promise<EncodedAudioTrack | null> {
  try {
    return await encodeStoryAudioTrack(project, schedule, voiceClips, durationSec, includeSounds);
  } catch (e) {
    console.warn('Story audio mix failed, exporting silent video:', e);
    return null;
  }
}
