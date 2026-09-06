import { toCanvas, getFontEmbedCSS } from 'html-to-image';
import type { FramePlan, Message } from '../parser/types';
import { FPS } from '../video/chatTimeline';

/**
 * The measuring/capturing/compositing core shared by the phone exporter
 * (exportComposite.ts) and the story exporter (exportStory.ts).
 *
 * Extracted verbatim from the original single-file phone exporter — no
 * behavior change versus before the split. The phone exporter captures its
 * root (`#phone-screen-export`) with an opaque background and draws it at
 * (0,0) the size of the whole video frame. The story exporter captures a
 * transparent stage (scrim + name pill baked in, no phone chrome) that is
 * usually SMALLER than the video frame — its caller paints a moving
 * background onto the canvas first, then `FeedComposer.drawFrame` composites
 * this capture and the chat bubbles on top via ordinary alpha blending, so
 * nothing here needs to know about story mode at all.
 */

const SCROLL_SMOOTHING_S = 0.12; // exponential smooth-scroll time constant
const TYPING_PHASE_FRAMES = Math.max(1, Math.round(FPS * 0.22));

/** Thrown when the platform's DOM doesn't fit the row model — caller should fall back. */
export class CompositeUnsupportedError extends Error {
  constructor(reason: string) {
    super(`Composite export unsupported: ${reason}`);
    this.name = 'CompositeUnsupportedError';
  }
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function rafSettle(win: Window, count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (n: number) => (n <= 0 ? resolve() : win.requestAnimationFrame(() => step(n - 1)));
    step(count);
  });
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

/** Non-absolutely-positioned, visible children (decorative overlays are absolute). */
function flowChildren(el: HTMLElement): HTMLElement[] {
  // NOTE: no `instanceof HTMLElement` here — these nodes live in the export
  // iframe, whose HTMLElement is a different class than the parent page's.
  const win = el.ownerDocument.defaultView;
  if (!win) return [];
  return (Array.from(el.children) as HTMLElement[]).filter((c) => {
    if (c.nodeType !== 1) return false;
    const cs = win.getComputedStyle(c);
    if (cs.position === 'absolute' || cs.position === 'fixed') return false;
    return c.getBoundingClientRect().height > 0;
  });
}

/** Walk down through single-child wrappers to the element whose children are the message rows. */
function findMessageLayer(feed: HTMLElement, expectedRows: number): { layer: HTMLElement; rows: HTMLElement[] } {
  let layer = feed;
  let rows = flowChildren(layer);
  let depth = 0;
  while (rows.length === 1 && expectedRows > 1 && depth < 4) {
    layer = rows[0];
    rows = flowChildren(layer);
    depth++;
  }
  return { layer, rows };
}

export interface RenderIframe {
  iframe: HTMLIFrameElement;
  win: Window;
  doc: Document;
  root: HTMLElement;
}

/**
 * Opens the hidden `/render/chat` iframe at the given CSS size and waits for
 * its `rootId` element to appear. `close()` removes the iframe.
 */
export async function openRenderIframe(src: string, w: number, h: number, rootId = 'phone-screen-export'): Promise<RenderIframe & { close: () => void }> {
  const iframe = document.createElement('iframe');
  iframe.src = src;
  Object.assign(iframe.style, {
    position: 'fixed', left: '-9999px', top: '-9999px',
    width: `${w}px`, height: `${h}px`, border: 'none',
  });
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Iframe load failed'));
      setTimeout(() => reject(new Error('Iframe load timeout')), 15000);
    });
    const win = iframe.contentWindow;
    const doc = iframe.contentDocument;
    if (!win || !doc) throw new Error('Iframe inaccessible');

    let root: HTMLElement | null = null;
    for (let i = 0; i < 40 && !root; i++) {
      root = doc.getElementById(rootId);
      if (!root) await sleep(100);
    }
    if (!root) throw new Error(`#${rootId} not found in iframe`);

    return { iframe, win, doc, root, close: () => document.body.removeChild(iframe) };
  } catch (e) {
    document.body.removeChild(iframe);
    throw e;
  }
}

interface Geom {
  rowTops: number[];
  rowBottoms: number[];
  layerH: number;
}

