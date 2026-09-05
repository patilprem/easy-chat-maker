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
export function speakPreview(text: string, participantIndex: number, isSelf: boolean, speed = 1, onEnd?: () => void): void {
  if (!isPreviewVoiceSupported() || !text.trim()) {
    onEnd?.();
    return;
  }
  speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  const voice = pickVoice(participantIndex, isSelf);
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
