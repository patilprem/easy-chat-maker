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
