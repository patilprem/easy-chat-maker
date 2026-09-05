export type Platform = 'whatsapp' | 'instagram' | 'messenger' | 'slack' | 'telegram' | 'discord' | 'chatgpt' | 'claude' | 'gemini';

/** AI assistant platforms: single-user chats, no group mode */
export const AI_PLATFORMS: Platform[] = ['chatgpt', 'claude', 'gemini'];
export function isAiPlatform(p: Platform): boolean {
  return AI_PLATFORMS.includes(p);
}

/** Story mode only offers the 4 most-used "chat story" apps — kept simple on purpose. */
export const STORY_PLATFORMS: Platform[] = ['whatsapp', 'instagram', 'messenger', 'telegram'];
export type Theme = 'light' | 'dark';
export type DeviceOS = 'ios' | 'android';

export interface Participant {
  id: string;
  name: string;
  username?: string;       // @handle for Instagram
  avatarMediaId?: string;  // IndexedDB key for uploaded image
  avatarUrl?: string;      // fallback: initials SVG data URL
  isSelf: boolean;         // true = right-side bubbles
}

export interface Reaction {
  emoji: string;
}

export interface TextMessage {
  id: string;
  kind: 'text';
  participantId: string;
  text: string;
  time?: string;
  reaction?: Reaction;
  replyToId?: string; // ID of message being quoted
}

export interface ImageMessage {
  id: string;
  kind: 'image';
  participantId: string;
  mediaId: string;
  objectUrl?: string;
  width?: number;
  height?: number;
  time?: string;
  reaction?: Reaction;
  replyToId?: string; // ID of message being quoted
}

export interface CallMessage {
  id: string;
  kind: 'call';
  participantId: string;
  isVoice: boolean;   // true = Voice, false = Video
  duration?: string;   // e.g. "1 min", "40 secs"
  status: 'missed' | 'completed' | 'declined';
  time?: string;
}

export interface VoiceNoteMessage {
  id: string;
  kind: 'voice';
  participantId: string;
  duration: string;    // e.g. "0:07"
  time?: string;
  reaction?: Reaction;
}

export interface SystemMessage {
  id: string;
  kind: 'system';
  text: string;
}

export interface DateMessage {
  id: string;
  kind: 'date';
  label: string;
}

export type Message = TextMessage | ImageMessage | CallMessage | VoiceNoteMessage | SystemMessage | DateMessage;

/**
 * Chat background ("wallpaper" on WhatsApp/Telegram, "chat theme" on
 * Instagram/Messenger). Every field is optional so projects saved before this
 * feature existed keep loading unchanged.
 */
export interface ChatBackground {
  /** Preset id from lib/backgrounds.ts. Cleared when a photo is used. */
  presetId?: string;
  /** IndexedDB key for an uploaded wallpaper photo. */
  mediaId?: string;
  /** Transient blob: URL for the photo — never persisted, re-resolved on load. */
  imageUrl?: string;
  /** Doodle/pattern overlay. Undefined = platform default (see showDoodle). */
  doodle?: boolean;
  /** 0–1 scrim over a photo wallpaper so bubbles stay readable. */
  dim?: number;
}

export interface ChatProject {
  id: string;
  platform: Platform;
  theme: Theme;
  deviceOS: DeviceOS;
  title: string;
  subtitle?: string;
  groupAvatarMediaId?: string;
  isGroup: boolean;
  participants: Participant[];
  messages: Message[];
  exportConsentAccepted: boolean;
  /** Playback/export pacing multiplier (1 = normal). Optional for backward compat with saved projects. */
  playbackSpeed?: number;
  /**
   * Clock shown in the phone's status bar, e.g. "9:41" or "21:07". Undefined
   * or blank falls back to the stock time for the device OS
   * (see DEFAULT_STATUS_BAR_TIME).
   */
  statusBarTime?: string;
  /** Chat wallpaper / theme. Undefined = the platform's stock background. */
  background?: ChatBackground;
  /** Story mode: chrome-less bubbles over a background, 9:16/16:9 export. */
  story?: StorySettings;
}

/** Output frame shape for Story mode. */
export type StoryAspect = '9:16' | '16:9';

/**
 * Story-mode background behind the chat column. Only one of
 * presetId/libraryId/mediaId applies, matching `kind`.
 */
export interface StoryBackground {
  kind: 'color' | 'library' | 'upload';
  /** kind: 'color' — id from lib/story/storyColors.ts */
  presetId?: string;
  /** kind: 'library' — id from lib/story/storyLibrary.ts */
  libraryId?: string;
  /** kind: 'upload' — IndexedDB key for the uploaded image/video */
  mediaId?: string;
  /** Transient blob: URL for the upload — never persisted, re-resolved on load. */
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  /** Gaussian blur in stage px. 0 = sharp. */
  blur?: number;
  /** 0–1 dark scrim over the whole background. */
  dim?: number;
  /** Loop the background video. Default true. */
  loop?: boolean;
  /** Seconds into the video to start playback/export from. */
  startOffsetSec?: number;
}

/** Story-mode background music bed, mixed under message sounds and voice. */
export interface StoryMusic {
  kind: 'library' | 'upload';
  /** kind: 'library' — id from lib/story/storyMusic.ts */
  libraryId?: string;
  /** kind: 'upload' — IndexedDB key for the uploaded audio file */
  mediaId?: string;
  /** Transient blob: URL for the upload — never persisted, re-resolved on load. */
  mediaUrl?: string;
  /** 0–1 music volume before ducking. */
  volume: number;
  /** Lower the music under a voiceover clip. Default true. */
  duckUnderVoice?: boolean;
}

/** Story-mode AI voiceover (Kokoro, generated locally in the browser). */
export interface StoryVoice {
  enabled: boolean;
  /** 0.8–1.3 playback speed multiplier for generated speech. */
  speed: number;
  /** participantId -> Kokoro voice id (see lib/tts/voices.ts) */
  voices: Record<string, string>;
  /** Use WebGPU (fp32, heavier download) instead of the wasm/q8 default. */
  preferWebGpu?: boolean;
}

export interface StorySettings {
  enabled: boolean;
  aspect: StoryAspect;
  background: StoryBackground;
  music?: StoryMusic;
  voice?: StoryVoice;
  /** 0–1 opacity of the dark rounded scrim behind the chat column. */
  scrim: number;
  showNamePill: boolean;
  /**
   * Keep the platform's own header (back arrow, avatar, name, call icons)
   * instead of stripping it along with the status bar and input bar — the
   * classic "texting story" look screenshots a real chat app UI over a
   * background video rather than floating bare bubbles. Turns the name pill
   * off implicitly in the UI (both would show the name twice) but the two
   * settings are independent, so this doesn't force it in data.
   */
  showHeader?: boolean;
  anchor?: 'top' | 'bottom';
  /**
   * 'scroll' (default/undefined) keeps scrolling forever, like the phone
   * exporter. 'cycle' clears the chat column and restarts from the top every
   * `cycleCount` bubbles — the "restart from top" rhythm used by
   * textingstory.app and similar chat-story videos.
   */
  feedStyle?: 'scroll' | 'cycle';
  /** Bubbles shown per page before restarting, when feedStyle is 'cycle'. Default 5. */
  cycleCount?: number;
}

export interface ParsedChatResult {
  participants: Participant[];
  messages: Message[];
  warnings: string[];
}

export interface FramePlan {
  visibleCount: number;
  typingParticipantId: string | null;
  activeReactionIds: string[];
  scrollY: number;
}