export interface ChatSprites {
  rootW: number;
  rootH: number;
  feedX: number;
  feedY: number;
  feedW: number;
  feedH: number;
  layerOffX: number;
  layerOffY: number;
  layerW: number;
  padTop: number;
  padBottom: number;
  feedPadBottom: number;
  rowCountAt: number[];
  rowMsgId: (string | null)[];
  geomPlain: Geom;
  geomReact: Geom;
  tallPlain: HTMLCanvasElement;
  tallReacted: HTMLCanvasElement | null;
  badgeRects: { row: number; x: number; yTop: number; w: number; h: number }[];
  baseEmpty: HTMLCanvasElement;
  baseConv: HTMLCanvasElement;
  typingSprites: Map<string, { canvases: HTMLCanvasElement[]; height: number; offX: number }>;
  typingOverlay: { canvas: HTMLCanvasElement; x: number; y: number } | null;
  typingTailH: number;
}

export interface CaptureChatSpritesOptions {
  win: Window;
  doc: Document;
  root: HTMLElement;
  messages: Message[];
  plans: FramePlan[];
  scale: number;
  /** Background for the two full-root captures. Undefined -> transparent (story mode). */
  baseBg?: string;
  onProgress?: (pct: number) => void;
}

/**
 * Measures the chat DOM once and captures every sprite the compositor needs:
 * the full message list as one tall transparent image (plain and reacted),
 * the root's static chrome in its empty and has-messages states, and the
 * typing bubble in three animation phases.
 */
