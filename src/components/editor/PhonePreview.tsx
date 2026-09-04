import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Play, Pause, Plus, Volume2, VolumeX } from 'lucide-react';
import { ChatPreview } from '../chat/ChatPreview';
import { StoryStage } from '../chat/StoryStage';
import { OnboardingHint } from './OnboardingHint';
import { buildFramePlan, FPS } from '../../lib/video/chatTimeline';
import { useEditorStore } from '../../lib/state/editorStore';
import { playMessageSound } from '../../lib/media/messageSounds';
import { storyStage } from '../../lib/story/storyLayout';
import type { Message } from '../../lib/parser/types';

const SPEED_OPTIONS = [1, 1.5, 2, 0.75];

export const PhonePreview: React.FC = () => {
  const {
    project,
    updateMessage, setReaction, clearReaction, deleteMessage,
    addTextMessage, addImageMessage, addDateMessage, addSystemMessage, addCallMessage, addVoiceNoteMessage,
    setTitle, setSubtitle, setParticipantAvatar, setGroupAvatar, setPlaybackSpeed, setStatusBarTime,
  } = useEditorStore();

  const speed = project.playbackSpeed ?? 1;
  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [frame, setFrame] = useState(0);
  const [framePlan, setFramePlan] = useState(() => buildFramePlan(project.messages, project.participants, speed));

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const pendingAvatarParticipantId = useRef<string | null>(null);

  // Rebuild frame plan when project messages or playback speed change
  useEffect(() => {
    const plan = buildFramePlan(project.messages, project.participants, speed);
    setFramePlan(plan);
    setFrame(0);
    frameRef.current = 0;
    lastTimeRef.current = 0;
  }, [project.messages, project.participants, speed]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = (timestamp: number) => {
      if (lastTimeRef.current === 0) lastTimeRef.current = timestamp;
      const elapsed = timestamp - lastTimeRef.current;

      if (elapsed >= 1000 / FPS) {
        lastTimeRef.current = timestamp;
        frameRef.current = (frameRef.current + 1) % Math.max(framePlan.length, 1);
        setFrame(frameRef.current);
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isPlaying, framePlan]);

  // Auto-scroll the feed when messages or typing state changes
  const currentPlan = framePlan[frame] ?? null;
  const prevVisibleRef = useRef(0);
  const prevTypingRef = useRef<string | null>(null);
  useEffect(() => {
    if (!currentPlan) return;
    if (
      currentPlan.visibleCount !== prevVisibleRef.current ||
      currentPlan.typingParticipantId !== prevTypingRef.current
    ) {
      prevVisibleRef.current = currentPlan.visibleCount;
      prevTypingRef.current = currentPlan.typingParticipantId;
      if (feedRef.current) {
        requestAnimationFrame(() => {
          if (!feedRef.current) return;
          feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' });
        });
      }
    }
  }, [currentPlan]);

  // Play a sound when a new bubble or reaction appears during playback.
  // The timeline only schedules system/date/text/image/voice messages, so the
  // Nth visible item maps to the Nth message of those kinds.
  const prevSoundStateRef = useRef({ visible: 0, reactions: 0 });
  useEffect(() => {
    if (!currentPlan) return;
    const prev = prevSoundStateRef.current;
    const visible = currentPlan.visibleCount;
    const reactions = currentPlan.activeReactionIds.length;

    if (isPlaying && !muted) {
      if (visible > prev.visible) {
        const timelineMessages = project.messages.filter(
          (m) => m.kind !== 'call',
        );
        const revealed = timelineMessages[visible - 1];
        if (revealed && (revealed.kind === 'text' || revealed.kind === 'image' || revealed.kind === 'voice')) {
          const isSelf = project.participants.find((p) => p.id === revealed.participantId)?.isSelf;
          playMessageSound(isSelf ? 'send' : 'receive', project.platform);
        }
      }
      if (reactions > prev.reactions) {
        playMessageSound('reaction', project.platform);
      }
    }

    prevSoundStateRef.current = { visible, reactions };
  }, [currentPlan, isPlaying, muted, project.messages, project.participants, project.platform]);

  const handleAvatarClick = useCallback((participantId: string) => {
    pendingAvatarParticipantId.current = participantId;
    avatarInputRef.current?.click();
  }, []);

  const handleGroupAvatarClick = useCallback(() => {
    groupAvatarInputRef.current?.click();
  }, []);

  const iOS = project.deviceOS === 'ios';
  const isDark = project.theme === 'dark';

  // Phone frame dimensions
  const PHONE_W = 360;
  const PHONE_H = 780;

  const story = project.story;
  const isStory = story?.enabled ?? false;
  const stage = isStory ? storyStage(story!.aspect) : null;
  // Fit the story stage into the same footprint the phone frame occupies, so
  // switching modes doesn't reflow the rest of the editor layout.
  const storyFit = stage ? Math.min(PHONE_W / stage.w, PHONE_H / stage.h) : 1;

  const chatPreviewProps = {
    project,
    visibleCount: isPlaying ? currentPlan?.visibleCount : undefined,
    typingParticipantId: isPlaying ? currentPlan?.typingParticipantId : null,
    activeReactionIds: isPlaying ? currentPlan?.activeReactionIds : undefined,
    onUpdateMessage: (id: string, patch: Partial<Message>) => updateMessage(id, patch),
    onSetReaction: setReaction,
    onClearReaction: clearReaction,
    onDeleteMessage: deleteMessage,
    onAddText: (afterId: string, replyToId?: string) => addTextMessage(afterId, undefined, replyToId),
    onAddImage: (afterId: string, file: File) => addImageMessage(afterId, file),
    onAddDate: (afterId: string, label?: string) => addDateMessage(afterId, label),
    onAddSystem: (afterId: string) => addSystemMessage(afterId),
    onAddCall: (afterId: string, isVoiceCall?: boolean, duration?: string, status?: 'missed' | 'completed' | 'declined') =>
      addCallMessage(afterId, undefined, isVoiceCall, duration, status),
    onAddVoiceNote: (afterId: string, duration?: string) => addVoiceNoteMessage(afterId, undefined, duration),
    onUpdateTitle: setTitle,
    onUpdateSubtitle: setSubtitle,
    onUpdateStatusTime: setStatusBarTime,
    onAvatarClick: handleAvatarClick,
    onGroupAvatarClick: handleGroupAvatarClick,
    feedRef,
  };

  return (
    <div className="flex flex-col items-center gap-4 h-full">
      {/* Play / Pause */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-[#00FF87]/15 text-white text-xs font-medium transition-colors"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <button
          onClick={() => setMuted(!muted)}
          title={muted ? 'Unmute preview sounds' : 'Mute preview sounds'}
          className={`flex items-center justify-center w-7 h-7 rounded-full transition-colors ${
            muted ? 'bg-white/5 text-white/30 hover:text-white/60' : 'bg-white/10 text-white hover:bg-[#00FF87]/15'
          }`}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
        <button
          onClick={() => {
            const next = SPEED_OPTIONS[(SPEED_OPTIONS.indexOf(speed) + 1) % SPEED_OPTIONS.length] ?? 1;
            setPlaybackSpeed(next);
          }}
          title="Chat speed — how fast messages appear, in the preview and in exported videos"
          className="flex items-center justify-center px-2 h-7 rounded-full bg-white/10 hover:bg-[#00FF87]/15 text-white text-xs font-semibold transition-colors tabular-nums"
        >
          {speed}x
        </button>
        <span className="text-white/40 text-xs">
          {currentPlan ? `${currentPlan.visibleCount} / ${project.messages.length} messages` : ''}
        </span>
      </div>

      {/* Preview: story stage or phone frame */}
      {isStory && stage ? (
        <div
          className="relative flex-shrink-0 mx-auto overflow-hidden rounded-2xl shadow-2xl"
          style={{ width: stage.w * storyFit, height: stage.h * storyFit, maxWidth: '100%' }}
        >
          <div style={{ width: stage.w, height: stage.h, transform: `scale(${storyFit})`, transformOrigin: 'top left' }}>
            <StoryStage project={project} aspect={story!.aspect} renderBackground id="phone-screen">
              <ChatPreview {...chatPreviewProps} mode="editor" chromeless id="story-chat" />
            </StoryStage>
          </div>
        </div>
      ) : (
        <div
          className="relative flex-shrink-0 mx-auto"
          style={{
            width: PHONE_W,
            height: PHONE_H,
            maxWidth: '100%',
          }}
        >
          {/* Phone shell */}
          <div
            className={`absolute inset-0 rounded-[44px] border-[10px] overflow-hidden shadow-2xl ${
              isDark ? 'border-[#1a1a1a] bg-[#1a1a1a]' : 'border-[#222] bg-[#222]'
            }`}
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.4), 0 30px 80px rgba(0,0,0,0.5)' }}
          >
            {/* Notch (iOS) / Punch hole (Android) */}
            {iOS ? (
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-28 h-6 rounded-b-2xl z-50"
                style={{ background: '#1a1a1a' }} />
            ) : (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full z-50"
                style={{ background: '#1a1a1a' }} />
            )}

            {/* Chat preview */}
            <ChatPreview {...chatPreviewProps} mode="editor" />
          </div>

          <OnboardingHint visible={project.messages.length > 0 && !isPlaying} />

          {/* Side buttons (decorative) */}
          <div className="absolute left-[-12px] top-24 w-1.5 h-8 rounded-l-full bg-gray-600" />
          <div className="absolute left-[-12px] top-36 w-1.5 h-12 rounded-l-full bg-gray-600" />
          <div className="absolute left-[-12px] top-52 w-1.5 h-12 rounded-l-full bg-gray-600" />
          <div className="absolute right-[-12px] top-32 w-1.5 h-16 rounded-r-full bg-gray-600" />
        </div>
      )}

      {/* Empty chat add button */}
      {project.messages.length === 0 && (
        <button
          onClick={() => addTextMessage(null)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#00FF87] to-[#60EFFF] hover:brightness-110 text-[#061116] text-sm font-semibold transition-all"
        >
          <Plus size={15} /> Add first message
        </button>
      )}

      {/* Hidden inputs for avatar upload */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const pid = pendingAvatarParticipantId.current;
          if (file && pid) setParticipantAvatar(pid, file);
          e.target.value = '';
        }}
      />
      <input
        ref={groupAvatarInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setGroupAvatar(file);
          e.target.value = '';
        }}
      />
    </div>
  );
};
