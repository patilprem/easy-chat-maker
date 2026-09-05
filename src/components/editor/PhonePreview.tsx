import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import { Play, Pause, Plus, Volume2, VolumeX } from 'lucide-react';
import { ChatPreview } from '../chat/ChatPreview';
import { StoryStage } from '../chat/StoryStage';
import { OnboardingHint } from './OnboardingHint';
import { buildFramePlan, buildRevealSchedule, framePlansFromSchedule, FPS } from '../../lib/video/chatTimeline';
import { useEditorStore } from '../../lib/state/editorStore';
import { playMessageSound } from '../../lib/media/messageSounds';
import { storyStage, STORY_SHOW_HEADER } from '../../lib/story/storyLayout';
import { normalizeCycleCount, windowForPreview } from '../../lib/story/storyCycle';
import { speakPreview, stopPreviewVoice, resetPreviewVoiceAssignments } from '../../lib/tts/previewVoice';
import { normalizeForSpeech } from '../../lib/tts/voiceClips';
import { assignVoicesForParticipants, findVoice } from '../../lib/tts/voices';
import type { Message, Participant } from '../../lib/parser/types';

const SPEED_OPTIONS = [1, 1.5, 2, 0.75];

/** Story mode: no typing indicator, no pause between bubbles — the next one appears the instant the last one's (voiceover-driven, if enabled) hold time is up. Phone mode keeps its normal typing/pause pacing. */
function buildPreviewFramePlan(messages: Message[], participants: Participant[], speed: number, isStory: boolean) {
  return isStory
    ? framePlansFromSchedule(buildRevealSchedule(messages, participants, { speed, noTypingNoPause: true }))
    : buildFramePlan(messages, participants, speed);
}

