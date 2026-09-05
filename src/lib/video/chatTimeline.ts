import type { Message, FramePlan, Participant } from '../parser/types';

const FPS = 30;
// Base pacing at 1x speed; buildRevealSchedule divides these by the
// requested speed so a higher speed means fewer frames between reveals.
const TYPING_FRAMES_BASE = FPS * 1.45;  // typing indicator before incoming bubbles
const PAUSE_FRAMES_BASE = FPS * 0.9;    // hold after each bubble appears
const INSTANT_PAUSE_BASE = FPS * 0.45;  // date/system chips
const REACTION_DELAY_BASE = FPS * 0.5;  // frames after bubble before reaction shows
const END_HOLD_BASE = FPS * 2.5;        // final hold
// Story mode's noTypingNoPause: a bubble still needs a nonzero reveal→next
// gap for the video to encode it as its own frame(s) — this is a technical
// floor, not a pacing choice, so it stays tiny and fixed regardless of speed.
const MIN_HOLD_FRAMES = Math.round(FPS * 0.1);

function normalizeSpeed(speed?: number): number {
  return typeof speed === 'number' && Number.isFinite(speed) && speed > 0 ? speed : 1;
}

export interface MessageReveal {
  msgId: string;
  kind: string;
  participantId?: string;
  showsTyping: boolean;
  hasReaction: boolean;
  startFrame: number;
  revealFrame: number;
  reactionFrame: number;
  /** Frames held visible after revealFrame, before the next message starts. */
  holdFrames: number;
}

export interface RevealSchedule {
  reveals: MessageReveal[];
  totalFrames: number;
  fps: number;
}

export interface ScheduleOptions {
  speed?: number;
  /** msgId -> seconds to hold the bubble visible (e.g. a voiceover clip's duration). Not divided by speed — a spoken line takes as long as it takes. */
  holdSecById?: Record<string, number>;
  endHoldSec?: number;
  /**
   * Story mode: skip the typing indicator and the pause after each bubble —
   * the next one appears the instant this one's (voiceover-driven, if
   * enabled) hold time is up, with no extra dead air on top.
   */
  noTypingNoPause?: boolean;
}

/**
 * Single source of truth for message timing, shared by the video frame plan
 * (framePlansFromSchedule), the message-sound track (soundEventsFromSchedule)
 * and, when story mode has a voiceover, the per-message hold time and the
 * voice/music mix. Passing no `holdSecById` reproduces the exact frame
 * arithmetic the original buildFramePlan/buildSoundEvents used.
 */
export function buildRevealSchedule(
  messages: Message[],
  participants: Participant[] = [],
  opts: ScheduleOptions = {},
): RevealSchedule {
  const s = normalizeSpeed(opts.speed);
  const TYPING_FRAMES = opts.noTypingNoPause ? 0 : Math.round(TYPING_FRAMES_BASE / s);
  const PAUSE_FRAMES = opts.noTypingNoPause ? MIN_HOLD_FRAMES : Math.round(PAUSE_FRAMES_BASE / s);
  const INSTANT_PAUSE = Math.round(INSTANT_PAUSE_BASE / s);
  const REACTION_DELAY = Math.round(REACTION_DELAY_BASE / s);
  // Matches the original buildFramePlan when no explicit override is given:
  // the end hold scales with speed like every other pacing constant.
  const END_HOLD = opts.endHoldSec !== undefined
    ? Math.round(opts.endHoldSec * FPS)
    : Math.round(END_HOLD_BASE / s);

  const reveals: MessageReveal[] = [];
  const selfParticipantIds = new Set(participants.filter((p) => p.isSelf).map((p) => p.id));
  let frame = 0;

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
        holdFrames: INSTANT_PAUSE,
      });
      frame += INSTANT_PAUSE;
    } else if (msg.kind === 'text' || msg.kind === 'image' || msg.kind === 'voice') {
      const startFrame = frame;
      const revealFrame = frame + TYPING_FRAMES;
      const hasReaction = !!(msg.reaction?.emoji);
      const showsTyping = !selfParticipantIds.has(msg.participantId);
      const holdSec = opts.holdSecById?.[msg.id];
      const holdFrames = holdSec !== undefined
        ? Math.max(PAUSE_FRAMES, Math.ceil(holdSec * FPS))
        : PAUSE_FRAMES;
      reveals.push({
        msgId: msg.id,
        kind: msg.kind,
        participantId: msg.participantId,
        showsTyping,
        hasReaction,
        startFrame,
        revealFrame,
        reactionFrame: hasReaction ? revealFrame + REACTION_DELAY : -1,
        holdFrames,
      });
      frame = revealFrame + holdFrames;
    }
  }

  const totalFrames = frame + END_HOLD;
  return { reveals, totalFrames, fps: FPS };
}

// Compute the Y position each message would appear at (approximate: 80px per bubble)
const MSG_HEIGHT = 80;
const PHONE_HEIGHT = 844 - 56 - 60 - 56; // minus header, status bar, input bar

export function framePlansFromSchedule(schedule: RevealSchedule): FramePlan[] {
  const plans: FramePlan[] = [];

  for (let f = 0; f < schedule.totalFrames; f++) {
    let visibleCount = 0;
    let typingParticipantId: string | null = null;
    const activeReactionIds: string[] = [];

    for (const r of schedule.reveals) {
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

export function soundEventsFromSchedule(schedule: RevealSchedule, participants: Participant[] = []): SoundEvent[] {
  const selfParticipantIds = new Set(participants.filter((p) => p.isSelf).map((p) => p.id));
  const events: SoundEvent[] = [];

  for (const r of schedule.reveals) {
    if (r.kind === 'system' || r.kind === 'date') continue;
    events.push({
      timeSec: r.revealFrame / schedule.fps,
      sound: r.participantId && selfParticipantIds.has(r.participantId) ? 'send' : 'receive',
    });
    if (r.hasReaction && r.reactionFrame !== -1) {
      events.push({ timeSec: r.reactionFrame / schedule.fps, sound: 'reaction' });
    }
  }

  return events;
}

/** @deprecated use buildRevealSchedule + framePlansFromSchedule */
export function buildFramePlan(messages: Message[], participants: Participant[] = [], speed?: number): FramePlan[] {
  return framePlansFromSchedule(buildRevealSchedule(messages, participants, { speed }));
}

/**
 * When each message sound should play, mirroring buildRevealSchedule's frame
 * arithmetic so sounds land exactly when bubbles/reactions become visible.
 * @deprecated use buildRevealSchedule + soundEventsFromSchedule
 */
export function buildSoundEvents(messages: Message[], participants: Participant[] = [], speed?: number): SoundEvent[] {
  return soundEventsFromSchedule(buildRevealSchedule(messages, participants, { speed }), participants);
}

export { FPS };
