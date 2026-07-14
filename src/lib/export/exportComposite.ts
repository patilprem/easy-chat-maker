import { toCanvas, getFontEmbedCSS } from 'html-to-image';
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import type { ChatProject, FramePlan } from '../parser/types';
import { buildFramePlan, FPS } from '../video/chatTimeline';
import { tryEncodeMessageSoundTrack } from './exportAudio';
import { drainEncoderQueue, getExportScale, negotiateVideoConfig, type ExportOptions, type ProgressCallback } from './exportMp4';

/**
 * Sprite-compositing video exporter.
 *
 * Captures each part of the chat ONCE with the browser's real renderer
 * (html-to-image): the empty phone chrome, the full message list as one tall
 * transparent image (with and without reactions), and the typing bubble in
 * three animation phases. Every video frame is then composed on a canvas at
 * the timeline's native 30fps — smooth scrolling, animated typing dots — and
 * encoded with WebCodecs. Preview fidelity without a recording server.
 */

const PHONE_W = 390;
const PHONE_H = 844;
const SCROLL_SMOOTHING_S = 0.12; // exponential smooth-scroll time constant
const TYPING_PHASE_FRAMES = Math.max(1, Math.round(FPS * 0.22));

/** Thrown when the platform's DOM doesn't fit the row model — caller should fall back. */
export class CompositeUnsupportedError extends Error {
  constructor(reason: string) {
    super(`Composite export unsupported: ${reason}`);
    this.name = 'CompositeUnsupportedError';
  }
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 15000);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rafSettle(win: Window, count = 2): Promise<void> {
  return new Promise((resolve) => {
    const step = (n: number) => (n <= 0 ? resolve() : win.requestAnimationFrame(() => step(n - 1)));
    step(count);
  });
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

export async function exportCompositeMp4(
  project: ChatProject,
  onProgress: ProgressCallback,
  options: ExportOptions = {},
): Promise<void> {
  const filename = `${project.platform}-chat.mp4`;
  const messages = project.messages;
  const plans = buildFramePlan(messages, project.participants);
  const audioTrack = await tryEncodeMessageSoundTrack(project, plans.length / FPS, options.includeSounds !== false);
  // 2x for crisp text on desktop, 1x on phones/low-memory devices (see
  // getExportScale) — the 2x buffers can OOM-crash a mobile tab.
  const SCALE = getExportScale();
  const VIDEO_W = PHONE_W * SCALE;
  const VIDEO_H = PHONE_H * SCALE;
  const { config, muxerCodec } = await negotiateVideoConfig(VIDEO_W, VIDEO_H, FPS);

  localStorage.setItem('ecm:v1:export-payload', JSON.stringify(project));
  onProgress('preparing', 2);

  const iframe = document.createElement('iframe');
  iframe.src = `${window.location.origin}/render/chat/?mode=video`;
  Object.assign(iframe.style, {
    position: 'fixed', left: '-9999px', top: '-9999px',
    width: `${PHONE_W}px`, height: `${PHONE_H}px`, border: 'none',
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

    let phoneEl: HTMLElement | null = null;
    for (let i = 0; i < 40 && !phoneEl; i++) {
      phoneEl = doc.getElementById('phone-screen-export');
      if (!phoneEl) await sleep(100);
    }
    if (!phoneEl) throw new Error('#phone-screen-export not found in iframe');

    await Promise.allSettled([
      doc.fonts?.ready ?? Promise.resolve(),
      ...Array.from(doc.images).map(
        (img) => new Promise((r) => { img.complete ? r(null) : (img.onload = img.onerror = r); })
      ),
    ]);
    const fontEmbedCSS = await getFontEmbedCSS(phoneEl).catch(() => '');
    const capture = (el: HTMLElement, bg?: string) =>
      toCanvas(el, { pixelRatio: SCALE, fontEmbedCSS, backgroundColor: bg });

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
    const N = messages.length;
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

    const phoneRect = phoneEl.getBoundingClientRect();
    const feedRect = feed.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const feedX = feedRect.left - phoneRect.left;
    const feedY = feedRect.top - phoneRect.top;
    const feedH = feed.clientHeight;
    const feedW = feed.clientWidth;
    const layerOffX = layerRect.left - feedRect.left;
    const layerW = layerRect.width;
    const layerH = layer.scrollHeight || layerRect.height;
    const rowTops = rows.map((r) => r.getBoundingClientRect().top - layerRect.top);
    const rowBottoms = rows.map((r) => r.getBoundingClientRect().bottom - layerRect.top);
    const padTop = rowTops[0] ?? 0;
    const padBottom = layerH - (rowBottoms[R - 1] ?? layerH);
    const rowGap = R > 1 ? Math.max(0, rowTops[1] - rowBottoms[0]) : 4;

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

    // Contiguous slices tile each tall capture (per its own geometry).
    type Geom = { rowTops: number[]; rowBottoms: number[]; layerH: number };
    const sliceTop = (g: Geom, j: number) => (j === 0 ? 0 : g.rowTops[j]);
    const sliceBottom = (g: Geom, j: number) => (j < R - 1 ? g.rowTops[j + 1] : g.layerH);
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

    onProgress('preparing', 8);
    const tallPlain = await captureTall();

    // Reactions can change row heights (badge spacing), so the reacted state
    // gets its own capture AND its own geometry; frames stack per-row slices
    // cumulatively so mixed states stay seamless.
    const reactionIds = messages
      .filter((m) => 'reaction' in m && (m as { reaction?: { emoji?: string } }).reaction?.emoji)
      .map((m) => m.id);
    let tallReacted: HTMLCanvasElement | null = null;
    let geomReact = { rowTops, rowBottoms, layerH };
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

    onProgress('preparing', 14);
    const baseBg = project.theme === 'dark' ? '#0b141a' : '#ffffff';
    await setFrame(noTyping(0));
    await sleep(100);
    const baseEmpty = await capture(phoneEl, baseBg);

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
    const baseConv = await capture(phoneEl, baseBg);
    for (const r of convRows) r.style.visibility = '';
    await rafSettle(win);

    // Typing bubble sprites: 3 live phases of the CSS dot animation.
    const typingPids = Array.from(new Set(plans.map((p) => p.typingParticipantId).filter((p): p is string => !!p)));
    const typingSprites = new Map<string, { canvases: HTMLCanvasElement[]; height: number; offX: number }>();
    // Full-phone typing overlay (Gemini's aurora shimmer): captured once and
    // pulsed via globalAlpha during typing frames.
    let typingOverlay: { canvas: HTMLCanvasElement; x: number; y: number } | null = null;
    for (const pid of typingPids) {
      await setFrame({ visibleCount: 0, typingParticipantId: pid, activeReactionIds: [], scrollY: 0 });
      await sleep(120);
      if (!typingOverlay) {
        const overlayEl = doc.querySelector<HTMLElement>('[data-export-typing-overlay]');
        if (overlayEl) {
          const oRect = overlayEl.getBoundingClientRect();
          typingOverlay = {
            // Neutralize absolute positioning and animation on the clone
            // root — captured as-is, an inset-anchored element renders
            // empty. Full opacity here; frames pulse it via globalAlpha.
            canvas: await toCanvas(overlayEl, {
              pixelRatio: SCALE,
              fontEmbedCSS,
              width: Math.round(oRect.width),
              height: Math.round(oRect.height),
              style: { position: 'static', inset: 'auto', animation: 'none', opacity: '1', transform: 'none' },
            }),
            x: oRect.left - phoneRect.left,
            y: oRect.top - phoneRect.top,
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
      let row: HTMLElement = dot;
      while (row.parentElement && row.parentElement !== feed && row.parentElement !== layer) row = row.parentElement;
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

    // ---- Compose & encode ----
    onProgress('encoding', 18);
    const outCanvas = document.createElement('canvas');
    outCanvas.width = VIDEO_W;
    outCanvas.height = VIDEO_H;
    const ctx = outCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not create export canvas.');

    const muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: { codec: muxerCodec, width: VIDEO_W, height: VIDEO_H },
      ...(audioTrack
        ? { audio: { codec: audioTrack.muxerCodec, sampleRate: audioTrack.sampleRate, numberOfChannels: audioTrack.numberOfChannels } }
        : {}),
      fastStart: 'in-memory',
    });
    let encoderError: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => { encoderError = e; },
    });
    encoder.configure(config);

    // Track when the current typing session started, for the dot cycle phase.
    let typingSince = -1;
    let scroll = -1;

    for (let f = 0; f < plans.length; f++) {
      if (encoderError) throw encoderError;
      const plan = plans[f];
      const k = plan.visibleCount;

      if (plan.typingParticipantId) {
        if (typingSince === -1 || plans[f - 1]?.typingParticipantId !== plan.typingParticipantId) typingSince = f;
      } else {
        typingSince = -1;
      }

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
        const stS = Math.round(sliceTop(geomPlain, j) * SCALE);
        const shS = Math.round(sliceBottom(geomPlain, j) * SCALE) - stS;
        placed.push({ stS, shS, yS, reacted, row: j });
        lastTrailingGapS = Math.round((sliceBottom(g, j) - g.rowBottoms[j]) * SCALE);
        yS += Math.round(sliceBottom(g, j) * SCALE) - Math.round(sliceTop(g, j) * SCALE);
      }
      const rowsBottom = rc > 0 ? (yS - lastTrailingGapS) / SCALE : padTop;
      const typingTop = rc > 0 ? yS / SCALE : padTop;
      const contentBottom = typing ? typingTop + typing.height : rowsBottom;
      const targetScroll = Math.max(0, contentBottom + padBottom - feedH);
      scroll = scroll < 0 ? targetScroll : scroll + (targetScroll - scroll) * (1 - Math.exp(-(1 / FPS) / SCROLL_SMOOTHING_S));

      ctx.drawImage(k > 0 ? baseConv : baseEmpty, 0, 0, VIDEO_W, VIDEO_H);
      ctx.save();
      ctx.beginPath();
      ctx.rect(feedX * SCALE, feedY * SCALE, feedW * SCALE, feedH * SCALE);
      ctx.clip();

      const destX = Math.round((feedX + layerOffX) * SCALE);
      const layerWS = Math.round(layerW * SCALE);
      const feedTopS = Math.round((feedY - scroll) * SCALE); // scroll offset, snapped once per frame

      for (const pl of placed) {
        const dTop = feedTopS + pl.yS;
        if (dTop + pl.shS < 0 || dTop > VIDEO_H) continue; // culled
        ctx.drawImage(tallPlain, 0, pl.stS, layerWS, pl.shS, destX, dTop, layerWS, pl.shS);
      }
      // Overlay active badges from the reacted capture (positioned relative
      // to their row's top in the reacted geometry).
      for (const b of badgeRects) {
        const pl = placed[b.row];
        if (!pl || !pl.reacted || !tallReacted) continue;
        const reactTopS = Math.round(sliceTop(geomReact, b.row) * SCALE);
        const bx = Math.round(b.x * SCALE);
        const by = Math.round(b.yTop * SCALE);
        const bw = Math.round(b.w * SCALE);
        const bh = Math.round(b.h * SCALE);
        ctx.drawImage(tallReacted, bx, by, bw, bh, destX + bx, feedTopS + pl.yS + (by - reactTopS), bw, bh);
      }

      if (typing) {
        const phase = Math.floor((f - typingSince) / TYPING_PHASE_FRAMES) % typing.canvases.length;
        const sprite = typing.canvases[phase];
        ctx.drawImage(sprite, Math.round((feedX + typing.offX) * SCALE), feedTopS + Math.round(typingTop * SCALE));
      }
      ctx.restore();

      // Aurora-style overlay drawn above the feed while typing, pulsing like
      // its CSS animation (opacity 0.55–0.85 over 2.2s).
      if (plan.typingParticipantId && typingOverlay) {
        const t = (f - typingSince) / FPS;
        ctx.globalAlpha = 0.7 + 0.15 * Math.sin((t / 2.2) * 2 * Math.PI);
        ctx.drawImage(typingOverlay.canvas, Math.round(typingOverlay.x * SCALE), Math.round(typingOverlay.y * SCALE));
        ctx.globalAlpha = 1;
      }

      const videoFrame = new VideoFrame(outCanvas, {
        timestamp: Math.round((f / FPS) * 1_000_000),
        duration: Math.round((1 / FPS) * 1_000_000),
      });
      encoder.encode(videoFrame, { keyFrame: f % (FPS * 2) === 0 });
      videoFrame.close();
      // Bound the encoder queue — on phones the encoder can't keep up with
      // frame production, and an unbounded queue OOM-kills the tab.
      await drainEncoderQueue(encoder);
      if (f % 3 === 0) onProgress('encoding', 18 + (f / plans.length) * 72);
      // Yield periodically so the UI stays responsive
      if (f % 30 === 0) await sleep(0);
    }

    await encoder.flush();
    onProgress('muxing', 92);
    if (audioTrack) {
      for (const { chunk, meta } of audioTrack.chunks) muxer.addAudioChunk(chunk, meta);
    }
    muxer.finalize();
    const { buffer } = muxer.target as ArrayBufferTarget;
    onProgress('downloading', 98);
    triggerDownload(new Blob([buffer], { type: 'video/mp4' }), filename);
    onProgress('idle', 100);
  } finally {
    document.body.removeChild(iframe);
  }
}
