import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChatPreview } from '../chat/ChatPreview';
import { buildFramePlan, FPS } from '../../lib/video/chatTimeline';
import { generateInitialsAvatar } from '../../lib/parser/parseChatScript';
import type { ChatProject, Message, Participant, Platform } from '../../lib/parser/types';

const CYCLE: Platform[] = ['whatsapp', 'chatgpt', 'instagram', 'slack', 'gemini', 'telegram'];

const PLATFORM_LABEL: Record<string, string> = {
  whatsapp: 'WhatsApp-style',
  chatgpt: 'ChatGPT',
  instagram: 'Instagram DM',
  slack: 'Slack',
  gemini: 'Gemini',
  telegram: 'Telegram',
};

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

const HOLD_FRAMES = Math.round(FPS * 2.2);

export const HomeHeroPhone: React.FC = () => {
  const [platformIdx, setPlatformIdx] = useState(0);
  const [frame, setFrame] = useState(0);
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

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
        frameRef.current += 1;
        if (frameRef.current >= framePlan.length + HOLD_FRAMES) {
          frameRef.current = 0;
          setPlatformIdx((i) => (i + 1) % CYCLE.length);
        }
        setFrame(frameRef.current);
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
    <div className="flex flex-col items-center gap-4">
      {/* Platform label */}
      <span
        key={platform}
        className="rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-[13px] font-semibold text-white/80"
        style={{ animation: 'hero-label-in 0.5s ease' }}
      >
        {PLATFORM_LABEL[platform]}
      </span>

      {/* Phone — watch-only: let mouse/scroll events pass through to the page */}
      <div style={{ width: 300, height: 650, pointerEvents: 'none' }}>
        <div
          className="relative origin-top-left"
          style={{ width: 360, height: 780, transform: 'scale(0.833)' }}
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
              activeReactionIds={prefersReduced ? ['m3'] : plan?.activeReactionIds}
              feedRef={feedRef}
            />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes hero-label-in {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
