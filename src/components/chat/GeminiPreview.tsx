import React, { useCallback } from 'react';
import { AudioLines, ChevronDown, ChevronLeft, Copy, Menu, Mic, MoreHorizontal, MoreVertical, Plus, RotateCw, SquarePen, ThumbsDown, ThumbsUp, Volume2 } from 'lucide-react';
import { DeviceStatusBar } from './DeviceStatusBar';
import { AiMessageActions } from './ChatGPTPreview';
import type { ChatProject, ImageMessage, Message, Participant, TextMessage } from '../../lib/parser/types';

interface Props {
  project: ChatProject;
  mode: 'editor' | 'export' | 'video';
  visibleCount?: number;
  typingParticipantId?: string | null;
  activeReactionIds?: string[];
  onUpdateMessage?: (id: string, patch: Partial<Message>) => void;
  onSetReaction?: (id: string, emoji: string) => void;
  onClearReaction?: (id: string) => void;
  onDeleteMessage?: (id: string) => void;
  onAddText?: (afterId: string, replyToId?: string) => void;
  onAddImage?: (afterId: string, file: File) => void;
  onAddDate?: (afterId: string, label?: string) => void;
  onUpdateTitle?: (t: string) => void;
  onUpdateSubtitle?: (s: string) => void;
  onAvatarClick?: (participantId: string) => void;
  onGroupAvatarClick?: () => void;
  feedRef?: React.RefObject<HTMLDivElement | null>;
}

function isChatMessage(msg: Message | undefined): msg is TextMessage | ImageMessage {
  return !!msg && (msg.kind === 'text' || msg.kind === 'image');
}

/** Gemini 4-point star with signature gradient */
const GeminiStar: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
    <defs>
      <linearGradient id="gemini-star-grad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#4285f4" />
        <stop offset="50%" stopColor="#9b72cb" />
        <stop offset="100%" stopColor="#d96570" />
      </linearGradient>
    </defs>
    <path
      fill="url(#gemini-star-grad)"
      d="M12 24A14.3 14.3 0 0 0 0 12 14.3 14.3 0 0 0 12 0a14.3 14.3 0 0 0 12 12 14.3 14.3 0 0 0-12 12z"
    />
  </svg>
);