export const PhonePreview: React.FC = () => {
  const {
    project,
    updateMessage, setReaction, clearReaction, deleteMessage,
    addTextMessage, addImageMessage, addDateMessage, addSystemMessage, addCallMessage, addVoiceNoteMessage,
    setTitle, setSubtitle, setParticipantAvatar, setGroupAvatar, setPlaybackSpeed, setStatusBarTime,
  } = useEditorStore();

  const speed = project.playbackSpeed ?? 1;
  const story = project.story;
  const isStory = story?.enabled ?? false;
  // System/date messages ("X created group", "Monday") are chrome that
  // doesn't belong in the chrome-less story look — drop them entirely
  // rather than giving them a reveal slot, in both the preview and (see
  // exportStory.ts) the exported video. Memoized: a fresh array on every
  // render would retrigger the frame-plan-rebuild effect below on every
  // playback tick (a new array reference never equals the last one) and
  // reset the animation to frame 0 continuously.
  const previewMessages = useMemo(
    () => (isStory ? project.messages.filter((m) => m.kind !== 'system' && m.kind !== 'date') : project.messages),
    [isStory, project.messages],
  );
  // Same default assignment the real export uses (assignVoicesForParticipants)
  // so the live preview's gender always matches whichever voice is actually
  // selected — an explicit per-participant override in story.voice.voices
  // takes precedence over this default, exactly like the export.
  const defaultVoices = useMemo(() => assignVoicesForParticipants(project.participants), [project.participants]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [frame, setFrame] = useState(0);
  const [framePlan, setFramePlan] = useState(() => buildPreviewFramePlan(previewMessages, project.participants, speed, isStory));

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef(0);
  const speechActiveRef = useRef(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);
  const pendingAvatarParticipantId = useRef<string | null>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const previewWrapRef = useRef<HTMLDivElement>(null);
  const [wrapSize, setWrapSize] = useState({ w: 360, h: 780 });

  // The story stage (540x960 or 960x540 CSS px) is fit to whatever space is
  // actually available in the editor column, instead of the old fixed
  // phone-sized footprint — otherwise a 16:9 stage in particular got shrunk
  // to a fraction of its size and its text along with it.
  useEffect(() => {
    const el = previewWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWrapSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Story mode's background music preview — plays only while the timeline is
  // actually playing, so scrubbing/editing the script doesn't leave it running.
  const musicUrl = project.story?.music?.mediaUrl;
  const musicVolume = project.story?.music?.volume ?? 0.35;
  useEffect(() => {
    const audio = musicRef.current;
    if (!audio || !musicUrl) return;
    audio.volume = musicVolume;
    if (isPlaying && !muted) {
      audio.play().catch(() => { /* autoplay can be blocked before a user gesture — harmless */ });
    } else {
      audio.pause();
    }
  }, [isPlaying, muted, musicUrl, musicVolume]);

  // Rebuild frame plan when project messages or playback speed change
  useEffect(() => {
    const plan = buildPreviewFramePlan(previewMessages, project.participants, speed, isStory);
    setFramePlan(plan);
    setFrame(0);
    frameRef.current = 0;
    lastTimeRef.current = 0;
  }, [previewMessages, project.participants, speed, isStory]);

  // Animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = (timestamp: number) => {
      // Hold the current frame while narration for the just-revealed bubble
      // is still playing, so the next bubble never appears mid-sentence —
      // see the sound/voice effect below, which sets this while speaking.
      if (speechActiveRef.current) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

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
    // Story mode's first bubble is already "visible" in frame 0 of the
    // timeline (no typing delay to hide it behind) even before Play is
    // pressed. Tracking state must stay untouched while paused, or it
    // silently records that bubble as already-seen and the real playback
    // start never detects it as new — message 1's sound/voiceover would
    // never fire.
    if (!isPlaying) return;
    const prev = prevSoundStateRef.current;
    const visible = currentPlan.visibleCount;
    const reactions = currentPlan.activeReactionIds.length;

    if (!muted) {
      if (visible > prev.visible) {
        // previewMessages already excludes calls in phone mode's own way —
        // filter it out here too so the index maps 1:1 onto `visible`,
        // exactly like the timeline that produced it.
        const timelineMessages = previewMessages.filter((m) => m.kind !== 'call');
        const revealed = timelineMessages[visible - 1];
        if (revealed && (revealed.kind === 'text' || revealed.kind === 'image' || revealed.kind === 'voice')) {
          const isSelf = project.participants.find((p) => p.id === revealed.participantId)?.isSelf;
          playMessageSound(isSelf ? 'send' : 'receive', project.platform);
        }
        // Free, instant preview narration (Web Speech API — see
        // lib/tts/previewVoice.ts) so voice can be heard while editing,
        // without downloading anything. The exported video bakes in real
        // Kokoro-generated audio instead. Gates the animation loop (via
        // speechActiveRef) until this line finishes speaking, so the next
        // bubble never appears while this one is still being read out.
        if (revealed && revealed.kind === 'text' && story?.enabled && story.voice?.enabled) {
          const idx = project.participants.findIndex((p) => p.id === revealed.participantId);
          const voiceId = story.voice.voices[revealed.participantId] ?? defaultVoices[revealed.participantId];
          const gender = findVoice(voiceId).gender;
          speechActiveRef.current = true;
          speakPreview(normalizeForSpeech(revealed.text), Math.max(0, idx), gender, story.voice.speed, () => {
            speechActiveRef.current = false;
          });
        }
      }
      if (reactions > prev.reactions) {
        playMessageSound('reaction', project.platform);
      }
    }

    prevSoundStateRef.current = { visible, reactions };
  }, [currentPlan, isPlaying, muted, previewMessages, project.participants, project.platform, story?.enabled, story?.voice, defaultVoices]);

  // Stop any in-flight narration the moment playback pauses/mutes, and on unmount.
  useEffect(() => {
    if (!isPlaying || muted) stopPreviewVoice();
  }, [isPlaying, muted]);
  useEffect(() => () => stopPreviewVoice(), []);

  // Re-assign preview voices from scratch whenever the cast changes (a
  // different chat loaded, someone added/removed/renamed) — otherwise a
  // stale per-index assignment from a previous chat could linger and
  // collide with this one's.
  useEffect(() => {
    resetPreviewVoiceAssignments();
  }, [project.participants]);

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

  const stage = isStory ? storyStage(story!.aspect) : null;
  // Fit the story stage to whatever space the editor column actually has
  // (measured via ResizeObserver above), but never larger than the classic
  // phone frame's footprint — a big desktop column otherwise blows the
  // preview up way past a natural "phone-sized" preview. This still shrinks
  // further for small containers (the mobile "Preview" tab in particular).
  // That tab's wrapper also has no explicit height, so a flex-grown
  // measurement there can collapse toward 0 — fall back to the phone-sized
  // footprint rather than fitting into a bogus tiny box.
  const fitW = wrapSize.w > 100 ? wrapSize.w : PHONE_W;
  const fitH = wrapSize.h > 100 ? wrapSize.h : PHONE_H;
  const storyFit = stage
    ? Math.max(0.35, Math.min(fitW / stage.w, fitH / stage.h, PHONE_W / stage.w, PHONE_H / stage.h))
    : 1;

  // Story mode always restarts from the top every `cycleCount` bubbles
  // (see exportStory.ts) rather than scrolling forever — there's no manual
  // choice for this any more. Only windows while actually playing — editing
  // always shows every message so nothing becomes unreachable to click on.
  const cycleCount = isStory ? normalizeCycleCount(story!.aspect) : 0;
  const storyWindow = cycleCount && isPlaying && currentPlan
    ? windowForPreview(previewMessages, currentPlan.visibleCount, cycleCount)
    : null;

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

  // Story mode's preview always renders previewMessages (system/date
  // already stripped), further windowed down to the current page while
  // playing.
  const storyChatPreviewProps = storyWindow
    ? { ...chatPreviewProps, project: { ...project, messages: storyWindow.messages }, visibleCount: storyWindow.visibleCount }
    : { ...chatPreviewProps, project: { ...project, messages: previewMessages } };

  return (
    <div className="flex flex-col items-center gap-4 h-full w-full min-h-0">
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
        {/* Story mode has no manual speed control — pacing follows the
            voiceover when it's on, or the normal reveal timing otherwise. */}
        {!isStory && (
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
        )}
        <span className="text-white/40 text-xs">
          {currentPlan ? `${currentPlan.visibleCount} / ${previewMessages.length} messages` : ''}
        </span>
      </div>

      {/* Preview: story stage or phone frame — measured so the story stage
          can be fit to whatever space is actually available (see wrapSize). */}
      <div ref={previewWrapRef} className="flex-1 min-h-0 w-full flex items-start justify-center">
      {isStory && stage ? (
        <div
          className="relative flex-shrink-0 overflow-hidden rounded-2xl shadow-2xl"
          style={{ width: stage.w * storyFit, height: stage.h * storyFit, maxWidth: '100%', maxHeight: '100%' }}
        >
          <div style={{ width: stage.w, height: stage.h, transform: `scale(${storyFit})`, transformOrigin: 'top left' }}>
            <StoryStage project={project} aspect={story!.aspect} renderBackground id="phone-screen">
              <ChatPreview {...storyChatPreviewProps} mode="editor" chromeless showHeader={STORY_SHOW_HEADER} id="story-chat" />
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
      {musicUrl && <audio ref={musicRef} src={musicUrl} loop />}
    </div>
  );
};