export async function captureChatSprites(opts: CaptureChatSpritesOptions): Promise<ChatSprites> {
  const { win, doc, root, messages, plans, scale, baseBg, onProgress } = opts;
  const N = messages.length;

  await Promise.allSettled([
    doc.fonts?.ready ?? Promise.resolve(),
    ...Array.from(doc.images).map(
      (img) => new Promise((r) => { img.complete ? r(null) : (img.onload = img.onerror = r); })
    ),
  ]);
  const fontEmbedCSS = await getFontEmbedCSS(root).catch(() => '');
  const capture = (el: HTMLElement, bg?: string) =>
    toCanvas(el, { pixelRatio: scale, fontEmbedCSS, backgroundColor: bg });

  let frameToken = 0;
  const setFrame = async (plan: FramePlan) => {
    const token = `composite-${++frameToken}`;
    // noscroll: keep the live feed unscrolled — row geometry must be
    // layout-true (a scrolled feed bakes -scrollTop into every rect when
    // the message layer IS the scroll container), and scrolling is
    // composed on the canvas anyway.
    win.postMessage({ type: 'SET_FRAME', frame: 0, plan, token, noscroll: true }, '*');
    // RenderChatApp echoes the token via __ECM_FRAME_READY once the frame
    // is committed.
    for (let i = 0; i < 60; i++) {
      if ((win as Window & { __ECM_FRAME_READY?: string }).__ECM_FRAME_READY === token) break;
      await sleep(25);
    }
    await rafSettle(win);
  };

  // ---- Measure & capture sprites ----
  const noTyping = (visibleCount: number, activeReactionIds: string[] = []): FramePlan =>
    ({ visibleCount, typingParticipantId: null, activeReactionIds, scrollY: 0 });

  await setFrame(noTyping(N));

  const feed = doc.querySelector<HTMLElement>('.phone-chat-scroll');
  if (!feed) throw new CompositeUnsupportedError('no .phone-chat-scroll');
  // Earlier frames may have scrolled the feed before noscroll took effect.
  feed.style.scrollBehavior = 'auto';
  feed.scrollTop = 0;
  await rafSettle(win);
  // Platforms may inject rows that aren't messages (auto date chips, group
  // headers), so rows are NOT 1:1 with messages. Wait for the complete
  // state to commit (row count stops growing), then map messages to rows
  // by stepping visibleCount and recording the row count at each step.
  let layer!: HTMLElement;
  let rows: HTMLElement[] = [];
  let stable = 0;
  for (let i = 0; i < 60 && stable < 3; i++) {
    const prev = rows.length;
    ({ layer, rows } = findMessageLayer(feed, N));
    stable = rows.length > 0 && rows.length === prev ? stable + 1 : 0;
    await sleep(50);
  }
  const R = rows.length;
  if (R === 0) throw new CompositeUnsupportedError('no message rows rendered');

  // html-to-image's clone establishes a new block formatting context, so
  // child margins that collapse through the layer in the live DOM don't
  // collapse in the capture — shifting all sprite content downward vs the
  // measured geometry. Force the same BFC on the live layer before
  // measuring so DOM geometry and captured pixels agree.
  layer.style.display = 'flow-root';
  await rafSettle(win);
  rows = findMessageLayer(feed, N).rows;
  if (rows.length !== R) throw new CompositeUnsupportedError('layer changed after BFC');

  const rootRect = root.getBoundingClientRect();
  const feedRect = feed.getBoundingClientRect();
  const layerRect = layer.getBoundingClientRect();
  const feedX = feedRect.left - rootRect.left;
  const feedY = feedRect.top - rootRect.top;
  const feedH = feed.clientHeight;
  const feedW = feed.clientWidth;
  const layerOffX = layerRect.left - feedRect.left;
  // The row layer usually sits inside a padded wrapper (WhatsApp's feed
  // wrapper is pt-4 pb-2). Row geometry below is layer-relative, and this
  // exporter composes the feed itself instead of scrolling the live one, so
  // it has to re-add that padding at both ends — otherwise the first
  // message renders flush against the header and the last one against the
  // composer.
  const layerOffY = layerRect.top - feedRect.top + feed.scrollTop;
  let feedPadBottom = 0;
  for (let el: HTMLElement | null = layer; el && el !== feed; el = el.parentElement) {
    const parent = el.parentElement;
    if (!parent) break;
    feedPadBottom += parseFloat(win.getComputedStyle(parent).paddingBottom) || 0;
  }
  const layerW = layerRect.width;
  const layerH = layer.scrollHeight || layerRect.height;
  const rowTops = rows.map((r) => r.getBoundingClientRect().top - layerRect.top);
  const rowBottoms = rows.map((r) => r.getBoundingClientRect().bottom - layerRect.top);
  const padTop = rowTops[0] ?? 0;
  const padBottom = layerH - (rowBottoms[R - 1] ?? layerH);

  // rowCountAt[k] = number of rows rendered when k messages are visible.
  // Platforms may render extra rows (auto date chips) or FEWER rows than
  // messages (Telegram drops `system` messages entirely), so the only hard
  // invariants are 0 <= rowCountAt[k] <= rowCountAt[k+1]. setFrame already
  // token-syncs with the committed DOM, so the poll is just a safety net.
  // Count rows via the ALREADY-RESOLVED layer element — re-deriving it with
  // findMessageLayer at low visibleCounts walks INTO the only bubble on
  // screen and returns garbage (0 rows → missing first messages).
  const rowCountAt: number[] = new Array(N + 1).fill(0);
  rowCountAt[N] = R;
  for (let k = N - 1; k >= 0; k--) {
    await setFrame(noTyping(k));
    let count = -1;
    for (let i = 0; i < 60; i++) {
      count = flowChildren(layer).length;
      if (count <= rowCountAt[k + 1]) break;
      await sleep(30);
    }
    rowCountAt[k] = Math.max(0, Math.min(count, rowCountAt[k + 1]));
  }
  // Which message id (if any) each row belongs to, for reaction slices.
  const rowMsgId: (string | null)[] = new Array(R).fill(null);
  for (let i = 0; i < N; i++) {
    for (let j = rowCountAt[i]; j < rowCountAt[i + 1]; j++) rowMsgId[j] = messages[i].id;
  }
  await setFrame(noTyping(N));

  const geomPlain: Geom = { rowTops, rowBottoms, layerH };

  // When the message layer IS the scroll container (platforms that render
  // rows as direct feed children, e.g. Telegram), a plain capture clips to
  // the feed's viewport height — html-to-image clones at layout size with
  // scrollTop reset. Temporarily grow the feed to its full content height
  // so the tall sprite contains every row.
  const captureTall = async (): Promise<HTMLCanvasElement> => {
    if (layer !== feed) return capture(layer);
    const prev = {
      height: feed.style.height,
      flex: feed.style.flex,
      overflowY: feed.style.overflowY,
    };
    feed.style.height = `${layer.scrollHeight || layerH}px`;
    feed.style.flex = 'none';
    feed.style.overflowY = 'visible';
    await rafSettle(win);
    try {
      return await capture(feed);
    } finally {
      feed.style.height = prev.height;
      feed.style.flex = prev.flex;
      feed.style.overflowY = prev.overflowY;
      await rafSettle(win);
    }
  };

  onProgress?.(8);
  const tallPlain = await captureTall();

  // Reactions can change row heights (badge spacing), so the reacted state
  // gets its own capture AND its own geometry; frames stack per-row slices
  // cumulatively so mixed states stay seamless.
  const reactionIds = messages
    .filter((m) => 'reaction' in m && (m as { reaction?: { emoji?: string } }).reaction?.emoji)
    .map((m) => m.id);
  let tallReacted: HTMLCanvasElement | null = null;
  let geomReact: Geom = { rowTops, rowBottoms, layerH };
  const badgeRects: { row: number; x: number; yTop: number; w: number; h: number }[] = [];
  if (reactionIds.length > 0) {
    await setFrame(noTyping(N, reactionIds));
    await sleep(100);
    const rRows = flowChildren(layer);
    if (rRows.length === R) {
      const rLayerRect = layer.getBoundingClientRect();
      geomReact = {
        rowTops: rRows.map((r) => r.getBoundingClientRect().top - rLayerRect.top),
        rowBottoms: rRows.map((r) => r.getBoundingClientRect().bottom - rLayerRect.top),
        layerH: layer.scrollHeight || rLayerRect.height,
      };
    }
    // Badge rectangles (row-relative) so frames can redraw just the badge
    // where it overhangs its row's slice.
    const rLayerRect2 = layer.getBoundingClientRect();
    for (const badge of Array.from(doc.querySelectorAll<HTMLElement>('.reaction-badge'))) {
      let rowEl: HTMLElement = badge;
      while (rowEl.parentElement && rowEl.parentElement !== layer) rowEl = rowEl.parentElement;
      const j = flowChildren(layer).indexOf(rowEl);
      if (j === -1) continue;
      const br = badge.getBoundingClientRect();
      badgeRects.push({
        row: j,
        x: br.left - rLayerRect2.left - 3,
        yTop: br.top - rLayerRect2.top - 3,
        w: br.width + 6,
        h: br.height + 6,
      });
    }
    tallReacted = await captureTall();
  }

  onProgress?.(14);
  await setFrame(noTyping(0));
  await sleep(100);
  const baseEmpty = await capture(root, baseBg);

  // Conversation-state chrome: several platforms swap UI on message count —
  // AI previews show an empty-state hero ("What can I help with?") and a
  // different composer placeholder when the chat is empty. Frames with
  // visible messages must composite over chrome captured in the
  // has-messages state, with the message rows themselves hidden.
  await setFrame(noTyping(N));
  await sleep(100);
  const convRows = flowChildren(layer);
  for (const r of convRows) r.style.visibility = 'hidden';
  await rafSettle(win);
  const baseConv = await capture(root, baseBg);
  for (const r of convRows) r.style.visibility = '';
  await rafSettle(win);

  // Typing bubble sprites: 3 live phases of the CSS dot animation.
  const typingPids = Array.from(new Set(plans.map((p) => p.typingParticipantId).filter((p): p is string => !!p)));
  const typingSprites = new Map<string, { canvases: HTMLCanvasElement[]; height: number; offX: number }>();
  // Full-root typing overlay (Gemini's aurora shimmer): captured once and
  // pulsed via globalAlpha during typing frames.
  let typingOverlay: { canvas: HTMLCanvasElement; x: number; y: number } | null = null;
  // Previews reserve extra space under the typing row so the dots don't sit
  // on the input bar. It only exists while someone is typing, so padBottom —
  // measured on a no-typing frame — never sees it, and composed scrolling
  // would jam the dots against the bar. Measure it on a live typing frame.
  let typingTailH = 0;
  for (const pid of typingPids) {
    await setFrame({ visibleCount: 0, typingParticipantId: pid, activeReactionIds: [], scrollY: 0 });
    await sleep(120);
    if (!typingTailH) {
      const tail = doc.querySelector<HTMLElement>('[data-typing-tail]');
      if (tail) typingTailH = tail.getBoundingClientRect().height;
    }
    if (!typingOverlay) {
      const overlayEl = doc.querySelector<HTMLElement>('[data-export-typing-overlay]');
      if (overlayEl) {
        const oRect = overlayEl.getBoundingClientRect();
        typingOverlay = {
          // Neutralize absolute positioning and animation on the clone
          // root — captured as-is, an inset-anchored element renders
          // empty. Full opacity here; frames pulse it via globalAlpha.
          canvas: await toCanvas(overlayEl, {
            pixelRatio: scale,
            fontEmbedCSS,
            width: Math.round(oRect.width),
            height: Math.round(oRect.height),
            style: { position: 'static', inset: 'auto', animation: 'none', opacity: '1', transform: 'none' },
          }),
          x: oRect.left - rootRect.left,
          y: oRect.top - rootRect.top,
        };
      }
    }
    const dot = doc.querySelector<HTMLElement>('.typing-dot, [data-typing-indicator]');
    if (!dot) continue; // platform without dots — typing just won't be drawn
    // The typing ROW (avatar + bubble) is the ancestor of the dots that
    // sits directly in the feed or in the message layer. Don't reuse
    // findMessageLayer here: with the typing row as the feed's only flow
    // child it walks INTO the row and we'd capture just the bubble,
    // losing the avatar next to it.
    // Previews tag the row directly. The walk-up below is only a fallback:
    // it stops at whichever ancestor sits in `feed` or `layer`, and when the
    // typing row is a SIBLING of the row layer (WhatsApp) that ancestor is
    // the full-height wrapper — so `height` came back as the whole feed and
    // the sprite blanked the conversation.
    let row = doc.querySelector<HTMLElement>('[data-typing-row]');
    if (!row) {
      row = dot;
      while (row.parentElement && row.parentElement !== feed && row.parentElement !== layer) row = row.parentElement;
    }
    const rowRect = row.getBoundingClientRect();
    const canvases: HTMLCanvasElement[] = [];
    for (let k = 0; k < 3; k++) {
      canvases.push(await capture(row));
      await sleep(220);
    }
    typingSprites.set(pid, {
      canvases,
      height: rowRect.height,
      // Row-left relative to the feed, so composition doesn't depend on
      // which container the row lives in.
      offX: rowRect.left - feed.getBoundingClientRect().left,
    });
  }

  return {
    rootW: rootRect.width,
    rootH: rootRect.height,
    feedX, feedY, feedW, feedH,
    layerOffX, layerOffY, layerW,
    padTop, padBottom, feedPadBottom,
    rowCountAt, rowMsgId,
    geomPlain, geomReact,
    tallPlain, tallReacted,
    badgeRects,
    baseEmpty, baseConv,
    typingSprites, typingOverlay, typingTailH,
  };
}

