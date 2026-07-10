import React, { useCallback } from 'react';
import { AudioLines, ChevronLeft, Copy, Menu, Mic, MoreVertical, Play, Plus, RotateCw, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
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

const CLAUDE_ORANGE = '#d97757';
const SERIF = "Georgia, 'Times New Roman', serif";

function isChatMessage(msg: Message | undefined): msg is TextMessage | ImageMessage {
  return !!msg && (msg.kind === 'text' || msg.kind === 'image');
}

/** Claude starburst logo */
const Starburst: React.FC<{ size?: number; className?: string }> = ({ size = 22, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={CLAUDE_ORANGE} aria-hidden="true" className={className}>
    <path d="M11.16 2.06c.24-.05.5-.06.74-.01.24.05.42.24.5.47l.86 5.4c.03.2.3.24.4.06l2.71-4.74a.9.9 0 0 1 1.24-.32c.4.23.55.72.36 1.14l-2.28 5.02c-.08.18.11.36.28.27l4.9-2.53a.9.9 0 0 1 1.2.42c.2.42.05.92-.35 1.15l-4.7 2.87c-.17.1-.1.36.1.37l5.46.34c.47.03.83.42.83.89s-.36.86-.83.89l-5.45.34c-.2.01-.27.27-.1.37l4.69 2.86c.4.24.55.74.35 1.16a.9.9 0 0 1-1.2.42l-4.9-2.54c-.17-.09-.36.1-.28.28l2.28 5.02a.9.9 0 0 1-.36 1.14.9.9 0 0 1-1.24-.32l-2.7-4.74c-.1-.18-.38-.13-.41.07l-.86 5.39a.87.87 0 0 1-.87.74.87.87 0 0 1-.87-.74l-.86-5.4c-.03-.2-.3-.24-.4-.06l-2.71 4.74a.9.9 0 0 1-1.24.32.9.9 0 0 1-.36-1.14l2.28-5.02c.08-.18-.11-.37-.28-.28l-4.9 2.54a.9.9 0 0 1-1.2-.42.92.92 0 0 1 .35-1.16l4.69-2.86c.17-.1.1-.36-.1-.37l-5.45-.34a.89.89 0 0 1-.83-.89c0-.47.36-.86.83-.89l5.45-.34c.2-.01.28-.27.1-.37L3.35 8.39a.92.92 0 0 1-.35-1.15.9.9 0 0 1 1.2-.42l4.9 2.53c.17.09.36-.09.28-.27L7.1 4.06a.9.9 0 0 1 .36-1.14.9.9 0 0 1 1.24.32l2.7 4.74c.11.18.38.14.41-.06l.86-5.4a.87.87 0 0 1 .5-.46z" />
  </svg>
);

function greeting(): string {
  return 'Good evening';
}

export const ClaudePreview: React.FC<Props> = ({
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
  const selfName = project.participants.find((p) => p.isSelf)?.name?.split(' ')[0] ?? 'there';

  const pageBg = isDark ? 'bg-[#262624]' : 'bg-[#faf9f5]';
  const textPrimary = isDark ? 'text-[#f5f4ef]' : 'text-[#1a1915]';
  const textMuted = isDark ? 'text-[#9a978f]' : 'text-[#87857d]';
  const bubbleBg = isDark ? 'bg-[#3a3a37]' : 'bg-[#f0eee6]';
  const iconColor = isDark ? 'text-[#b8b5ac]' : 'text-[#87857d]';
  const cardBg = isDark ? 'bg-[#30302e]' : 'bg-white';
  const pillBg = isDark ? 'bg-[#3a3a38] text-[#e8e6df]' : 'bg-[#f0eee6] text-[#40403a]';

  const hasMessages = displayMessages.length > 0;
  const lastMsg = displayMessages[displayMessages.length - 1];
  const lastIsAssistant = lastMsg && !(getParticipant(lastMsg.participantId)?.isSelf ?? false);
  const modelLabel = project.subtitle || 'Opus 4.8';

  const editableText = (msg: TextMessage | ImageMessage, className: string, style?: React.CSSProperties) => (
    <div
      contentEditable={isEditor}
      suppressContentEditableWarning
      onBlur={(e) => onUpdateMessage?.(msg.id, { text: e.currentTarget.textContent ?? '' } as Partial<Message>)}
      onPaste={(e) => {
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      }}
      className={`${className} outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
      style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', ...style }}
    >
      {msg.kind === 'text' ? msg.text : ''}
    </div>
  );

  return (
    <div className={`flex h-full min-h-0 w-full flex-col overflow-hidden ${pageBg}`}>
      <DeviceStatusBar os={project.deviceOS} theme={project.theme} surface="claude" />

      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between px-4 pb-1.5 pt-2">
        <button className={textPrimary}>
          <Menu size={20} strokeWidth={2} />
        </button>
        <div className="flex items-center gap-3">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${isDark ? 'bg-[#e8e6df] text-[#262624]' : 'bg-[#40403a] text-white'}`}>
            <Plus size={15} strokeWidth={2.4} />
          </span>
          <MoreVertical size={18} strokeWidth={2.1} className={textPrimary} />
        </div>
      </div>

      {/* Feed */}
      <div
        ref={feedRef}
        className="phone-chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-3 pt-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {!hasMessages && (
          <div className="flex h-[60%] flex-col items-center justify-center gap-3">
            <Starburst size={34} />
            <span className={`${textPrimary} text-center text-[25px]`} style={{ fontFamily: SERIF }}>
              {greeting()}, {selfName}
            </span>
          </div>
        )}

        {displayMessages.map((msg) => {
          const participant = getParticipant(msg.participantId);
          const isSelf = participant?.isSelf ?? false;

          if (isSelf) {
            return (
              <div key={msg.id} className="group/aimsg relative flex justify-end py-1.5">
                {msg.kind === 'image' && msg.objectUrl ? (
                  <img src={msg.objectUrl} alt="" className="max-h-[260px] max-w-[210px] rounded-[16px] object-cover" />
                ) : (
                  <div className={`${bubbleBg} ${textPrimary} max-w-[80%] rounded-[16px] px-3.5 py-2.5`}>
                    {editableText(msg, 'text-[14.5px] leading-[20px]')}
                  </div>
                )}
                {isEditor && (
                  <AiMessageActions msgId={msg.id} isSelf accent={CLAUDE_ORANGE} onAddText={onAddText} onDelete={onDeleteMessage} />
                )}
              </div>
            );
          }

          return (
            <div key={msg.id} className="group/aimsg relative py-2">
              {msg.kind === 'image' && msg.objectUrl ? (
                <img src={msg.objectUrl} alt="" className="max-h-[260px] max-w-[210px] rounded-[16px] object-cover" />
              ) : (
                editableText(msg, `${textPrimary} text-[16.5px] leading-[25px]`, { fontFamily: SERIF })
              )}
              <div className={`${iconColor} mt-3 flex items-center gap-[18px]`}>
                <Copy size={15} strokeWidth={1.8} />
                <Share2 size={15} strokeWidth={1.8} />
                <Play size={15} strokeWidth={1.8} />
                <ThumbsUp size={15} strokeWidth={1.8} />
                <ThumbsDown size={15} strokeWidth={1.8} />
                <RotateCw size={15} strokeWidth={1.8} />
              </div>
              {isEditor && (
                <AiMessageActions msgId={msg.id} isSelf={false} accent={CLAUDE_ORANGE} onAddText={onAddText} onDelete={onDeleteMessage} />
              )}
            </div>
          );
        })}

        {/* Thinking indicator: pulsing starburst */}
        {showThinking && (
          <div className="py-3">
            <Starburst size={22} className="animate-pulse" />
          </div>
        )}

        {/* Footer: starburst + disclaimer after the conversation */}
        {hasMessages && lastIsAssistant && !showThinking && (
          <div className="flex items-start justify-between gap-4 pb-1 pt-3">
            <Starburst size={20} className="mt-0.5 flex-shrink-0" />
            <div className={`${textMuted} text-right text-[10.5px] leading-[15px]`}>
              Claude is AI and can make mistakes.<br />Please double-check responses.
            </div>
          </div>
        )}
      </div>

      {/* Input card */}
      <div data-chat-input className="flex-shrink-0 px-3 pb-2 pt-1">
        <div className={`${cardBg} rounded-[24px] px-4 pb-3 pt-3.5 shadow-sm ${isDark ? '' : 'ring-1 ring-black/5'}`}>
          <div className={`${textMuted} text-[15px] leading-none`}>
            {hasMessages ? 'Reply to Claude…' : 'How can I help you today?'}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Plus size={19} strokeWidth={2} className={iconColor} />
              <span
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => onUpdateSubtitle?.(e.currentTarget.textContent ?? '')}
                className={`${pillBg} rounded-lg px-3 py-1.5 text-[12.5px] font-medium leading-none outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
              >
                {modelLabel}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Mic size={18} strokeWidth={2} className={iconColor} />
              <span className={`flex h-8 w-8 items-center justify-center rounded-full ${isDark ? 'bg-white text-black' : 'bg-[#40403a] text-white'}`}>
                <AudioLines size={16} strokeWidth={2.1} />
              </span>
            </div>
          </div>
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
