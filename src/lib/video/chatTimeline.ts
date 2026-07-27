import type { Message, FramePlan, Participant } from '../parser/types';

const FPS = 30;
// Base pacing at 1x speed; buildFramePlan/buildSoundEvents divide these by the
// requested speed so a higher speed means fewer frames between reveals.
const TYPING_FRAMES_BASE = FPS * 1.45;  // typing indicator before incoming bubbles
const PAUSE_FRAMES_BASE = FPS * 0.9;    // hold after each bubble appears
const INSTANT_PAUSE_BASE = FPS * 0.45;  // date/system chips
const REACTION_DELAY_BASE = FPS * 0.5;  // frames after bubble before reaction shows
const END_HOLD_BASE = FPS * 2.5;        // final hold

function normalizeSpeed(speed?: number): number {
  return typeof speed === 'number' && Number.isFinite(speed) && speed > 0 ? speed : 1;
}

interface MessageReveal {
  msgId: string;
  kind: string;
  participantId?: string;
  showsTyping: boolean;
  hasReaction: boolean;
  startFrame: number;
  revealFrame: number;
  reactionFrame: number;
}

export function buildFramePlan(messages: Message[], participants: Participant[] = [], speed?: number): FramePlan[] {
  const s = normalizeSpeed(speed);
  const TYPING_FRAMES = Math.round(TYPING_FRAMES_BASE / s);
  const PAUSE_FRAMES = Math.round(PAUSE_FRAMES_BASE / s);
  const INSTANT_PAUSE = Math.round(INSTANT_PAUSE_BASE / s);
  const REACTION_DELAY = Math.round(REACTION_DELAY_BASE / s);
  const END_HOLD = Math.round(END_HOLD_BASE / s);

  const reveals: MessageReveal[] = [];
  const selfParticipantIds = new Set(participants.filter((p) => p.isSelf).map((p) => p.id));
  let frame = 0;

  // Compute the Y position each message would appear at (approximate: 80px per bubble)
  const MSG_HEIGHT = 80;
  const PHONE_HEIGHT = 844 - 56 - 60 - 56; // minus header, status bar, input bar

  for (const msg of messages) {
    if (msg.kind === 'system' || msg.kind === 'date') {
      const startFrame = frame;
      reveals.push({
        msgId: msg.id,
        kind: msg.kind,
        showsTyping: false,
        hasReaction: false,
        startFrame,
        revealFrame: startFrame,
        reactionFrame: -1,
      });
      frame += INSTANT_PAUSE;
    } else if (msg.kind === 'text' || msg.kind === 'image' || msg.kind === 'voice') {
      const startFrame = frame;
      const revealFrame = frame + TYPING_FRAMES;
      const hasReaction = !!(msg.reaction?.emoji);
      const showsTyping = !selfParticipantIds.has(msg.participantId);
      reveals.push({
        msgId: msg.id,
        kind: msg.kind,
        participantId: msg.participantId,
        showsTyping,
        hasReaction,
        startFrame,
        revealFrame,
        reactionFrame: hasReaction ? revealFrame + REACTION_DELAY : -1,
      });
      frame = revealFrame + PAUSE_FRAMES;
    }
  }

  const totalFrames = frame + END_HOLD;
  const plans: FramePlan[] = [];

  for (let f = 0; f < totalFrames; f++) {
    let visibleCount = 0;
    let typingParticipantId: string | null = null;
    const activeReactionIds: string[] = [];

    for (const r of reveals) {
      if (f < r.startFrame) break;

      if (f >= r.revealFrame) {
        visibleCount++;
        if (r.hasReaction && r.reactionFrame !== -1 && f >= r.reactionFrame) {
          activeReactionIds.push(r.msgId);
        }
      } else {
        // In typing phase
        if (r.participantId && r.showsTyping) typingParticipantId = r.participantId;
      }
    }

    // Scroll Y: keep the latest visible message in view
    const scrollY = Math.max(0, visibleCount * MSG_HEIGHT - PHONE_HEIGHT);

    plans.push({ visibleCount, typingParticipantId, activeReactionIds, scrollY });
  }

  return plans;
}

export interface SoundEvent {
  timeSec: number;
  sound: 'send' | 'receive' | 'reaction';
}

/**
 * When each message sound should play, mirroring buildFramePlan's frame
 * arithmetic so sounds land exactly when bubbles/reactions become visible.
 */
export function buildSoundEvents(messages: Message[], participants: Participant[] = [], speed?: number): SoundEvent[] {
  const s = normalizeSpeed(speed);
  const TYPING_FRAMES = Math.round(TYPING_FRAMES_BASE / s);
  const PAUSE_FRAMES = Math.round(PAUSE_FRAMES_BASE / s);
  const INSTANT_PAUSE = Math.round(INSTANT_PAUSE_BASE / s);
  const REACTION_DELAY = Math.round(REACTION_DELAY_BASE / s);

  const selfParticipantIds = new Set(participants.filter((p) => p.isSelf).map((p) => p.id));
  const events: SoundEvent[] = [];
  let frame = 0;

  for (const msg of messages) {
    if (msg.kind === 'system' || msg.kind === 'date') {
      frame += INSTANT_PAUSE;
    } else if (msg.kind === 'text' || msg.kind === 'image' || msg.kind === 'voice') {
      const revealFrame = frame + TYPING_FRAMES;
      events.push({
        timeSec: revealFrame / FPS,
        sound: selfParticipantIds.has(msg.participantId) ? 'send' : 'receive',
      });
      if (msg.reaction?.emoji) {
        events.push({ timeSec: (revealFrame + REACTION_DELAY) / FPS, sound: 'reaction' });
      }
      frame = revealFrame + PAUSE_FRAMES;
    }
  }

  return events;
}

export { FPS };
