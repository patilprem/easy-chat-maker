export type Platform = 'whatsapp' | 'instagram' | 'messenger' | 'slack' | 'telegram' | 'discord' | 'chatgpt' | 'claude' | 'gemini';

/** AI assistant platforms: single-user chats, no group mode */
export const AI_PLATFORMS: Platform[] = ['chatgpt', 'claude', 'gemini'];
export function isAiPlatform(p: Platform): boolean {
  return AI_PLATFORMS.includes(p);
}
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
