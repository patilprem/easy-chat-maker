/**
 * Per-message "voice tone" for story mode voiceover.
 *
 * Kokoro (the free in-browser TTS, see lib/tts/kokoro.ts) has no emotion
 * control — it only takes a voice and a speed — so a tone is an
 * approximation built from three things it *does* react to:
 *
 *  1. `speedMul`   — generation speed (sad drags, angry rushes);
 *  2. `hintText`   — punctuation nudges fed to the model ("!" lifts the
 *                    energy, "..." adds pauses and drag). Only punctuation
 *                    is touched, never the words, so the spoken line still
 *                    matches the bubble;
 *  3. `rate`/`gain`/filters — an offline Web Audio pass over the generated
 *                    clip (see lib/tts/toneFx.ts): slight pitch shift,
 *                    loudness, and a breathy band-pass for whisper.
 *
 * Whisper, sad and angry come across clearly; happy and romantic are
 * subtler — real emotional speech needs an emotion-capable engine.
 */

export type Tone = 'happy' | 'sad' | 'romantic' | 'angry' | 'whisper';

export interface ToneSpec {
  id: Tone;
  emoji: string;
  label: string;
  /** Multiplier on the user's voice speed at generation time. */
  speedMul: number;
  /** Playback-rate (pitch+tempo) applied to the generated clip. */
  rate: number;
  /** Linear gain applied to the clip. */
  gain: number;
  /** Squash peaks so a loud tone can't clip. */
  compress?: boolean;
  lowpassHz?: number;
  highpassHz?: number;
  /** Punctuation-only rewrite of the spoken text. */
  hintText: (text: string) => string;
}

/** Ends the sentence with `ending`, replacing a bare "." / "!" / "?" chain when asked. */
function endWith(text: string, ending: string, replaceQuestion = false): string {
  const t = text.trim();
  if (!t) return t;
  const m = /[.!?…]+$/.exec(t);
  if (!m) return `${t}${ending}`;
  if (!replaceQuestion && m[0].includes('?')) return t;
  return `${t.slice(0, m.index)}${ending}`;
}

/** Sad/romantic pacing: a pause after the first clause of a long line. */
function addMidPause(text: string): string {
  if (text.length < 40 || /[,;:…]/.test(text)) return text;
  const words = text.split(' ');
  const cut = Math.max(3, Math.floor(words.length / 2));
  return `${words.slice(0, cut).join(' ')}, ${words.slice(cut).join(' ')}`;
}

export const TONES: ToneSpec[] = [
  {
    id: 'happy', emoji: '😊', label: 'Happy',
    speedMul: 1.08, rate: 1.04, gain: 1.0,
    hintText: (t) => endWith(t, '!'),
  },
  {
    id: 'sad', emoji: '😢', label: 'Sad',
    speedMul: 0.85, rate: 0.94, gain: 0.85,
    hintText: (t) => endWith(addMidPause(t), '...', true),
  },
  {
    id: 'romantic', emoji: '❤️', label: 'Romantic',
    speedMul: 0.9, rate: 0.97, gain: 0.8, lowpassHz: 6000,
    hintText: (t) => endWith(addMidPause(t), '...'),
  },
  {
    id: 'angry', emoji: '😠', label: 'Angry',
    speedMul: 1.12, rate: 1.0, gain: 1.25, compress: true,
    hintText: (t) => endWith(t, '!', true),
  },
  {
    id: 'whisper', emoji: '🤫', label: 'Whisper',
    speedMul: 0.95, rate: 1.0, gain: 0.45, highpassHz: 300, lowpassHz: 4500,
    hintText: (t) => t,
  },
];

export function toneById(id: string | undefined | null): ToneSpec | undefined {
  return id ? TONES.find((t) => t.id === id) : undefined;
}

/** Accepts the id ("sad"), the label ("Sad") or the emoji ("😢"). */
export function parseToneToken(token: string): Tone | undefined {
  const t = token.trim().toLowerCase();
  return TONES.find((s) => s.id === t || s.label.toLowerCase() === t || s.emoji === token.trim())?.id;
}
