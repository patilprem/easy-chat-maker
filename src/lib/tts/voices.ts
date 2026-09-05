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

// Reordered to lead with Kokoro's most natural-sounding voices (the ones
// with the best community-reported training quality) instead of just the
// first ones in the model's own list — every voice above is still
// user-selectable in VoicePanel, this only changes what gets auto-assigned.
const DEFAULT_FEMALE_ROTATION = ['af_heart', 'af_bella', 'af_nicole', 'bf_emma'];
const DEFAULT_MALE_ROTATION = ['am_michael', 'am_fenrir', 'am_puck', 'bm_george'];

export type Gender = 'female' | 'male';

/**
 * Common first names, lowercased, spanning several languages/cultures so a
 * chat with names like "Aisha" or "Kenji" gets a matching voice, not just
 * Anglo ones. Necessarily incomplete — this is a local best-effort lookup
 * (no network calls), not a real gender-detection service. An unrecognized
 * or unisex name falls back to alternating by seat order instead of
 * guessing wrong with false confidence.
 */
const FEMALE_NAMES = new Set([
  'aisha', 'amelia', 'olivia', 'emma', 'ava', 'sophia', 'isabella', 'mia', 'charlotte', 'amara',
  'harper', 'evelyn', 'abigail', 'emily', 'elizabeth', 'sofia', 'ella', 'scarlett', 'grace', 'chloe',
  'victoria', 'riley', 'aria', 'lily', 'aubrey', 'zoey', 'penelope', 'lillian', 'addison', 'layla',
  'natalie', 'camila', 'hannah', 'brooklyn', 'zoe', 'nora', 'leah', 'savannah', 'audrey', 'claire',
  'eleanor', 'skylar', 'ellie', 'samantha', 'stella', 'paisley', 'violet', 'mila', 'allison', 'alice',
  'madelyn', 'cora', 'ruby', 'eva', 'serenity', 'autumn', 'adeline', 'hazel', 'madison', 'ivy',
  'jasmine', 'sarah', 'sara', 'nicole', 'rachel', 'laura', 'lauren', 'megan', 'kayla', 'jessica',
  'jennifer', 'amanda', 'ashley', 'katherine', 'kate', 'anna', 'anne', 'maria', 'mary', 'linda',
  'susan', 'karen', 'nancy', 'lisa', 'betty', 'margaret', 'sandra', 'donna', 'carol', 'ruth',
  'sharon', 'michelle', 'catherine', 'julie', 'joyce', 'diane', 'alice', 'julia', 'joan', 'evelyn',
  'priya', 'anjali', 'neha', 'pooja', 'kavya', 'divya', 'ananya', 'meera', 'sunita', 'lakshmi',
  'deepika', 'shreya', 'aditi', 'nisha', 'ritu', 'sneha', 'swati', 'preethi', 'anita', 'geeta',
  'fatima', 'zainab', 'maryam', 'noor', 'yasmin', 'layla', 'huda', 'amina', 'sara', 'rania',
  'lina', 'nadia', 'salma', 'dalia', 'reem', 'hana', 'mei', 'ling', 'xia', 'yan', 'fang', 'jing',
  'yuki', 'sakura', 'hana', 'yui', 'akari', 'aoi', 'rin', 'mio', 'saki', 'nana',
  'jimin', 'jiwoo', 'seoyeon', 'jia', 'yuna', 'soojin', 'minji',
  'sofia', 'valentina', 'camila', 'luciana', 'isabela', 'ana', 'carmen', 'elena', 'lucia', 'gabriela',
  'chiara', 'giulia', 'francesca', 'alessia', 'martina', 'sara', 'giorgia',
  'ingrid', 'freya', 'astrid', 'greta', 'saoirse', 'niamh', 'aoife', 'siobhan',
  'chioma', 'ngozi', 'amara', 'zuri', 'thandiwe', 'nia', 'kesi',
]);

