/**
 * Kokoro-82M's English voices (see node_modules/kokoro-js/types/voices.d.ts
 * for the full metadata Kokoro ships). American ("af_"/"am_") and British
 * ("bf_"/"bm_") only — Kokoro has no other languages, so story voiceover is
 * an English-only feature for now.
 */
export interface TtsVoice {
  id: string;
  label: string;
  accent: 'US' | 'UK';
  gender: 'female' | 'male';
}

export const TTS_VOICES: TtsVoice[] = [
  { id: 'af_heart', label: 'Heart', accent: 'US', gender: 'female' },
  { id: 'af_bella', label: 'Bella', accent: 'US', gender: 'female' },
  { id: 'af_nicole', label: 'Nicole', accent: 'US', gender: 'female' },
  { id: 'af_aoede', label: 'Aoede', accent: 'US', gender: 'female' },
  { id: 'af_kore', label: 'Kore', accent: 'US', gender: 'female' },
  { id: 'af_sarah', label: 'Sarah', accent: 'US', gender: 'female' },
  { id: 'af_nova', label: 'Nova', accent: 'US', gender: 'female' },
  { id: 'af_sky', label: 'Sky', accent: 'US', gender: 'female' },
  { id: 'af_alloy', label: 'Alloy', accent: 'US', gender: 'female' },
  { id: 'af_jessica', label: 'Jessica', accent: 'US', gender: 'female' },
  { id: 'am_michael', label: 'Michael', accent: 'US', gender: 'male' },
  { id: 'am_fenrir', label: 'Fenrir', accent: 'US', gender: 'male' },
  { id: 'am_puck', label: 'Puck', accent: 'US', gender: 'male' },
  { id: 'am_echo', label: 'Echo', accent: 'US', gender: 'male' },
  { id: 'am_eric', label: 'Eric', accent: 'US', gender: 'male' },
  { id: 'am_liam', label: 'Liam', accent: 'US', gender: 'male' },
  { id: 'am_onyx', label: 'Onyx', accent: 'US', gender: 'male' },
  { id: 'am_adam', label: 'Adam', accent: 'US', gender: 'male' },
  { id: 'bf_emma', label: 'Emma', accent: 'UK', gender: 'female' },
  { id: 'bf_isabella', label: 'Isabella', accent: 'UK', gender: 'female' },
  { id: 'bf_alice', label: 'Alice', accent: 'UK', gender: 'female' },
  { id: 'bf_lily', label: 'Lily', accent: 'UK', gender: 'female' },
  { id: 'bm_george', label: 'George', accent: 'UK', gender: 'male' },
  { id: 'bm_lewis', label: 'Lewis', accent: 'UK', gender: 'male' },
  { id: 'bm_daniel', label: 'Daniel', accent: 'UK', gender: 'male' },
  { id: 'bm_fable', label: 'Fable', accent: 'UK', gender: 'male' },
];

const DEFAULT_FEMALE_ROTATION = ['af_heart', 'af_bella', 'bf_emma', 'af_nova'];
const DEFAULT_MALE_ROTATION = ['am_michael', 'am_fenrir', 'bm_george', 'am_liam'];

/** A stable, varied default voice per participant so a group chat doesn't sound like one person. */
export function defaultVoiceFor(participantIndex: number, isSelf: boolean): string {
  const rotation = isSelf ? DEFAULT_MALE_ROTATION : DEFAULT_FEMALE_ROTATION;
  return rotation[participantIndex % rotation.length];
}

export function findVoice(id: string | undefined): TtsVoice {
  return TTS_VOICES.find((v) => v.id === id) ?? TTS_VOICES[0];
}
