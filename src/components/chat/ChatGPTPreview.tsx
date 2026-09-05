import React, { useCallback } from 'react';
import { ArrowUp, Copy, Menu, Mic, MoreVertical, Plus, Share2, SquarePen, ThumbsDown, ThumbsUp, Trash2, Volume2, MessageSquarePlus } from 'lucide-react';
import { DeviceStatusBar } from './DeviceStatusBar';
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
  onUpdateStatusTime?: (t: string) => void;
  onAvatarClick?: (participantId: string) => void;
  onGroupAvatarClick?: () => void;
  feedRef?: React.RefObject<HTMLDivElement | null>;
  /** Story mode: no status bar, header or input bar — bubbles only. */
  chromeless?: boolean;
  /** Story mode only: keep the header even though chromeless strips everything else. */
  showHeader?: boolean;
}

function isChatMessage(msg: Message | undefined): msg is TextMessage | ImageMessage {
  return !!msg && (msg.kind === 'text' || msg.kind === 'image');
}

/** Hover strip with add / delete controls, shared by AI previews */
export const AiMessageActions: React.FC<{
  msgId: string;
  isSelf: boolean;
  accent: string;
  onAddText?: (afterId: string) => void;
  onDelete?: (id: string) => void;
}> = ({ msgId, isSelf, accent, onAddText, onDelete }) => (
  <div
    className={`absolute top-0 ${isSelf ? 'left-0' : 'right-0'} z-10 flex items-center gap-1 opacity-0 transition-opacity group-hover/aimsg:opacity-100`}
  >
    <button
      onClick={() => onAddText?.(msgId)}
      className="flex h-6 w-6 items-center justify-center rounded-full bg-black/40 text-white/80 hover:text-white"
      style={{ backgroundColor: 'rgba(120,120,120,0.25)' }}
      title="Add message below"
    >
      <MessageSquarePlus size={13} />
    </button>
    <button
      onClick={() => onDelete?.(msgId)}
      className="flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:text-red-300"
      style={{ backgroundColor: 'rgba(120,120,120,0.25)' }}
      title={`Delete message`}
      data-accent={accent}
    >
      <Trash2 size={13} />
    </button>
  </div>
);

