import { toBlob } from 'html-to-image';
import type { ChatProject } from '../parser/types';

const EXPORT_SCREEN_WIDTH = 370;
const EXPORT_SCREEN_HEIGHT = 824;

/**
 * The editor renders TWO phone previews (desktop and mobile layouts), one of
 * which is always display:none — and both carry id="phone-screen". A plain
 * getElementById/querySelector returns whichever comes first in the DOM (the
 * desktop one), which on mobile is the HIDDEN instance: its feed reports
 * scrollTop 0, so exports always captured the top of the chat. Resolve the
 * VISIBLE instance instead.
 */
function getVisibleLiveScreen(): HTMLElement | null {
  const screens = Array.from(document.querySelectorAll<HTMLElement>('[id="phone-screen"]'));
  return screens.find((s) => s.clientHeight > 0 && s.offsetParent !== null) ?? screens[0] ?? null;
}

function getLiveScreenSize(): { width: number; height: number } {
  const liveScreen = getVisibleLiveScreen();
  if (!liveScreen) {
    return { width: EXPORT_SCREEN_WIDTH, height: EXPORT_SCREEN_HEIGHT };
  }

  const rect = liveScreen.getBoundingClientRect();
  // clientWidth/Height are unaffected by the mobile layout's scale() transform,
  // so prefer them over the (scaled) bounding rect.
  const measuredWidth = liveScreen.clientWidth || rect.width;
  const measuredHeight = liveScreen.clientHeight || rect.height;
  return {
    width: Math.round(measuredWidth || EXPORT_SCREEN_WIDTH),
    height: Math.round(measuredHeight || EXPORT_SCREEN_HEIGHT),
  };
}

function forceRenderSize(doc: Document, el: HTMLElement, size: { width: number; height: number }): void {
  const width = `${size.width}px`;
  const height = `${size.height}px`;

  doc.documentElement.style.width = width;
  doc.documentElement.style.height = height;
  doc.documentElement.style.overflow = 'hidden';
  doc.body.style.width = width;
  doc.body.style.height = height;
  doc.body.style.overflow = 'hidden';
  el.style.width = width;
  el.style.height = height;
  el.style.minHeight = '0';

  const renderedChat = el.firstElementChild;
  if (renderedChat instanceof HTMLElement) {
    renderedChat.style.width = '100%';
    renderedChat.style.height = '100%';
    renderedChat.style.minHeight = '0';
    renderedChat.style.overflow = 'hidden';
  }
}

function waitForFrame(win: Window | null): Promise<void> {
  const raf = win?.requestAnimationFrame?.bind(win) ?? requestAnimationFrame;
  return new Promise((resolve) => raf(() => resolve()));
}

function freezeFeedAtScrollPosition(feed: HTMLElement, scrollTop: number): void {
  // Translate the `.z-10` message layer up to reproduce the live scroll (the
  // rasterizer, html-to-image, can't capture a live scrollTop). Translate the
  // message layer ITSELF, not the full-height wrapper around it: a transform
  // on a `min-height:100%` wrapper does not survive the clone, which pinned
  // every export to the top.
  //
  // The wallpaper is a sibling of the rows inside that same wrapper, so it
  // spans the whole conversation and scrolls with it in the live preview.
  // Leaving it behind here would export a different slice of the pattern than
  // the preview shows, so it gets the same shift — it's an absolutely
  // positioned plain div, so its transform clones fine.
  let messageLayer: HTMLElement | null = feed.querySelector<HTMLElement>('.z-10');

  if (!messageLayer) {
    messageLayer = feed.ownerDocument.createElement('div');
    messageLayer.dataset.exportScrollLayer = 'true';
    while (feed.firstChild) {
      messageLayer.appendChild(feed.firstChild);
    }
    feed.appendChild(messageLayer);
  }

  feed.style.scrollBehavior = 'auto';
  feed.style.overflowY = 'hidden';
  feed.style.position = feed.style.position || 'relative';
  feed.scrollTop = 0;
  messageLayer.style.position = messageLayer.style.position || 'relative';
  messageLayer.style.transform = `translateY(-${scrollTop}px)`;
  messageLayer.style.transformOrigin = 'top left';
  messageLayer.style.willChange = 'transform';

  for (const wallpaper of Array.from(
    feed.querySelectorAll<HTMLElement>('[data-chat-wallpaper]')
  )) {
    wallpaper.style.transform = `translateY(-${scrollTop}px)`;
    wallpaper.style.transformOrigin = 'top left';
  }
}