export const GeminiPreview: React.FC<Props> = ({
  project, mode, visibleCount, typingParticipantId,
  onUpdateMessage, onDeleteMessage, onAddText, onUpdateSubtitle,
  feedRef,
}) => {
  const isEditor = mode === 'editor';
  const isDark = project.theme === 'dark';
  const allVisible = visibleCount === undefined;
  const displayMessages = (allVisible ? project.messages : project.messages.slice(0, visibleCount))
    .filter(isChatMessage);

  const getParticipant = useCallback(
    (id: string): Participant | undefined => project.participants.find((p) => p.id === id),
    [project.participants]
  );

  const typingParticipant = typingParticipantId ? getParticipant(typingParticipantId) : null;
  const showThinking = !!typingParticipant && !typingParticipant.isSelf;

  const pageBg = isDark ? 'bg-[#131314]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#e3e3e3]' : 'text-[#1f1f1f]';
  const textMuted = isDark ? 'text-[#9aa0a6]' : 'text-[#7d8288]';
  const bubbleBg = isDark ? 'bg-[#333537]' : 'bg-[#f0f4f9]';
  const iconColor = isDark ? 'text-[#c4c7c5]' : 'text-[#575b5f]';
  const inputBg = isDark ? 'bg-[#1e1f20]' : 'bg-[#f0f4f9]';
  const sendBg = isDark ? 'bg-[#4c8df6]' : 'bg-[#0b57d0]';

  const hasMessages = displayMessages.length > 0;
  const modelLabel = project.subtitle || 'Flash';

  const editableText = (msg: TextMessage | ImageMessage, className: string) => (
    <div
      contentEditable={isEditor}
      suppressContentEditableWarning
      onBlur={(e) => onUpdateMessage?.(msg.id, { text: e.currentTarget.textContent ?? '' } as Partial<Message>)}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      }}
      className={`${className} outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
      style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
    >
      {msg.kind === 'text' ? msg.text : ''}
    </div>
  );

  return (
    <div className={`relative flex h-full min-h-0 w-full flex-col overflow-hidden ${pageBg}`}>
      <style>{`
        @keyframes gemini-aurora {
          0% { opacity: 0.55; transform: translateY(0) scale(1); }
          50% { opacity: 0.85; transform: translateY(-12px) scale(1.06); }
          100% { opacity: 0.55; transform: translateY(0) scale(1); }
        }
        @keyframes gemini-dot {
          0%, 80%, 100% { opacity: 0.25; }
          40% { opacity: 1; }
        }
      `}</style>

      <DeviceStatusBar os={project.deviceOS} theme={project.theme} surface="gemini" />

      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between px-3.5 pb-1.5 pt-2">
        <div className="flex items-center gap-3.5">
          <Menu size={19} strokeWidth={2} className={textPrimary} />
          <div className="flex items-baseline gap-1">
            <span className={`${textPrimary} text-[16.5px] font-medium leading-none`}>Gemini</span>
            <span
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => onUpdateSubtitle?.(e.currentTarget.textContent ?? '')}
              className={`${textPrimary} text-[16.5px] font-medium leading-none outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
            >
              {modelLabel}
            </span>
            <span className="h-1 w-1 -translate-y-1.5 rounded-full bg-[#4c8df6]" />
            <ChevronDown size={13} strokeWidth={2.4} className={`${textMuted} translate-y-0.5`} />
          </div>
        </div>
        <div className={`flex items-center gap-4 ${textPrimary}`}>
          <SquarePen size={17} strokeWidth={2} />
          <MoreVertical size={17} strokeWidth={2.1} />
        </div>
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        className="phone-chat-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-3 pt-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {!hasMessages && (
          <div className="flex h-[65%] flex-col items-center justify-center gap-3">
            <GeminiStar size={30} />
            <span
              className="text-center text-[22px] font-medium leading-[30px]"
              style={{
                background: 'linear-gradient(90deg, #4285f4, #9b72cb, #d96570)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Any new ideas<br />to explore?
            </span>
          </div>
        )}

        {displayMessages.map((msg, idx) => {
          const participant = getParticipant(msg.participantId);
          const isSelf = participant?.isSelf ?? false;
          const isLastMessage = idx === displayMessages.length - 1;

          if (isSelf) {
            return (
              <div key={msg.id} className="group/aimsg relative flex justify-end py-1.5">
                {msg.kind === 'image' && msg.objectUrl ? (
                  <img src={msg.objectUrl} alt="" className="max-h-[260px] max-w-[210px] rounded-[18px] object-cover" />
                ) : (
                  <div className={`${bubbleBg} ${textPrimary} max-w-[78%] rounded-[20px] rounded-br-[6px] px-4 py-2.5`}>
                    {editableText(msg, 'text-[14px] leading-[19.5px]')}
                  </div>
                )}
                {isEditor && (
                  <AiMessageActions msgId={msg.id} isSelf accent="#4c8df6" onAddText={onAddText} onDelete={onDeleteMessage} />
                )}
              </div>
            );
          }

          return (
            <div key={msg.id} className="group/aimsg relative py-2">
              {msg.kind === 'image' && msg.objectUrl ? (
                <img src={msg.objectUrl} alt="" className="max-h-[260px] max-w-[210px] rounded-[18px] object-cover" />
              ) : (
                editableText(msg, `${textPrimary} text-[14.5px] leading-[22px]`)
              )}
              <div className={`${iconColor} mt-3 flex items-center gap-[18px]`}>
                <ThumbsUp size={15} strokeWidth={2} />
                <ThumbsDown size={15} strokeWidth={2} />
                <RotateCw size={15} strokeWidth={2} />
                <Copy size={15} strokeWidth={2} />
                <MoreHorizontal size={15} strokeWidth={2} />
                <span className="flex-1" />
                <Volume2 size={16} strokeWidth={2} />
              </div>
              {isLastMessage && (
                <div className={`${textMuted} mt-2.5 text-[11px] leading-none`}>
                  Gemini is AI and can make mistakes.
                </div>
              )}
              {isEditor && (
                <AiMessageActions msgId={msg.id} isSelf={false} accent="#4c8df6" onAddText={onAddText} onDelete={onDeleteMessage} />
              )}
            </div>
          );
        })}

        {/* Thinking: three fading dots */}
        {showThinking && (
          <div className={`${textMuted} flex gap-1 py-3 text-[22px] leading-none`} data-typing-indicator>
            {[0, 1, 2].map((i) => (
              <span key={i} style={{ animation: `gemini-dot 1.2s ${i * 0.2}s infinite` }}>•</span>
            ))}
          </div>
        )}
      </div>

      {/* Aurora shimmer while generating */}
      {showThinking && (
        <div
          data-export-typing-overlay
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[55%]"
          style={{
            background: isDark
              ? 'radial-gradient(90% 75% at 20% 100%, rgba(21,128,61,0.55) 0%, transparent 60%), radial-gradient(85% 70% at 85% 100%, rgba(88,28,135,0.55) 0%, transparent 60%), radial-gradient(70% 55% at 55% 100%, rgba(29,78,216,0.45) 0%, transparent 65%)'
              : 'radial-gradient(90% 75% at 20% 100%, rgba(134,239,172,0.5) 0%, transparent 60%), radial-gradient(85% 70% at 85% 100%, rgba(216,180,254,0.5) 0%, transparent 60%), radial-gradient(70% 55% at 55% 100%, rgba(147,197,253,0.45) 0%, transparent 65%)',
            animation: 'gemini-aurora 2.2s ease-in-out infinite',
          }}
        />
      )}

      {/* Input bar */}
      <div data-chat-input className="relative z-20 flex-shrink-0 px-3 pb-2 pt-1">
        <div className={`${inputBg} flex items-center gap-3 rounded-full py-2.5 pl-4 pr-2`}>
          <Plus size={20} strokeWidth={2} className={textMuted} />
          <span className={`${textMuted} min-w-0 flex-1 truncate text-[15px]`}>Ask Gemini</span>
          <Mic size={18} strokeWidth={2} className={textMuted} />
          <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${sendBg} text-white`}>
            <AudioLines size={17} strokeWidth={2.1} />
          </span>
        </div>
      </div>

      {project.deviceOS === 'android' && (
        <div className={`flex h-8 flex-shrink-0 items-center justify-around ${pageBg} ${textPrimary}`}>
          <span className="text-[23px] leading-none">|||</span>
          <span className="h-[15px] w-[15px] rounded-full border-2 border-current" />
          <ChevronLeft size={24} strokeWidth={2.1} className="-rotate-180" />
        </div>
      )}
    </div>
  );
};
