import type { Message, StoryAspect } from '../parser/types';
import { storyStage, STORY_SCRIM_PAD } from './storyLayout';

export interface StoryPage {
  /** Exactly this page's own messages. */
  messages: Message[];
  /** Reveal-index (same units as FramePlan.visibleCount) at which this page begins. */
  startRevealIdx: number;
  /** How many reveal-eligible messages this page holds. */
  count: number;
}

/**
 * A page holds as many bubbles as actually FIT the box's ceiling, rather than
 * a fixed count. A fixed count can't be right for both a chat of one-liners
 * and one of paragraphs: tuned for short messages it slices long ones in
 * half (the box stops at its cap, so anything past it is simply cut), and
 * tuned for long ones it wastes most of the frame on short chats. So pages
 * are packed by estimated height instead — short messages get more bubbles
 * per page, long ones fewer, automatically.
 *
 * The estimate below is deliberately a little PESSIMISTIC (it reads ~10-20%
 * taller than bubbles actually measure), because under-filling a page just
 * restarts the chat a bubble early, while over-filling it crops a bubble —
 * and it's shared by the preview and the exporter so both agree on exactly
 * where pages break without either having to measure a rendered DOM.
 */
// Calibrated against real rendered bubbles (Inter, story text sizes, the
// 420px column): a wrapped line measures ~20px tall, text wraps at ~300px
// wide, and the chat header plus the box's top padding measure ~72.5px.
// Each constant keeps a little margin over its measured value so the packer
// errs toward under-filling — a page that closes early only restarts the
// chat a bubble sooner, while one that overfills crops a bubble.
const LINE_H = 21;          // one wrapped line of story-sized bubble text
const BUBBLE_CHROME = 34;   // bubble padding + the gap to the next row
const NAME_LABEL_H = 22;    // sender label above an incoming bubble (group chats only)
const TEXT_W = 300;         // px of text a bubble fits before wrapping
const NON_TEXT_H = 150;     // images/voice notes/etc — a generous fixed guess

/**
 * Measured a size ABOVE the real bubble text (15px) so every width comes
 * back a few percent long — margin baked into the measurement itself, and
 * cover for the platforms whose bubbles run a little larger than WhatsApp's.
 */
const MEASURE_FONT = '16px Inter, system-ui, sans-serif';

/** Chat header + the box's own padding, which eat into the box before any bubble does. */
const BOX_CHROME_H = 78;

/** Hard ceiling regardless of how short the messages are, so a page still reads as a page. */
const MAX_PER_PAGE = 6;

/**
 * Counting CHARACTERS to guess how many lines a message wraps to cannot be
 * made safe: how many fit a line depends entirely on which characters they
 * are — ~41 for English prose, but ~36 for emoji or digits, ~32 in ALL CAPS,
 * ~24 for a long unbreakable token like a URL, ~21 for m/w-heavy text. Any
 * single constant is either wrong for most text (wasting half the box) or
 * optimistic for some of it (cropping a bubble). So measure the text instead,
 * with the browser's own text metrics.
 */
let measureCtx: CanvasRenderingContext2D | null | undefined;
function getMeasureCtx(): CanvasRenderingContext2D | null {
  if (measureCtx === undefined) {
    const ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    if (ctx) ctx.font = MEASURE_FONT;
    measureCtx = ctx;
  }
  return measureCtx;
}

/** How many lines `text` wraps to in a `maxW`-wide bubble, by real text metrics. */
function countWrappedLines(text: string, maxW: number): number {
  const ctx = getMeasureCtx();
  let lines = 0;

  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) { lines += 1; continue; }
    if (!ctx) {
      // No canvas (server-side render, or a browser that refuses a 2D
      // context). Fall back to the character heuristic at its universally
      // safe width — wasteful, but this path never runs where it'd show.
      lines += Math.max(1, Math.ceil(paragraph.length / 21));
      continue;
    }

    const spaceW = ctx.measureText(' ').width;
    let lineW = 0;
    for (const word of words) {
      const wordW = ctx.measureText(word).width;
      // A single token wider than the line (a URL, say) breaks mid-word
      // across as many lines as it needs.
      if (wordW > maxW) {
        if (lineW > 0) { lines += 1; lineW = 0; }
        lines += Math.ceil(wordW / maxW);
        continue;
      }
      const withWord = lineW === 0 ? wordW : lineW + spaceW + wordW;
      if (withWord <= maxW) {
        lineW = withWord;
      } else {
        lines += 1;
        lineW = wordW;
      }
    }
    if (lineW > 0) lines += 1;
  }

  return Math.max(1, lines);
}

