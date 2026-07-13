import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChatPreview } from '../chat/ChatPreview';
import { buildFramePlan, FPS } from '../../lib/video/chatTimeline';
import type { ChatProject, FramePlan } from '../../lib/parser/types';

interface Props {
  mode: 'export' | 'video';
}

function getRuntimeConfig(fallbackMode: Props['mode']): {
  mode: Props['mode'];
  width: number;
  height: number;
  scale: number;
  autoplay: boolean;
} {
  if (typeof window === 'undefined') {
    return fallbackMode === 'video'
      ? { mode: 'video', width: 390, height: 844, scale: 1, autoplay: false }
      : { mode: 'export', width: 370, height: 824, scale: 1, autoplay: false };
  }

  const params = new URLSearchParams(window.location.search);
  const mode = params.get('mode') === 'video' ? 'video' : fallbackMode;
  const requestedWidth = Number(params.get('w'));
  const requestedHeight = Number(params.get('h'));
  const requestedScale = Number(params.get('scale'));
  const fallback = mode === 'video'
    ? { width: 390, height: 844 }
    : { width: 370, height: 824 };

  return {
    mode,
    width: Number.isFinite(requestedWidth) && requestedWidth > 0 ? requestedWidth : fallback.width,
    height: Number.isFinite(requestedHeight) && requestedHeight > 0 ? requestedHeight : fallback.height,
    scale: Number.isFinite(requestedScale) && requestedScale > 0 ? requestedScale : 1,
    autoplay: params.get('autoplay') === '1',
  };
}