export interface FeedComposer {
  /** Draws one video frame's chrome + bubbles onto `ctx` at native (0,0). */
  drawFrame(ctx: CanvasRenderingContext2D, plan: FramePlan, frameIndex: number): void;
}

/**
 * A rounded backdrop drawn behind the feed that HUGS the frame's actual
 * visible content — it grows as bubbles appear, stops at `maxBoxHPx`, and
 * stays vertically centred on the stage. Because the box moves and resizes
 * per frame while the captured DOM is a single fixed layout, the composer
 * shifts everything it draws (the root's chrome — the chat header — the
 * bubble rows, and the clip) by the same offset, so the header stays glued
 * to the top of the box wherever the box ends up.
 *
 * Nothing here is story-specific: the composer just draws a rect around
 * whatever content height it already computed for scrolling, so this stays
 * meaningless — and unused — for the phone exporter.
 */
export interface FeedComposerScrim {
  /** e.g. 'rgba(0,0,0,0.45)'. */
  color: string;
  /** CSS px inset between the shape's edge and the bubble content. */
  padPx: number;
  /** CSS px corner radius. */
  radiusPx: number;
  /** Tallest the box may grow, its own padding included (CSS px). Content past this is clipped rather than drawn outside the box. */
  maxBoxHPx: number;
  /**
   * Root-relative CSS px of the box's top edge IN THE CAPTURED LAYOUT — the
   * capture pins the box at a known, content-independent position (see
   * StoryStage's `bakeScrim=false` branch) purely so this offset is
   * knowable. Everything between here and the feed's own top (`feedY`) is
   * the box's top padding plus the platform's header, which must ride along
   * with the box as it resizes.
   */
  boxTopRootY: number;
}

