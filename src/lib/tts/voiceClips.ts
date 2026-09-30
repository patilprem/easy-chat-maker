import type { ChatProject } from '../parser/types';
import { ttsCapability } from './capability';
import { speak, type VoiceClip } from './kokoro';
import { cacheKeyFor, getCachedClip, putCachedClip } from './voiceCache';
import { assignVoicesForParticipants } from './voices';
import { toneById } from '../story/tones';
import { applyTone } from './toneFx';

export type VoiceClipProgress = (msg: string, pct: number) => void;

/** Kokoro mispronounces emoji and reads out full URLs — normalize before synthesis. */
export function normalizeForSpeech(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, 'link')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class VoiceUnsupportedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'VoiceUnsupportedError';
  }
}

/**
 * Generates (or reuses cached) voice clips for every text message in the
 * chat, keyed by message id. Story mode's exporter uses the durations to
 * stretch each bubble's hold time to match its spoken line
 * (see buildRevealSchedule's holdSecById), then mixes the clips into the
 * final audio track (see exportAudio.encodeStoryAudioTrack).
 */
export async function ensureVoiceClips(
  project: ChatProject,
  onProgress?: VoiceClipProgress,
): Promise<Map<string, VoiceClip>> {
  const voiceSettings = project.story?.voice;
  if (!voiceSettings?.enabled) return new Map();

  const cap = ttsCapability(voiceSettings.preferWebGpu);
  if (!cap.ok) throw new VoiceUnsupportedError(cap.reason ?? 'Voiceover is not supported on this device.');

  const textMessages = project.messages.filter((m) => m.kind === 'text' && m.text.trim().length > 0);
  if (textMessages.length === 0) return new Map();

  const speed = voiceSettings.speed || 1;
  const clips = new Map<string, VoiceClip>();
  // Assigned once across every participant so nobody silently shares a
  // voice with someone else in the same chat (see assignVoicesForParticipants).
  const defaultVoices = assignVoicesForParticipants(project.participants);

  onProgress?.('Loading voice model…', 2);
  let modelReady = false;

  for (let i = 0; i < textMessages.length; i++) {
    const msg = textMessages[i];
    if (msg.kind !== 'text') continue;
    const voiceId = voiceSettings.voices[msg.participantId] ?? defaultVoices[msg.participantId];
    // A tone nudges the generation itself (speed + punctuation hints) and
    // then post-processes the clip (see lib/story/tones.ts). The nudged
    // speed/text make their own cache entry, so the base clip stays cached.
    const tone = toneById(msg.tone);
    const baseText = normalizeForSpeech(msg.text);
    const spokenText = tone ? tone.hintText(baseText) : baseText;
    if (!spokenText) continue;
    const msgSpeed = tone ? Math.min(2, Math.max(0.5, speed * tone.speedMul)) : speed;

    const key = await cacheKeyFor(voiceId, msgSpeed, spokenText);
    const cached = await getCachedClip(key);
    let clip: VoiceClip;
    if (cached) {
      clip = { samples: cached.samples, sampleRate: cached.sampleRate, durationSec: cached.durationSec };
    } else {
      clip = await speak(cap.device, spokenText, voiceId, msgSpeed, (p) => {
        if (!modelReady) onProgress?.(`Loading voice model… ${p.pct}%`, Math.round(p.pct * 0.3));
        if (p.status === 'ready') modelReady = true;
      });
      await putCachedClip(key, clip);
    }
    clips.set(msg.id, tone ? await applyTone(clip, tone) : clip);
    onProgress?.(`Generating voice ${i + 1}/${textMessages.length}`, 5 + Math.round((i / textMessages.length) * 90));
  }

  onProgress?.('Voiceover ready', 100);
  return clips;
}