export const RenderChatApp: React.FC<Props> = ({ mode }) => {
  const [runtimeConfig] = useState(() => getRuntimeConfig(mode));
  const [project, setProject] = useState<ChatProject | null>(null);
  const [framePlan, setFramePlan] = useState<FramePlan[]>([]);
  const [currentFrame, setCurrentFrame] = useState<FramePlan | null>(null);
  const [renderToken, setRenderToken] = useState<string | null>(null);
  const [pinScroll, setPinScroll] = useState(false);
  const [noScroll, setNoScroll] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  const getCompleteFrame = (p: ChatProject): FramePlan => ({
    visibleCount: p.messages.length,
    typingParticipantId: null,
    activeReactionIds: p.messages
      .filter((message) => 'reaction' in message && message.reaction?.emoji)
      .map((message) => message.id),
    scrollY: Number.MAX_SAFE_INTEGER,
  });

  useEffect(() => {
    // Load project from localStorage
    try {
      const raw = localStorage.getItem('ecm:v1:export-payload');
      if (raw) {
        const p = JSON.parse(raw) as ChatProject;
        setProject(p);
        const plan = buildFramePlan(p.messages, p.participants);
        setFramePlan(plan);
        if (runtimeConfig.mode === 'export') {
          // Show all messages for static PNG export
          setCurrentFrame(null);
        } else {
          // Start at frame 0 for video
          setCurrentFrame(plan[0] ?? null);
        }
      }
    } catch (e) {
      console.error('RenderChatApp: failed to load project', e);
    }
  }, [runtimeConfig.mode]);

  useEffect(() => {
    // Listen for frame commands from parent (video mode)
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'SET_FRAME') {
        const { frame, plan, token, pin, noscroll } = event.data as { frame: number; plan?: FramePlan; token?: string; pin?: boolean; noscroll?: boolean };
        setRenderToken(token ?? null);
        setPinScroll(pin === true);
        setNoScroll(noscroll === true);
        if (plan) {
          setCurrentFrame(plan);
        } else if (framePlan[frame]) {
          setCurrentFrame(framePlan[frame]);
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [framePlan]);

  useEffect(() => {
    if (runtimeConfig.mode !== 'video' || !runtimeConfig.autoplay || framePlan.length === 0) return;

    let raf = 0;
    let startTime = 0;
    let doneTimer = 0;
    let didFinish = false;
    (window as any).__ECM_VIDEO_DONE = false;

    const tick = (timestamp: number) => {
      if (didFinish) return;
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const frameIndex = Math.min(Math.floor(elapsed / (1000 / FPS)), framePlan.length - 1);
      setCurrentFrame(framePlan[frameIndex]);

      if (frameIndex >= framePlan.length - 1) {
        didFinish = true;
        if (project) {
          setCurrentFrame(getCompleteFrame(project));
        }
        doneTimer = window.setTimeout(() => {
          const feed = feedRef.current;
          if (feed) feed.scrollTop = feed.scrollHeight;
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              (window as any).__ECM_VIDEO_DONE = true;
              window.dispatchEvent(new CustomEvent('ecm-video-done'));
            });
          });
        }, 1400);
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(doneTimer);
    };
  }, [framePlan, project, runtimeConfig.autoplay, runtimeConfig.mode]);

  // DOM-cloning frame capture (html-to-image) cannot see live scrollTop
  // state, so per-frame capturers ask for the feed to be pinned to its
  // latest content with a translateY transform instead of being scrolled —
  // the same trick as freezeFeedAtScrollPosition in exportPng. Opt-in via
  // SET_FRAME's `pin` flag: the composite exporter measures row geometry
  // and captures the tall message layer directly, so it must NOT get
  // transforms injected under it.
  const applyPinnedScroll = useCallback(() => {
    const feed = feedRef.current;
    if (!feed) return;
    feed.style.scrollBehavior = 'auto';
    feed.style.overflowY = 'hidden';
    feed.scrollTop = 0;

    const win = feed.ownerDocument.defaultView;
    const layers = (Array.from(feed.children) as HTMLElement[]).filter(
      (child) => child.nodeType === 1 && win?.getComputedStyle(child).position !== 'absolute'
    );
    for (const layer of layers) layer.style.transform = '';
    const offset = Math.max(0, feed.scrollHeight - feed.clientHeight);
    if (offset > 0) {
      for (const layer of layers) layer.style.transform = `translateY(-${offset}px)`;
    }
  }, []);

  useEffect(() => {
    if (runtimeConfig.mode !== 'video' || !currentFrame || !feedRef.current) return;

    const raf = requestAnimationFrame(() => {
      const feed = feedRef.current;
      if (!feed) return;
      if (pinScroll) {
        applyPinnedScroll();
      } else if (!noScroll) {
        // noscroll: the composite exporter measures layout-true row geometry
        // and composes scrolling itself, so the live feed must stay put.
        feed.scrollTo({
          top: feed.scrollHeight,
          behavior: runtimeConfig.autoplay ? 'auto' : 'smooth',
        });
      }
      requestAnimationFrame(() => {
        if (renderToken) {
          (window as any).__ECM_FRAME_READY = renderToken;
        }
      });
    });

    return () => cancelAnimationFrame(raf);
  }, [currentFrame?.visibleCount, currentFrame?.typingParticipantId, currentFrame?.activeReactionIds?.length, renderToken, pinScroll, noScroll, runtimeConfig.mode, runtimeConfig.autoplay, applyPinnedScroll]);

  if (!project) {
    return (
      <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
        Loading...
      </div>
    );
  }

  const scaledWidth = runtimeConfig.width * runtimeConfig.scale;
  const scaledHeight = runtimeConfig.height * runtimeConfig.scale;

  return (
    <div
      style={{
        width: scaledWidth,
        height: scaledHeight,
        overflow: 'hidden',
      }}
    >
    <ChatPreview
      project={project}
      mode={runtimeConfig.mode === 'export' ? 'export' : 'video'}
      id="phone-screen-export"
      style={{
        width: runtimeConfig.width,
        height: runtimeConfig.height,
        transform: `scale(${runtimeConfig.scale})`,
        transformOrigin: 'top left',
      }}
      visibleCount={currentFrame?.visibleCount}
      typingParticipantId={currentFrame?.typingParticipantId}
      activeReactionIds={currentFrame?.activeReactionIds}
      feedRef={feedRef}
    />
    </div>
  );
};
