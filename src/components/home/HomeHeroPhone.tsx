import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatPreview } from '../chat/ChatPreview';
import { buildFramePlan, FPS } from '../../lib/video/chatTimeline';
import { generateInitialsAvatar } from '../../lib/parser/parseChatScript';
import type { ChatProject, Message, Participant, Platform } from '../../lib/parser/types';

const CYCLE: Platform[] = ['whatsapp', 'chatgpt', 'instagram', 'slack', 'gemini', 'telegram'];

const SUBTITLE: Record<string, string> = {
  whatsapp: 'online',
  chatgpt: '',
  instagram: 'Active now',
  slack: '3 tabs',
  gemini: 'Flash',
  telegram: 'last seen recently',
};

const PARTICIPANTS: Participant[] = [
  { id: 'you', name: 'You', isSelf: true, avatarUrl: generateInitialsAvatar('You', true) },
  { id: 'alex', name: 'Alex', isSelf: false, avatarUrl: generateInitialsAvatar('Alex', false) },
];

const MESSAGES: Message[] = [
  { id: 'm1', kind: 'text', participantId: 'you', text: 'How do I respond to customers faster? 👋', time: '9:41 am' },
  { id: 'm2', kind: 'text', participantId: 'alex', text: 'Instant replies and round-the-clock automation ⚡', time: '9:41 am' },
  { id: 'm3', kind: 'text', participantId: 'you', text: 'And keeping conversations organized?', time: '9:42 am' },
  { id: 'm4', kind: 'text', participantId: 'alex', text: 'Tag and categorize every chat for quick follow-ups ✅', time: '9:42 am', reaction: { emoji: '👍' } },
  { id: 'm5', kind: 'text', participantId: 'you', text: 'Perfect. Let’s set it up 🎉', time: '9:43 am' },
];

// Playback speed multiplier — the hero demo runs faster than real-time
const SPEED = 2.5;
const HOLD_FRAMES = Math.round(FPS * 1.2);

// Design size of the cropped phone; scaled down to fit narrow screens
const PHONE_W = 396;
const PHONE_H = 560;

export const HomeHeroPhone: React.FC = () => {
  const [platformIdx, setPlatformIdx] = useState(0);
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Must start at 1 to match the SSR HTML — React 19 won't patch style
  // attributes that mismatch during hydration, so a viewport-seeded
  // initial value would leave the server-rendered 396px in the DOM
  // forever. The effect below shrinks it right after mount instead.
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    // Slightly smaller than the container so the phone gets breathing room
    // on narrow screens; full design size once there's space for it.
    const update = () => setScale(Math.min(1, (el.clientWidth - 24) / PHONE_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const framePlan = useMemo(() => buildFramePlan(MESSAGES, PARTICIPANTS), []);

  const platform = CYCLE[platformIdx];

  const project = useMemo<ChatProject>(() => ({
    id: 'home-demo',
    platform,
    theme: platform === 'chatgpt' || platform === 'slack' || platform === 'gemini' ? 'dark' : 'light',
    deviceOS: 'ios',
    title: 'Alex',
    subtitle: SUBTITLE[platform],
    isGroup: false,
    participants: PARTICIPANTS,
    messages: MESSAGES,
    exportConsentAccepted: false,
  }), [platform]);

  // Reduced motion: show the finished conversation, no animation
  const prefersReduced = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (prefersReduced) return;
    const tick = (timestamp: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      if (timestamp - lastTimeRef.current >= 1000 / FPS) {
        lastTimeRef.current = timestamp;
        frameRef.current += SPEED;
        if (frameRef.current >= framePlan.length + HOLD_FRAMES) {
          frameRef.current = 0;
          setPlatformIdx((i) => (i + 1) % CYCLE.length);
        }
        setFrame(Math.floor(frameRef.current));
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [framePlan, prefersReduced]);

  const plan = framePlan[Math.min(frame, framePlan.length - 1)];

  // Keep the feed scrolled to the newest message
  const prevVisibleRef = useRef(0);
  const prevTypingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!plan) return;
    if (plan.visibleCount !== prevVisibleRef.current || plan.typingParticipantId !== prevTypingRef.current) {
      prevVisibleRef.current = plan.visibleCount;
      prevTypingRef.current = plan.typingParticipantId;
      requestAnimationFrame(() => {
        feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
      });
    }
  }, [plan]);

  return (
    <div ref={wrapRef} className="flex w-full flex-col items-center">
      {/* Phone — cropped to the top half, watch-only: mouse/scroll passes through */}
      {/* width also capped in CSS so the SSR HTML can never overflow, even before hydration */}
      <div className="relative" style={{ width: `min(${PHONE_W * scale}px, 100%)`, height: PHONE_H * scale, overflow: 'hidden', pointerEvents: 'none' }}>
        <div
          className="relative origin-top-left"
          style={{ width: 360, height: 780, transform: `scale(${1.1 * scale})` }}
        >
          <div
            className="absolute inset-0 overflow-hidden rounded-[44px] border-[10px] border-[#1a1a1a] bg-[#1a1a1a]"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 30px 80px rgba(0,0,0,0.5)' }}
          >
            <div className="absolute left-1/2 top-0 z-50 h-6 w-28 -translate-x-1/2 rounded-b-2xl" style={{ background: '#1a1a1a' }} />
            <ChatPreview
              project={project}
              mode="video"
              visibleCount={prefersReduced ? MESSAGES.length : plan?.visibleCount}
              typingParticipantId={prefersReduced ? null : plan?.typingParticipantId}
              activeReactionIds={prefersReduced ? ['m4'] : plan?.activeReactionIds}
              feedRef={feedRef}
            />
          </div>
        </div>
        {/* Soft fade where the phone is cropped */}
        <div
          className="absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(to bottom, transparent, #0c1322)' }}
        />
      </div>
    </div>
  );
};
