import { toBlob } from 'html-to-image';
import type { ChatProject } from '../parser/types';

const EXPORT_SCREEN_WIDTH = 370;
const EXPORT_SCREEN_HEIGHT = 824;

function getLiveScreenSize(): { width: number; height: number } {
  const liveScreen = document.getElementById('phone-screen');
  if (!liveScreen) {
    return { width: EXPORT_SCREEN_WIDTH, height: EXPORT_SCREEN_HEIGHT };
  }

  const rect = liveScreen.getBoundingClientRect();
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
  let messageLayer = Array.from(feed.children).find(
    (child): child is HTMLElement =>
      child instanceof HTMLElement && child.classList.contains('z-10')
  );

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

export async function exportPng(project: ChatProject): Promise<void> {
  const filename = `${project.platform}-chat.png`;
  const exportSize = getLiveScreenSize();
  const liveFeed = document.querySelector<HTMLElement>('#phone-screen .phone-chat-scroll');
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
  iframe.src = `${window.location.origin}/render/chat/?mode=export&w=${exportSize.width}&h=${exportSize.height}`;
  Object.assign(iframe.style, {
    position: 'fixed', left: '-9999px', top: '-9999px',
    width: `${exportSize.width}px`, height: `${exportSize.height}px`, border: 'none',
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
    if (feed) {
      const exportMax = Math.max(0, feed.scrollHeight - feed.clientHeight);
      const dimensionsMatch = liveFeed
        ? liveFeed.clientWidth === feed.clientWidth && liveFeed.clientHeight === feed.clientHeight
        : false;
      const targetScrollTop = liveScrollState && dimensionsMatch
        ? liveScrollState.top
        : liveScrollState && liveScrollState.max > 0
        ? (liveScrollState.top / liveScrollState.max) * exportMax
        : liveScrollState?.top ?? 0;

      feed.scrollTop = Math.min(targetScrollTop, exportMax);
      await waitForFrame(iframe.contentWindow);
      await waitForFrame(iframe.contentWindow);
      freezeFeedAtScrollPosition(feed, Math.min(targetScrollTop, exportMax));
      await waitForFrame(iframe.contentWindow);
    }

    const blob = await toBlob(el, {
      width: exportSize.width,
      height: exportSize.height,
      style: {
        width: `${exportSize.width}px`,
        height: `${exportSize.height}px`,
      },
      pixelRatio: 2.8,
      cacheBust: true,
      backgroundColor: project.theme === 'dark' ? '#0b141a' : '#ffffff',
    });
    if (!blob) throw new Error('PNG export failed');
    triggerDownload(blob, filename);
  } finally {
    document.body.removeChild(iframe);
  }
}