const MALE_NAMES = new Set([
  'mateo', 'liam', 'noah', 'oliver', 'james', 'elijah', 'william', 'benjamin', 'lucas', 'henry',
  'alexander', 'mason', 'michael', 'ethan', 'daniel', 'jacob', 'logan', 'jackson', 'levi', 'sebastian',
  'mateo', 'jack', 'owen', 'theodore', 'aiden', 'samuel', 'joseph', 'john', 'david', 'wyatt',
  'matthew', 'luke', 'asher', 'carter', 'julian', 'grayson', 'leo', 'jayden', 'gabriel', 'isaac',
  'lincoln', 'anthony', 'hudson', 'dylan', 'ezra', 'thomas', 'charles', 'christopher', 'jaxon', 'maverick',
  'josiah', 'isaiah', 'andrew', 'elias', 'joshua', 'nathan', 'caleb', 'ryan', 'adrian', 'miles',
  'eli', 'nolan', 'christian', 'aaron', 'cameron', 'ezekiel', 'colton', 'luca', 'landon', 'hunter',
  'kenji', 'hiroshi', 'takeshi', 'satoshi', 'daiki', 'haruto', 'yuto', 'ren', 'sora', 'kaito',
  'raj', 'amit', 'vikram', 'arjun', 'rohit', 'sanjay', 'ravi', 'ajay', 'anil', 'suresh',
  'karthik', 'vijay', 'deepak', 'manish', 'rahul', 'nikhil', 'aditya', 'kunal', 'varun', 'arun',
  'ahmed', 'mohammed', 'muhammad', 'ali', 'omar', 'hassan', 'hussein', 'khalid', 'youssef', 'karim',
  'tariq', 'bilal', 'zaid', 'ibrahim', 'yusuf', 'faisal', 'samir', 'nabil',
  'jian', 'wei', 'ming', 'chen', 'hao', 'lei', 'jun', 'feng',
  'minjun', 'jihoon', 'seojun', 'dohyun', 'joon',
  'diego', 'mateo', 'santiago', 'sebastian', 'alejandro', 'javier', 'carlos', 'miguel', 'pablo', 'rafael',
  'luca', 'matteo', 'alessandro', 'lorenzo', 'francesco', 'marco', 'giovanni',
  'erik', 'lars', 'magnus', 'oskar', 'anders', 'liam', 'connor', 'declan', 'finn', 'cian',
  'chidi', 'obi', 'kwame', 'kofi', 'sipho', 'thabo', 'jabari',
  'robert', 'richard', 'william', 'george', 'kenneth', 'steven', 'edward', 'brian', 'ronald', 'kevin',
  'jason', 'jeff', 'jeffrey', 'gary', 'timothy', 'jose', 'larry', 'jerry', 'dennis', 'walter',
]);

/**
 * Local, best-effort gender guess from a participant's first name — no
 * network calls, and necessarily incomplete. Returns null for an
 * unrecognized or ambiguous/unisex name rather than guessing with false
 * confidence; callers should fall back to alternating by seat order.
 */
export function detectGenderFromName(name: string): Gender | null {
  const first = name.trim().split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
  if (!first) return null;
  if (FEMALE_NAMES.has(first)) return 'female';
  if (MALE_NAMES.has(first)) return 'male';
  return null;
}

/** Detected from the participant's name when possible, else alternates by seat order — never assumes "self" is any particular gender. */
export function resolveGender(participantIndex: number, participantName?: string): Gender {
  return detectGenderFromName(participantName ?? '') ?? (participantIndex % 2 === 0 ? 'female' : 'male');
}

/** A stable, varied default voice per participant so a group chat doesn't sound like one person. */
export function defaultVoiceFor(participantIndex: number, participantName?: string): string {
  const rotation = resolveGender(participantIndex, participantName) === 'male' ? DEFAULT_MALE_ROTATION : DEFAULT_FEMALE_ROTATION;
  return rotation[participantIndex % rotation.length];
}

export function findVoice(id: string | undefined): TtsVoice {
  return TTS_VOICES.find((v) => v.id === id) ?? TTS_VOICES[0];
}