export const ChatGPTPreview: React.FC<Props> = ({
  project, mode, visibleCount, typingParticipantId,
  onUpdateMessage, onDeleteMessage, onAddText, onUpdateStatusTime,
  feedRef, chromeless = false,
  showHeader = false,
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
  const showStreamDot = !!typingParticipant && !typingParticipant.isSelf;

  const pageBg = isDark ? 'bg-black' : 'bg-white';
  const chipBg = isDark ? 'bg-[#1f1f1f]' : 'bg-[#f3f3f3]';
  const textPrimary = isDark ? 'text-[#ececec]' : 'text-[#0d0d0d]';
  const textMuted = isDark ? 'text-[#8e8e8e]' : 'text-[#8f8f8f]';
  const bubbleBg = isDark ? 'bg-[#303030]' : 'bg-[#f4f4f4]';
  const iconColor = isDark ? 'text-[#b4b4b4]' : 'text-[#5d5d5d]';
  const inputBg = isDark ? 'bg-[#2f2f2f]' : 'bg-[#f4f4f4]';
  // Assistant replies are bare text with no bubble behind them, unlike self
  // messages (always paired with a same-theme bubble). The real app relies on
  // the page background for contrast; story mode's scrim is always a dark
  // overlay, so a light-theme project would otherwise render invisible dark
  // text there.
  const assistantTextColor = chromeless ? 'text-[#ececec]' : textPrimary;
  const assistantIconColor = chromeless ? 'text-[#b4b4b4]' : iconColor;

  const hasMessages = displayMessages.length > 0;

  return (
    <div className={`flex h-full min-h-0 w-full flex-col overflow-hidden ${chromeless ? '' : pageBg}`}>
      {!chromeless && (
      <DeviceStatusBar
        os={project.deviceOS}
        theme={project.theme}
        surface="chatgpt"
        time={project.statusBarTime}
        editable={isEditor}
        onEditTime={onUpdateStatusTime}
      />
      )}

      {/* Header */}
      {(!chromeless || showHeader) && (
      <div className="flex flex-shrink-0 items-center justify-between px-3 pb-1.5 pt-1.5">
        <div className="flex items-center gap-2">
          <button className={`${chipBg} ${textPrimary} flex h-9 w-9 items-center justify-center rounded-full`}>
            <Menu size={17} strokeWidth={2.2} />
          </button>
          <div className={`${chipBg} ${textPrimary} flex items-center rounded-full px-4 py-2 text-[15px] font-semibold leading-none`}>
            ChatGPT
          </div>
        </div>
        <div className={`${chipBg} ${textPrimary} flex items-center gap-3.5 rounded-full px-3.5 py-2`}>
          <SquarePen size={16} strokeWidth={2.1} />
          <MoreVertical size={16} strokeWidth={2.1} />
        </div>
      </div>
      )}

      {/* Feed */}
      <div
        ref={feedRef}
        className="phone-chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-3 pt-2"
        style={{ scrollBehavior: 'smooth' }}
      >
        {!hasMessages && !chromeless && (
          <div className="flex h-full items-center justify-center">
            <span className={`${textPrimary} text-[21px] font-semibold`}>What can I help with?</span>
          </div>
        )}

        {displayMessages.map((msg) => {
          const participant = getParticipant(msg.participantId);
          const isSelf = participant?.isSelf ?? false;

          if (isSelf) {
            return (
              <div key={msg.id} className="group/aimsg relative flex justify-end py-1.5">
                {msg.kind === 'image' && msg.objectUrl ? (
                  <img src={msg.objectUrl} alt="" className="max-h-[260px] max-w-[210px] rounded-[18px] object-cover" />
                ) : (
                  <div className={`${bubbleBg} ${textPrimary} max-w-[78%] rounded-[22px] px-4 py-2.5`}>
                    <div
                      contentEditable={isEditor}
                      suppressContentEditableWarning
                      onBlur={(e) => onUpdateMessage?.(msg.id, { text: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                      onPaste={(e) => {
                        e.preventDefault();
                        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                      }}
                      className={`text-[14px] leading-[19.5px] outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
                      style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                    >
                      {msg.kind === 'text' ? msg.text : ''}
                    </div>
                  </div>
                )}
                {isEditor && (
                  <AiMessageActions msgId={msg.id} isSelf accent="#10a37f" onAddText={onAddText} onDelete={onDeleteMessage} />
                )}
              </div>
            );
          }

          // Assistant message: plain text + action row
          return (
            <div key={msg.id} className="group/aimsg relative py-2">
              {msg.kind === 'image' && msg.objectUrl ? (
                <img src={msg.objectUrl} alt="" className="max-h-[260px] max-w-[210px] rounded-[18px] object-cover" />
              ) : (
                <div
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateMessage?.(msg.id, { text: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                  onPaste={(e) => {
                    e.preventDefault();
                    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
                  }}
                  className={`${assistantTextColor} text-[14.5px] leading-[22px] outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
                  style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
                >
                  {msg.kind === 'text' ? msg.text : ''}
                </div>
              )}
              <div className={`${assistantIconColor} mt-2.5 flex items-center gap-[18px]`}>
                <Copy size={15} strokeWidth={2} />
                <ThumbsUp size={15} strokeWidth={2} />
                <ThumbsDown size={15} strokeWidth={2} />
                <Volume2 size={15} strokeWidth={2} />
                <Share2 size={15} strokeWidth={2} />
                <MoreVertical size={15} strokeWidth={2} />
              </div>
              {isEditor && (
                <AiMessageActions msgId={msg.id} isSelf={false} accent="#10a37f" onAddText={onAddText} onDelete={onDeleteMessage} />
              )}
            </div>
          );
        })}

        {/* Streaming indicator: pulsing dot */}
        {showStreamDot && (
          <div className="py-2" data-typing-indicator>
            <span className={`block h-3.5 w-3.5 animate-pulse rounded-full ${chromeless || isDark ? 'bg-white' : 'bg-black'}`} />
          </div>
        )}
      </div>

      {/* Input bar */}
      {!chromeless && (
      <div data-chat-input className="flex-shrink-0 px-3 pb-2 pt-1">
        <div className={`${inputBg} flex items-center gap-2.5 rounded-full py-2.5 pl-4 pr-2`}>
          <Plus size={20} strokeWidth={2.1} className={`${textPrimary} flex-shrink-0`} />
          <span className={`${textMuted} min-w-0 flex-1 truncate text-[15px]`}>
            {hasMessages ? 'Reply to ChatGPT' : 'Ask anything'}
          </span>
          <Mic size={19} strokeWidth={2} className={`${textPrimary} flex-shrink-0`} />
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${isDark ? 'bg-white text-black' : 'bg-black text-white'}`}>
            <ArrowUp size={17} strokeWidth={2.4} />
          </span>
        </div>
      </div>
      )}
    </div>
  );
};