function estimateMessageH(msg: Message, showsNameLabel: boolean): number {
  const label = showsNameLabel ? NAME_LABEL_H : 0;
  if (msg.kind !== 'text') return NON_TEXT_H + label;
  return label + BUBBLE_CHROME + countWrappedLines(msg.text ?? '', TEXT_W) * LINE_H;
}

/** Same subset chatTimeline's reveal schedule counts — every message except calls. */
function revealEligible(messages: Message[]): Message[] {
  return messages.filter((m) => m.kind !== 'call');
}

/**
 * Splits `messages` into pages that each fit the story box — the "restart
 * from top" story style (like textingstory.app) instead of scrolling forever.
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
export function buildStoryPages(messages: Message[], aspect: StoryAspect = '9:16', isGroup = false): StoryPage[] {
  const eligible = revealEligible(messages);
  const budget = Math.max(LINE_H, storyStage(aspect).maxBoxH - BOX_CHROME_H - STORY_SCRIM_PAD);

  const pages: StoryPage[] = [];
  let startRevealIdx = 0;
  let used = 0;
  let count = 0;
  let lastSenderId: string | undefined;

  const flush = () => {
    const startMsg = eligible[startRevealIdx];
    const rawStart = startMsg ? messages.indexOf(startMsg) : 0;
    const nextMsg = eligible[startRevealIdx + count];
    const rawEnd = nextMsg ? messages.indexOf(nextMsg) : messages.length;
    pages.push({ messages: messages.slice(rawStart, rawEnd), startRevealIdx, count });
    startRevealIdx += count;
    used = 0;
    count = 0;
    lastSenderId = undefined;
  };

  for (const msg of eligible) {
    // A run of messages from one sender only labels the first of them.
    // System/date rows have no sender at all, which is fine — they just
    // never match the previous one.
    // Only group chats label their incoming bubbles at all — charging a
    // 1:1 chat for a label it never renders costs a bubble a page.
    const senderId = 'participantId' in msg ? msg.participantId : undefined;
    let showsNameLabel = isGroup && senderId !== lastSenderId;
    let h = estimateMessageH(msg, showsNameLabel);
    // Always take at least one message, however long it is — a single bubble
    // taller than the whole box has nowhere better to go, and the compositor
    // clips it rather than letting it spill outside the box.
    if (count > 0 && (used + h > budget || count >= MAX_PER_PAGE)) {
      flush();
      // Each page is rendered as its own little chat, so a page break
      // restarts the sender run: this bubble now DOES carry its label, even
      // though it followed one from the same sender before the break. Left
      // uncharged, a break mid-run under-counts the new page by that label.
      showsNameLabel = isGroup;
      h = estimateMessageH(msg, showsNameLabel);
    }
    used += h;
    count += 1;
    lastSenderId = senderId;
  }
  if (count > 0 || pages.length === 0) flush();

  return pages;
}

/** Which page an absolute reveal-index (FramePlan.visibleCount) falls on. */
export function pageIndexForRevealIdx(pages: StoryPage[], absoluteRevealIdx: number): number {
  const idx = Math.max(0, absoluteRevealIdx - 1);
  for (let i = pages.length - 1; i >= 0; i--) {
    if (idx >= pages[i].startRevealIdx) return i;
  }
  return 0;
}

/**
 * Windows `messages`/`visibleCount` down to just the current page — for the
 * live editor preview, which re-renders the whole chat on every frame rather
 * than pre-splitting pages like the exporter does.
 */
export function windowForPreview(
  messages: Message[],
  absoluteVisibleCount: number,
  aspect: StoryAspect = '9:16',
  isGroup = false,
): { messages: Message[]; visibleCount: number } {
  const pages = buildStoryPages(messages, aspect, isGroup);
  const page = pages[pageIndexForRevealIdx(pages, absoluteVisibleCount)] ?? pages[0];
  return { messages: page.messages, visibleCount: absoluteVisibleCount - page.startRevealIdx };
}
