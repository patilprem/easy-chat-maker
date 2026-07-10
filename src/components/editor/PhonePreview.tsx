import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Play, Pause, Plus } from 'lucide-react';
import { ChatPreview } from '../chat/ChatPreview';
import { buildFramePlan, FPS } from '../../lib/video/chatTimeline';
import { useEditorStore } from '../../lib/state/editorStore';
import type { Message } from '../../lib/parser/types';

export const PhonePreview: React.FC = () => {
  const {
    project,
    updateMessage, setReaction, clearReaction, deleteMessage,
    addTextMessage, addImageMessage, addDateMessage, addSystemMessage, addCallMessage, addVoiceNoteMessage,
    setTitle, setSubtitle, setParticipantAvatar, setGroupAvatar,
  } = useEditorStore();

  const [isPlaying, setIsPlaying] = useState(false);
  const [frame, setFrame] = useState(0);
  const [framePlan, setFramePlan] = useState(() => buildFramePlan(project.messages, project.participants));

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef(0);
  const feedRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const pendingAvatarParticipantId = useRef<string | null>(null);

  // Rebuild frame plan when project messages change
  useEffect(() => {
    const plan = buildFramePlan(project.messages, project.participants);
    setFramePlan(plan);
    setFrame(0);
    frameRef.current = 0;
    lastTimeRef.current = 0;
  }, [project.messages, project.participants]);

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

  return (
    <div className="flex flex-col items-center gap-4 h-full">
      {/* Play / Pause */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-[#00FF87]/15 text-white text-xs font-medium transition-colors"
        >
          {isPlaying ? <Pause size={13} /> : <Play size={13} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>
        <span className="text-white/40 text-xs">
          {currentPlan ? `${currentPlan.visibleCount} / ${project.messages.length} messages` : ''}
        </span>
      </div>

      {/* Phone frame */}
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
          <ChatPreview
            project={project}
            mode="editor"
            visibleCount={isPlaying ? currentPlan?.visibleCount : undefined}
            typingParticipantId={isPlaying ? currentPlan?.typingParticipantId : null}
            activeReactionIds={isPlaying ? currentPlan?.activeReactionIds : undefined}
            onUpdateMessage={(id, patch) => updateMessage(id, patch as Partial<Message>)}
            onSetReaction={setReaction}
            onClearReaction={clearReaction}
            onDeleteMessage={deleteMessage}
            onAddText={(afterId, replyToId) => addTextMessage(afterId, undefined, replyToId)}
            onAddImage={(afterId, file) => addImageMessage(afterId, file)}
            onAddDate={(afterId, label) => addDateMessage(afterId, label)}
            onAddSystem={(afterId) => addSystemMessage(afterId)}
            onAddCall={(afterId, isVoice, duration, status) => addCallMessage(afterId, undefined, isVoice, duration, status)}
            onAddVoiceNote={(afterId, duration) => addVoiceNoteMessage(afterId, undefined, duration)}
            onUpdateTitle={setTitle}
            onUpdateSubtitle={setSubtitle}
            onAvatarClick={handleAvatarClick}
            onGroupAvatarClick={handleGroupAvatarClick}
            feedRef={feedRef}
          />
        </div>

        {/* Side buttons (decorative) */}
        <div className="absolute left-[-12px] top-24 w-1.5 h-8 rounded-l-full bg-gray-600" />
        <div className="absolute left-[-12px] top-36 w-1.5 h-12 rounded-l-full bg-gray-600" />
        <div className="absolute left-[-12px] top-52 w-1.5 h-12 rounded-l-full bg-gray-600" />
        <div className="absolute right-[-12px] top-32 w-1.5 h-16 rounded-r-full bg-gray-600" />
      </div>

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
