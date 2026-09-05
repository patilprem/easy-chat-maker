/**
 * Free, instant voiceover for the live editor preview using the browser's
 * built-in speech synthesis (Web Speech API) — zero download, works the
 * moment voice is turned on. This is intentionally NOT what gets baked into
 * an exported video: SpeechSynthesis only plays through the speakers, it
 * never hands back audio samples, so there's nothing to mix into an MP4.
 * Export instead generates real audio with Kokoro (lib/tts/kokoro.ts), whose
 * one-time model download only happens if/when the user exports with
 * voiceover enabled.
 */

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (typeof speechSynthesis === 'undefined') return [];
  const voices = speechSynthesis.getVoices();
  if (voices.length) cachedVoices = voices;
  return cachedVoices;
}

if (typeof speechSynthesis !== 'undefined') {
  loadVoices();
  // Most browsers load the voice list asynchronously after first touching the API.
  speechSynthesis.onvoiceschanged = loadVoices;
}

const FEMALE_HINTS = /female|woman|samantha|victoria|karen|zira|susan|fiona|moira|tessa/i;
const MALE_HINTS = /male|man|daniel|alex|fred|david|mark|george|thomas/i;

/** A stable-ish, varied voice per participant from whatever this OS/browser has installed. */
function pickVoice(participantIndex: number, isSelf: boolean): SpeechSynthesisVoice | undefined {
  const voices = loadVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (voices.length === 0) return undefined;
  const female = voices.filter((v) => FEMALE_HINTS.test(v.name));
  const male = voices.filter((v) => MALE_HINTS.test(v.name));
  const pool = isSelf ? (male.length ? male : voices) : (female.length ? female : voices);
  return pool[Math.max(0, participantIndex) % pool.length];
}

export function isPreviewVoiceSupported(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

/** Speaks one line immediately. Cancels whatever was speaking before it (bubbles reveal faster than long lines finish). */
export function speakPreview(text: string, participantIndex: number, isSelf: boolean, speed = 1): void {
  if (!isPreviewVoiceSupported() || !text.trim()) return;
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(participantIndex, isSelf);
  if (voice) utter.voice = voice;
  utter.rate = Math.min(1.6, Math.max(0.7, speed));
  speechSynthesis.speak(utter);
}

export function stopPreviewVoice(): void {
  if (isPreviewVoiceSupported()) speechSynthesis.cancel();
}
