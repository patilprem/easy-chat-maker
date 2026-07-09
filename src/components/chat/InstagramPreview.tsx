import React, { useRef, useCallback } from 'react';
import { BadgeCheck, Camera, ChevronLeft, CirclePlus, ImageIcon, Mic, Phone, Smile, UserPlus, Video } from 'lucide-react';
import { InstagramBubble } from './InstagramBubble';
import { TypingIndicator } from './TypingIndicator';
import { DeviceStatusBar } from './DeviceStatusBar';
import type { ChatProject, Message, Participant, TextMessage, ImageMessage } from '../../lib/parser/types';

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
  onAddText?: (afterId: string) => void;
  onAddImage?: (afterId: string, file: File) => void;
  onAddDate?: (afterId: string, label?: string) => void;
  onUpdateTitle?: (t: string) => void;
  onUpdateSubtitle?: (s: string) => void;
  onAvatarClick?: (participantId: string) => void;
  feedRef?: React.RefObject<HTMLDivElement | null>;
}

export const InstagramPreview: React.FC<Props> = ({
  project, mode,
  visibleCount, typingParticipantId, activeReactionIds = [],
  onUpdateMessage, onSetReaction, onClearReaction, onDeleteMessage,
  onAddText, onAddImage, onAddDate,
  onUpdateTitle, onUpdateSubtitle, onAvatarClick, feedRef,
}) => {
  const isEditor = mode === 'editor';
  const isDark = project.theme === 'dark';
  const allVisible = visibleCount === undefined;

  const getParticipant = useCallback(
    (id: string): Participant | undefined => project.participants.find((p) => p.id === id),
    [project.participants]
  );

  const displayMessages = allVisible
    ? project.messages
    : project.messages.slice(0, visibleCount);

  const typingParticipant = typingParticipantId
    ? getParticipant(typingParticipantId)
    : null;

  const otherParticipant = project.participants.find((p) => !p.isSelf);
  const groupAvatarParticipants = project.participants.slice(0, 3);
  const groupActiveText = project.subtitle?.toLowerCase().includes('active')
    ? project.subtitle
    : `${Math.min(2, Math.max(1, project.participants.filter((p) => !p.isSelf).length))} active now`;

  const bg = isDark ? 'bg-black' : 'bg-white';
  const headerBg = isDark ? 'bg-black' : 'bg-white';
  const textPrimary = isDark ? 'text-white' : 'text-black';
  const textSecondary = isDark ? 'text-[#a8a8a8]' : 'text-[#737373]';
  const inputShellBg = isDark ? 'bg-[#262626]' : 'bg-[#efefef]';
  const inputIconColor = isDark ? 'text-white' : 'text-black';

  const editableProps = (onSave: (v: string) => void) =>
    isEditor
      ? {
          contentEditable: true as const,
          suppressContentEditableWarning: true,
          onBlur: (e: React.FocusEvent<HTMLElement>) => onSave(e.currentTarget.textContent ?? ''),
          onPaste: (e: React.ClipboardEvent) => {
            e.preventDefault();
            document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
          },
        }
      : {};

  return (
    <div className={`flex flex-col h-full min-h-0 w-full overflow-hidden ${isDark ? 'dark' : ''}`}>
      <DeviceStatusBar os={project.deviceOS} theme={project.theme} surface="instagram" />

      <div className={`${headerBg} flex items-center gap-3 px-3 pt-2 pb-2.5 flex-shrink-0`}>
        <ChevronLeft size={26} strokeWidth={2.2} className={`${textPrimary} flex-shrink-0`} />
        {project.isGroup ? (
          <button
            onClick={() => onAvatarClick?.(groupAvatarParticipants[0]?.id ?? '')}
            className={`relative h-9 w-11 flex-shrink-0 ${isEditor ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          >
            {groupAvatarParticipants.slice(0, 2).map((member, index) => (
              <img
                key={member.id}
                src={member.avatarUrl}
                alt={member.name}
                className={`absolute h-7 w-7 rounded-full object-cover ring-2 ${isDark ? 'ring-black' : 'ring-white'} ${
                  index === 0 ? 'left-0 top-0 z-10' : 'bottom-0 right-0'
                }`}
              />
            ))}
            <span className={`absolute bottom-0 right-0 z-20 h-2.5 w-2.5 rounded-full border-2 ${isDark ? 'border-black' : 'border-white'} bg-[#00c853]`} />
          </button>
        ) : (
          <button
            onClick={() => onAvatarClick?.(otherParticipant?.id ?? '')}
            className={`relative flex-shrink-0 ${isEditor ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          >
            <img
              src={otherParticipant?.avatarUrl}
              alt={otherParticipant?.name ?? ''}
              className="w-8 h-8 rounded-full object-cover block"
            />
          </button>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 min-w-0">
            <div
              {...editableProps((v) => onUpdateTitle?.(v))}
              className={`${textPrimary} text-[15.5px] leading-[17.5px] font-bold truncate outline-none`}
            >
              {project.title}
            </div>
            {!project.isGroup && (
              <BadgeCheck size={14} className="text-[#0095f6] fill-[#0095f6] stroke-white flex-shrink-0" strokeWidth={3} />
            )}
          </div>
          <div
            {...editableProps((v) => {/* username edit handled via participant update */})}
            className={`${textSecondary} text-[12.5px] leading-[16.5px] truncate outline-none`}
          >
            {project.isGroup ? groupActiveText : project.subtitle ?? 'Active today'}
          </div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {project.isGroup && <UserPlus size={21} strokeWidth={1.9} className={textPrimary} />}
          <Phone size={24} strokeWidth={2.1} className={textPrimary} />
          <Video size={25} strokeWidth={2.1} className={textPrimary} />
        </div>
      </div>

      {/* Chat feed */}
      <div
        ref={feedRef}
        className={`phone-chat-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${bg} py-2`}
        style={{ scrollBehavior: 'smooth' }}
      >
        {displayMessages.map((msg, idx) => {
          if (msg.kind === 'date') {
            return (
              <div key={msg.id} className="flex justify-center my-4">
                <span
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateMessage?.(msg.id, { label: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                  className={`${textSecondary} text-[12px] leading-none font-medium uppercase outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
                >
                  {msg.label}
                </span>
              </div>
            );
          }
          if (msg.kind === 'system') {
            return (
              <div key={msg.id} className="flex justify-center my-3 px-8">
                <span
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateMessage?.(msg.id, { text: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                  className={`${textSecondary} text-[12px] leading-[16px] text-center outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
                >
                  {msg.text}
                </span>
              </div>
            );
          }

          const bubbleMsg = msg as TextMessage | ImageMessage;
          const participant = getParticipant(bubbleMsg.participantId);

          const prev = displayMessages[idx - 1];
          const next = displayMessages[idx + 1];
          const prevBubble = prev && (prev.kind === 'text' || prev.kind === 'image') ? prev : null;
          const nextBubble = next && (next.kind === 'text' || next.kind === 'image') ? next : null;
          const isFirstInGroup = !prevBubble || prevBubble.participantId !== bubbleMsg.participantId;
          const isLastInGroup = !nextBubble || nextBubble.participantId !== bubbleMsg.participantId;
          const showSenderName = project.isGroup && !participant?.isSelf && isFirstInGroup && !!participant;

          const showReaction = mode === 'editor' || activeReactionIds.includes(msg.id);
          const effectiveMsg = showReaction ? bubbleMsg : { ...bubbleMsg, reaction: undefined } as typeof bubbleMsg;

          return (
            <InstagramBubble
              key={msg.id}
              msg={effectiveMsg}
              participant={participant}
              project={project}
              mode={mode}
              isFirstInGroup={isFirstInGroup}
              isLastInGroup={isLastInGroup}
              showSenderName={showSenderName}
              onEdit={(id, text) => onUpdateMessage?.(id, { text } as Partial<Message>)}
              onReaction={onSetReaction}
              onClearReaction={onClearReaction}
              onDelete={onDeleteMessage}
              onAddText={onAddText}
              onAddImage={onAddImage}
              onAddDate={onAddDate}
            />
          );
        })}

        {/* Typing indicator */}
        {typingParticipant && (
          <div className="flex items-end gap-2 px-3 py-0.5">
            <img
              src={typingParticipant.avatarUrl}
              alt={typingParticipant.name}
              className="w-6 h-6 rounded-full object-cover flex-shrink-0"
            />
            <div className={`${isDark ? 'bg-[#262626]' : 'bg-[#efefef]'} rounded-[22px_22px_22px_4px] overflow-hidden`}>
              <TypingIndicator />
            </div>
          </div>
        )}

        {typingParticipant && <div className="h-16" aria-hidden="true" />}
      </div>

      <div data-chat-input className={`${bg} px-2.5 pt-1.5 pb-2 flex-shrink-0`}>
        <div className={`${inputShellBg} flex items-center gap-3 rounded-full px-2 py-2`}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-[#00FF87] to-[#60EFFF] flex items-center justify-center flex-shrink-0">
            <Camera size={22} strokeWidth={2.4} className="text-[#061116]" />
          </div>
          <span className={`${textSecondary} flex-1 min-w-0 text-[15.5px] leading-none truncate`}>Message...</span>
          <Mic size={22} strokeWidth={2.2} className={`${inputIconColor} flex-shrink-0`} />
          <ImageIcon size={22} strokeWidth={2.2} className={`${inputIconColor} flex-shrink-0`} />
          <Smile size={22} strokeWidth={2.2} className={`${inputIconColor} flex-shrink-0`} />
          <CirclePlus size={24} strokeWidth={2.2} className={`${inputIconColor} flex-shrink-0`} />
        </div>
      </div>

      {project.deviceOS === 'android' && (
        <div className={`${bg} ${textSecondary} h-8 flex items-center justify-around flex-shrink-0`}>
          <span className="text-[23px] leading-none">|||</span>
          <span className={`w-[15px] h-[15px] rounded-full border-2 ${isDark ? 'border-white' : 'border-[#737373]'}`} />
          <ChevronLeft size={24} strokeWidth={2.1} className="-rotate-180" />
        </div>
      )}
    </div>
  );
};