/**
 * Builds a stateful per-frame compositor (tracks smoothed scroll position
 * and the current typing-dot animation phase across calls, so frames must be
 * drawn in increasing `frameIndex` order for one export).
 */
export function createFeedComposer(sprites: ChatSprites, scale: number, opts?: { scrim?: FeedComposerScrim }): FeedComposer {
  const {
    rootW, rootH, feedX, feedY, feedW, feedH, layerOffX, layerOffY, layerW,
    padTop, padBottom, feedPadBottom, rowCountAt, rowMsgId, geomPlain, geomReact,
    tallPlain, tallReacted, badgeRects, baseEmpty, baseConv, typingSprites, typingOverlay, typingTailH,
  } = sprites;
  const R = geomPlain.rowTops.length;
  const sliceTop = (g: Geom, j: number) => (j === 0 ? 0 : g.rowTops[j]);
  const sliceBottom = (g: Geom, j: number) => (j < R - 1 ? g.rowTops[j + 1] : g.layerH);

  const rootWS = Math.round(rootW * scale);
  const rootHS = Math.round(rootH * scale);
  let typingSince = -1;
  let lastTypingId: string | null = null;
  let scroll = -1;

  return {
    drawFrame(ctx, plan, f) {
      const k = plan.visibleCount;

      if (plan.typingParticipantId) {
        if (typingSince === -1 || lastTypingId !== plan.typingParticipantId) typingSince = f;
      } else {
        typingSince = -1;
      }
      lastTypingId = plan.typingParticipantId;

      const rc = rowCountAt[k]; // rows on screen when k messages are visible
      const typing = plan.typingParticipantId ? typingSprites.get(plan.typingParticipantId) : undefined;

      // Stack the visible rows' slices cumulatively; each row picks the
      // capture (and geometry) matching its current reaction state.
      // All slice geometry is snapped to integer device pixels so adjacent
      // slices never resample across their shared boundary (seam slivers).
      // Rows always draw their PLAIN slice pixels (bubble content is identical
      // and the reacted capture can carry rasterization ghosts in its extra
      // padding); a reacted row just advances by the reacted slice height and
      // gets its badge rectangle overlaid from the reacted capture below.
      type Placed = { stS: number; shS: number; yS: number; reacted: boolean; row: number };
      const placed: Placed[] = [];
      let yS = 0; // stacked height in device pixels
      let lastTrailingGapS = 0;
      for (let j = 0; j < rc; j++) {
        const mid = rowMsgId[j];
        const reacted = !!(tallReacted && mid && plan.activeReactionIds.includes(mid));
        const g = reacted ? geomReact : geomPlain;
        const stS = Math.round(sliceTop(geomPlain, j) * scale);
        const shS = Math.round(sliceBottom(geomPlain, j) * scale) - stS;
        placed.push({ stS, shS, yS, reacted, row: j });
        lastTrailingGapS = Math.round((sliceBottom(g, j) - g.rowBottoms[j]) * scale);
        yS += Math.round(sliceBottom(g, j) * scale) - Math.round(sliceTop(g, j) * scale);
      }
      const rowsBottom = rc > 0 ? (yS - lastTrailingGapS) / scale : padTop;
      const typingTop = rc > 0 ? yS / scale : padTop;
      const contentBottom = typing ? typingTop + typing.height + typingTailH : rowsBottom;
      const targetScroll = Math.max(0, layerOffY + contentBottom + padBottom + feedPadBottom - feedH);
      scroll = scroll < 0 ? targetScroll : scroll + (targetScroll - scroll) * (1 - Math.exp(-(1 / FPS) / SCROLL_SMOOTHING_S));
      // Row/typing/badge positions are layer-relative, so the layer's own
      // offset inside the feed rides along with the scroll offset here.
      const feedTopS = Math.round((feedY + layerOffY - scroll) * scale); // snapped once per frame

      // How far this frame's box (and everything inside it) is shifted from
      // where the captured layout put it — the box hugs the content, so it
      // resizes and re-centres every frame while the capture stayed still.
      // Zero without a scrim (phone mode draws the captured layout as-is).
      let shiftY = 0;
      // How much of the feed, measured down from its own top, this frame is
      // allowed to paint — the box's inner height. Bubbles past it are
      // clipped rather than drawn outside the box.
      let feedPaintH = feedH;

      if (opts?.scrim) {
        const { color, padPx, radiusPx, maxBoxHPx, boxTopRootY } = opts.scrim;
        // Box top padding + the platform's header, which sit above the feed
        // inside the box and must ride along as the box moves.
        const chromeAboveFeed = feedY - boxTopRootY;
        // Content, measured from the feed's own top: the layer's padding
        // plus this frame's stacked rows, minus whatever has scrolled away.
        const contentBelowFeed = Math.max(0, layerOffY - scroll + contentBottom);
        const maxContentBelowFeed = Math.max(0, maxBoxHPx - chromeAboveFeed - padPx);
        feedPaintH = Math.min(contentBelowFeed, maxContentBelowFeed);

        const boxH = chromeAboveFeed + feedPaintH + padPx;
        const boxY = (rootH - boxH) / 2;
        shiftY = boxY + chromeAboveFeed - feedY;

        const padS = Math.round(padPx * scale);
        ctx.fillStyle = color;
        ctx.beginPath();
        const boxXS = Math.round(feedX * scale) - padS;
        const boxWS = Math.round(feedW * scale) + padS * 2;
        const boxYS = Math.round(boxY * scale);
        const boxHS = Math.round(boxH * scale);
        const radiusS = Math.round(radiusPx * scale);
        if (typeof ctx.roundRect === 'function') {
          ctx.roundRect(boxXS, boxYS, boxWS, boxHS, radiusS);
        } else {
          ctx.rect(boxXS, boxYS, boxWS, boxHS);
        }
        ctx.fill();
      }

      const shiftYS = Math.round(shiftY * scale);
      ctx.drawImage(k > 0 ? baseConv : baseEmpty, 0, shiftYS, rootWS, rootHS);
      ctx.save();
      ctx.beginPath();
      ctx.rect(feedX * scale, feedY * scale + shiftYS, feedW * scale, feedPaintH * scale);
      ctx.clip();

      const destX = Math.round((feedX + layerOffX) * scale);
      const layerWS = Math.round(layerW * scale);

      for (const pl of placed) {
        const dTop = feedTopS + shiftYS + pl.yS;
        if (dTop + pl.shS < 0 || dTop > rootHS) continue; // culled
        ctx.drawImage(tallPlain, 0, pl.stS, layerWS, pl.shS, destX, dTop, layerWS, pl.shS);
      }
      // Overlay active badges from the reacted capture (positioned relative
      // to their row's top in the reacted geometry).
      for (const b of badgeRects) {
        const pl = placed[b.row];
        if (!pl || !pl.reacted || !tallReacted) continue;
        const reactTopS = Math.round(sliceTop(geomReact, b.row) * scale);
        const bx = Math.round(b.x * scale);
        const by = Math.round(b.yTop * scale);
        const bw = Math.round(b.w * scale);
        const bh = Math.round(b.h * scale);
        ctx.drawImage(tallReacted, bx, by, bw, bh, destX + bx, feedTopS + shiftYS + pl.yS + (by - reactTopS), bw, bh);
      }

      if (typing) {
        const phase = Math.floor((f - typingSince) / TYPING_PHASE_FRAMES) % typing.canvases.length;
        const sprite = typing.canvases[phase];
        ctx.drawImage(sprite, Math.round((feedX + typing.offX) * scale), feedTopS + shiftYS + Math.round(typingTop * scale));
      }
      ctx.restore();

      // Aurora-style overlay drawn above the feed while typing, pulsing like
      // its CSS animation (opacity 0.55–0.85 over 2.2s).
      if (plan.typingParticipantId && typingOverlay) {
        const t = (f - typingSince) / FPS;
        ctx.globalAlpha = 0.7 + 0.15 * Math.sin((t / 2.2) * 2 * Math.PI);
        ctx.drawImage(typingOverlay.canvas, Math.round(typingOverlay.x * scale), Math.round(typingOverlay.y * scale) + shiftYS);
        ctx.globalAlpha = 1;
      }
    },
  };
}
