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
import { resolveGender } from './voices';

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

// "Google US English" (Chrome's common network TTS default on many setups)
// is a female voice but its name carries no gender word at all — called
// out explicitly since it's often the ONLY quality/natural-sounding voice
// available, which otherwise defeats the fallback logic below.
const FEMALE_HINTS = /female|woman|samantha|victoria|karen|zira|susan|fiona|moira|tessa|aria|jenny|zoe|hazel|^google us english$/i;
const MALE_HINTS = /male|man|daniel|alex|fred|david|mark|george|thomas|guy|ryan|eric/i;
// The same "sounds AI-generated" complaint applies to legacy OS voices — a
// modern "Natural"/"Neural"/"Online" voice (most current Windows/Chrome/Mac
// installs have at least one) sounds dramatically less robotic than the
// old offline SAPI/eSpeak defaults, so prefer those when more than one
// candidate voice is available.
const QUALITY_HINTS = /natural|neural|online|premium|enhanced|google/i;

/** A stable-ish, varied, natural-leaning voice per participant from whatever this OS/browser has installed. */
function pickVoice(participantIndex: number, participantName?: string): SpeechSynthesisVoice | undefined {
  const voices = loadVoices().filter((v) => v.lang.toLowerCase().startsWith('en'));
  if (voices.length === 0) return undefined;
  const female = voices.filter((v) => FEMALE_HINTS.test(v.name));
  const male = voices.filter((v) => MALE_HINTS.test(v.name));
  const gender = resolveGender(participantIndex, participantName);
  const targetPool = gender === 'male' ? male : female;
  const oppositePool = gender === 'male' ? female : male;
  // No positively-identified voice for the target gender? Fall back to
  // whatever's left EXCLUDING voices we know belong to the other gender —
  // falling back to the full unfiltered list could land squarely on a
  // known-opposite-gender voice (like "Google US English" for a male
  // participant) purely because its name happens to also match the
  // "sounds natural" filter below.
  const safeFallback = voices.filter((v) => !oppositePool.includes(v));
  const pool = targetPool.length ? targetPool : (safeFallback.length ? safeFallback : voices);
  const natural = pool.filter((v) => QUALITY_HINTS.test(v.name));
  const ranked = natural.length ? natural : pool;
  return ranked[Math.max(0, participantIndex) % ranked.length];
}

export function isPreviewVoiceSupported(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

// Generous ceiling in case a browser/voice combo never fires 'end' (seen
// occasionally on some platforms) — without this, playback could freeze
// forever waiting for a callback that's never coming.
const MAX_UTTERANCE_WAIT_MS = 15000;

/**
 * Speaks one line immediately and reports back when it's actually done, so
 * the caller can hold the next bubble until narration for this one
 * finishes — voice and bubbles stay in sync instead of the bubble racing
 * ahead on a fixed timer. Cancels whatever was speaking before it (bubbles
 * can reveal faster than a long line takes to read if something goes wrong
 * upstream).
 */
export function speakPreview(text: string, participantIndex: number, participantName: string | undefined, speed = 1, onEnd?: () => void): void {
  if (!isPreviewVoiceSupported() || !text.trim()) {
    onEnd?.();
    return;
  }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(participantIndex, participantName);
  if (voice) utter.voice = voice;
  utter.rate = Math.min(1.6, Math.max(0.7, speed));

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearTimeout(timer);
    onEnd?.();
  };
  const timer = window.setTimeout(finish, MAX_UTTERANCE_WAIT_MS);
  utter.onend = finish;
  utter.onerror = finish;

  speechSynthesis.speak(utter);
}

export function stopPreviewVoice(): void {
  if (isPreviewVoiceSupported()) speechSynthesis.cancel();
}
