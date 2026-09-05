import type { Message, StoryAspect } from '../parser/types';

export interface StoryPage {
  /** Messages for this page — a slice from where the page starts to the end of the chat; the page's own visibleCount caps how many of those actually show. */
  messages: Message[];
  /** Reveal-index (same units as FramePlan.visibleCount) at which this page begins. */
  startRevealIdx: number;
}

const DEFAULT_CYCLE_COUNT_PORTRAIT = 5;
// 16:9's stage is much shorter than 9:16's, so the same 5-bubble default
// leaves each bubble less room before the auto-height box hits its cap and
// clips — a lower default gives landscape bubbles more breathing room.
const DEFAULT_CYCLE_COUNT_LANDSCAPE = 3;

export function normalizeCycleCount(cycleCount: number | undefined, aspect?: StoryAspect): number {
  const fallback = aspect === '16:9' ? DEFAULT_CYCLE_COUNT_LANDSCAPE : DEFAULT_CYCLE_COUNT_PORTRAIT;
  return Math.max(1, Math.round(cycleCount ?? fallback));
}

/** Same subset chatTimeline's reveal schedule counts — every message except calls. */
function revealEligible(messages: Message[]): Message[] {
  return messages.filter((m) => m.kind !== 'call');
}

/**
 * Splits `messages` into pages of `cycleCount` bubbles each — the "restart
 * from top" story style (like textingstory.app) instead of scrolling
 * forever. Mirrors how the un-paged timeline already works: each page's
 * `messages` runs from its start message to the end of the chat, and the
 * page's own visibleCount (see pageIndexForRevealIdx) caps how many are ever
 * shown, so nothing needs an explicit end-slice.
 */
export function buildStoryPages(messages: Message[], cycleCount: number): StoryPage[] {
  const eligible = revealEligible(messages);
  const starts: number[] = [];
  for (let i = 0; i < eligible.length; i += cycleCount) starts.push(i);
  if (starts.length === 0) starts.push(0);

  return starts.map((startRevealIdx) => {
    const startMsg = eligible[startRevealIdx];
    const rawStart = startMsg ? messages.indexOf(startMsg) : 0;
    return { messages: messages.slice(rawStart), startRevealIdx };
  });
}

/** Which page an absolute reveal-index (FramePlan.visibleCount) falls on. */
export function pageIndexForRevealIdx(absoluteRevealIdx: number, cycleCount: number): number {
  return Math.floor(Math.max(0, absoluteRevealIdx - 1) / cycleCount);
}

/**
 * Windows `messages`/`visibleCount` down to just the current page — for the
 * live editor preview, which re-renders the whole chat on every frame rather
 * than pre-splitting pages like the exporter does.
 */
export function windowForPreview(
  messages: Message[],
  absoluteVisibleCount: number,
  cycleCount: number,
): { messages: Message[]; visibleCount: number } {
  const pages = buildStoryPages(messages, cycleCount);
  const idx = Math.min(pageIndexForRevealIdx(absoluteVisibleCount, cycleCount), pages.length - 1);
  const page = pages[Math.max(0, idx)] ?? pages[0];
  return { messages: page.messages, visibleCount: absoluteVisibleCount - page.startRevealIdx };
}
