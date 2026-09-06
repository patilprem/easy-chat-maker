import type { Message, StoryAspect } from '../parser/types';

export interface StoryPage {
  /** Messages for this page — a slice from where the page starts to the end of the chat; the page's own visibleCount caps how many of those actually show. */
  messages: Message[];
  /** Reveal-index (same units as FramePlan.visibleCount) at which this page begins. */
  startRevealIdx: number;
}

// Measured empirically against a realistic 5-participant group chat (with
// each incoming bubble's sender-name label, which adds real height beyond
// just the bubble text): 5 stacked portrait bubbles need ~764px, but the
// box's ceiling — already sized to almost the ENTIRE stage below the
// header, see maxStoryContentH — only has ~744px to give before it hits the
// stage's own bottom edge. There's no more room to grow into, so the fix is
// fewer bubbles per page rather than a taller ceiling.
const DEFAULT_CYCLE_COUNT_PORTRAIT = 4;
// 16:9's stage is much shorter than 9:16's — the SAME bubbles (same 390px
// column width, so identical wrapping/height) leave much less headroom
// before the box's ceiling, which is a smaller fraction of a shorter stage.
const DEFAULT_CYCLE_COUNT_LANDSCAPE = 2;

/** Fixed per-aspect default — not user-adjustable, kept simple on purpose. */
export function normalizeCycleCount(aspect?: StoryAspect): number {
  return aspect === '16:9' ? DEFAULT_CYCLE_COUNT_LANDSCAPE : DEFAULT_CYCLE_COUNT_PORTRAIT;
}

/** Same subset chatTimeline's reveal schedule counts — every message except calls. */
function revealEligible(messages: Message[]): Message[] {
  return messages.filter((m) => m.kind !== 'call');
}

/**
 * Splits `messages` into pages of `cycleCount` bubbles each — the "restart
 * from top" story style (like textingstory.app) instead of scrolling
 * forever.
 *
 * Each page is sliced to EXACTLY its own messages, not "from here to the end
 * of the chat". The page's own visibleCount would cap what's ever *shown*
 * either way, but the exporter renders `page.messages` into a real DOM to
 * capture sprites from (see compositeCore's captureChatSprites) — so trailing
 * messages still lay out there, overflowing the story box's max-height and
 * turning its feed into a bounded scroller. That silently changes every
 * measurement the compositor takes (feed height, row geometry, scroll), and
 * the captured sprite then stops matching where the composer thinks rows are
 * — bubbles go missing inside a correctly-sized box. Keeping each page's DOM
 * to just its own bubbles keeps the layout the compositor measures identical
 * to the one it draws.
 */
export function buildStoryPages(messages: Message[], cycleCount: number): StoryPage[] {
  const eligible = revealEligible(messages);
  const starts: number[] = [];
  for (let i = 0; i < eligible.length; i += cycleCount) starts.push(i);
  if (starts.length === 0) starts.push(0);

  return starts.map((startRevealIdx) => {
    const startMsg = eligible[startRevealIdx];
    const rawStart = startMsg ? messages.indexOf(startMsg) : 0;
    // First message of the NEXT page, in raw (un-filtered) message indices —
    // absent for the last page, which just runs to the end.
    const nextStartMsg = eligible[startRevealIdx + cycleCount];
    const rawEnd = nextStartMsg ? messages.indexOf(nextStartMsg) : messages.length;
    return { messages: messages.slice(rawStart, rawEnd), startRevealIdx };
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