/**
 * Content height of the feed, derived from the message layer rather than the
 * feed's own scroll metrics — in the export iframe the feed can report no
 * overflow at all (scrollHeight === clientHeight).
 */
function measureFeedContentHeight(feed: HTMLElement): number {
  const z10 = feed.querySelector<HTMLElement>('.z-10');
  let layer: HTMLElement = feed;
  if (z10) {
    layer = z10;
    while (layer.parentElement && layer.parentElement !== feed) layer = layer.parentElement;
  }
  return Math.max(
    feed.scrollHeight,
    layer.scrollHeight,
    Math.ceil(layer.getBoundingClientRect().height),
  );
}

/**
 * A full-chat export can be many thousands of pixels tall, and every browser
 * caps how big a canvas may be — iOS Safari most aggressively. Scale the pixel
 * ratio down to fit rather than handing back a blank or failed capture.
 */
const MAX_CANVAS_DIM = 16384;
const MAX_CANVAS_AREA = 40_000_000;

function fitPixelRatio(width: number, height: number, desired: number): number {
  const byDim = MAX_CANVAS_DIM / Math.max(width, height);
  const byArea = Math.sqrt(MAX_CANVAS_AREA / (width * height));
  return Math.max(1, Math.min(desired, byDim, byArea));
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

/**
 * `preview` captures exactly what the phone preview shows right now — one
 * screen, at the scroll position the user left it at.
 *
 * `full` captures the entire conversation as one tall image, the way a
 * scrolling screenshot does: the render is grown until the feed no longer
 * overflows, so there is no scroll position to reproduce at all.
 */
export type PngScope = 'preview' | 'full';

export async function exportPng(project: ChatProject, scope: PngScope = 'preview'): Promise<void> {
  const filename = scope === 'full'
    ? `${project.platform}-chat-full.png`
    : `${project.platform}-chat.png`;
  const screenSize = getLiveScreenSize();
  let exportSize = { ...screenSize };
  const liveFeed = getVisibleLiveScreen()?.querySelector<HTMLElement>('.phone-chat-scroll') ?? null;
  const liveScrollState = liveFeed
    ? {
        top: liveFeed.scrollTop,
        max: Math.max(0, liveFeed.scrollHeight - liveFeed.clientHeight),
      }
    : null;

  // Render via an iframe at the live preview's screen size so wrapping,
  // scroll position, and visible content match the editor preview.
  localStorage.setItem('ecm:v1:export-payload', JSON.stringify(project));
  const iframe = document.createElement('iframe');
  // `tile` lets a photo wallpaper repeat once per screen down a full-chat
  // render instead of being stretched over the whole height.
  const tileParam = scope === 'full' ? `&tile=${screenSize.height}` : '';
  iframe.src = `${window.location.origin}/render/chat/?mode=export&w=${screenSize.width}&h=${screenSize.height}${tileParam}`;
  Object.assign(iframe.style, {
    position: 'fixed', left: '-9999px', top: '-9999px',
    width: `${screenSize.width}px`, height: `${screenSize.height}px`, border: 'none',
  });
  document.body.appendChild(iframe);

  try {
    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => resolve();
      iframe.onerror = () => reject(new Error('Iframe load failed'));
      setTimeout(() => reject(new Error('Iframe timeout')), 12000);
    });

    const iframeDoc = iframe.contentDocument;
    if (!iframeDoc) throw new Error('Iframe inaccessible');

    let el: HTMLElement | null = null;
    for (let i = 0; i < 40; i++) {
      el = iframeDoc.getElementById('phone-screen-export');
      if (el) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    if (!el) throw new Error('Export element not found in iframe');
    forceRenderSize(iframeDoc, el, exportSize);
    await waitForFrame(iframe.contentWindow);

    // Wait for the hidden render document to finish laying out its own fonts/images.
    await Promise.allSettled([
      iframeDoc.fonts?.ready ?? Promise.resolve(),
      ...Array.from(iframeDoc.images).map(
        (img) => new Promise((r) => { img.complete ? r(null) : (img.onload = img.onerror = r); })
      ),
    ]);

    const feed = iframeDoc.querySelector<HTMLElement>('.phone-chat-scroll');

    if (scope === 'full' && feed) {
      // Grow the whole screen until the feed stops overflowing, so the capture
      // holds the entire conversation. Growing reflows (a taller feed can change
      // how `min-h-full` wrappers and empty states size), so re-measure and
      // repeat until it settles.
      for (let pass = 0; pass < 5; pass++) {
        const extra = Math.max(0, measureFeedContentHeight(feed) - feed.clientHeight);
        if (extra < 1) break;
        exportSize = { width: exportSize.width, height: exportSize.height + Math.ceil(extra) };
        iframe.style.height = `${exportSize.height}px`;
        forceRenderSize(iframeDoc, el, exportSize);
        await waitForFrame(iframe.contentWindow);
        await waitForFrame(iframe.contentWindow);
      }
      // Nothing overflows now, so there is no scroll position to freeze.
      feed.style.overflowY = 'hidden';
      feed.scrollTop = 0;
      await waitForFrame(iframe.contentWindow);
    } else if (feed) {
      // Derive the scrollable range from the message layer's real content
      // height, not the feed's own scroll metrics. In the export iframe the
      // feed can report no overflow (scrollHeight === clientHeight), which
      // makes exportMax 0 and pins every export to the top regardless of where
      // the user scrolled. The layer (the feed's direct child wrapping the
      // .z-10 rows) always reflects the true content height.
      const contentH = measureFeedContentHeight(feed);
      const exportMax = Math.max(0, contentH - feed.clientHeight);
      // Match the live preview by scroll FRACTION so it stays correct even when
      // the export's screen dimensions differ from the editor's.
      const fraction = liveScrollState && liveScrollState.max > 0
        ? Math.min(1, Math.max(0, liveScrollState.top / liveScrollState.max))
        : 0;
      const targetScrollTop = fraction * exportMax;

      feed.scrollTop = Math.min(targetScrollTop, exportMax);
      await waitForFrame(iframe.contentWindow);
      await waitForFrame(iframe.contentWindow);
      // Freeze via transform (works regardless of whether the feed natively
      // overflows in the export clone).
      freezeFeedAtScrollPosition(feed, targetScrollTop);
      await waitForFrame(iframe.contentWindow);
    }

    // A long chat can outgrow the browser's canvas limits at full resolution,
    // so step the pixel ratio down until one sticks rather than failing.
    const ratios = [fitPixelRatio(exportSize.width, exportSize.height, 2.8), 2, 1.5, 1]
      .filter((r, i, all) => r > 0 && all.indexOf(r) === i);

    let blob: Blob | null = null;
    let lastError: unknown = null;
    for (const pixelRatio of ratios) {
      try {
        blob = await toBlob(el, {
          width: exportSize.width,
          height: exportSize.height,
          style: {
            width: `${exportSize.width}px`,
            height: `${exportSize.height}px`,
          },
          pixelRatio,
          // NOT cacheBust: it appends `?<timestamp>` to every resource URL,
          // and a blob: URL with a query string no longer resolves to its blob
          // — so uploaded photos (wallpapers, sent images, avatars) fetched as
          // blob: URLs came back empty. The video exporters never set it, which
          // is why images survive there. Nothing here needs cache busting: the
          // doodle assets are immutable and every new upload gets a fresh URL.
          cacheBust: false,
          backgroundColor: project.theme === 'dark' ? '#0b141a' : '#ffffff',
        });
      } catch (e) {
        lastError = e;
        blob = null;
      }
      if (blob) break;
    }
    if (!blob) {
      throw lastError instanceof Error
        ? lastError
        : new Error('PNG export failed — this chat may be too long to capture in one image.');
    }
    triggerDownload(blob, filename);
  } finally {
    document.body.removeChild(iframe);
  }
}
