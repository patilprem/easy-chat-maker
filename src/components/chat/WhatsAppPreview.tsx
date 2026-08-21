import React, { useRef, useCallback, useMemo } from 'react';
import { ChevronLeft, Video, Phone, PhoneMissed, EllipsisVertical, Camera, Paperclip, Smile, Mic, Trash2, Play } from 'lucide-react';
import { WhatsAppBubble } from './WhatsAppBubble';
import { SystemChip } from './SystemChip';
import { TypingIndicator } from './TypingIndicator';
import { DeviceStatusBar } from './DeviceStatusBar';
import { EditableTime } from './EditableTime';
import type { ChatProject, Message, Participant, TextMessage, ImageMessage, CallMessage, VoiceNoteMessage } from '../../lib/parser/types';
import { DOODLE_IMG } from '../../lib/doodlePattern';
import { ChatBackgroundLayer } from './ChatBackgroundLayer';
import { hasCustomBackground, showDoodle } from '../../lib/backgrounds';
import { escapeXml, initialsFrom, svgDataUri } from '../../lib/svgText';

function generateGroupInitials(title: string): string {
  const initials = escapeXml(initialsFrom(title));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00a884"/><stop offset="100%" style="stop-color:#005c4b"/>
    </linearGradient></defs>
    <circle cx="20" cy="20" r="20" fill="url(#g)"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
      font-family="system-ui,sans-serif" font-size="15" font-weight="700" fill="white">${initials}</text>
  </svg>`;
  return svgDataUri(svg);
}

// Custom Call Card Bubble as seen in Ashwini ❤️ chat screenshot
const WhatsAppCallCard: React.FC<{
  msg: CallMessage;
  project: ChatProject;
  isEditor: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onDelete?: (id: string) => void;
  onEditTime?: (id: string, time: string) => void;
}> = ({ msg, project, isEditor, isFirstInGroup, isLastInGroup, onDelete, onEditTime }) => {
  const isDark = project.theme === 'dark';
  const isMissed = msg.status === 'missed';
  
  const participant = project.participants.find((p) => p.id === msg.participantId);
  const isSelf = participant?.isSelf ?? false;
  
  const cardBg = isDark ? 'bg-[#202c33]' : 'bg-white';
  const textColor = isDark ? 'text-[#e9edef]' : 'text-[#111b21]';
  const subColor = isDark ? 'text-[#8696a0]' : 'text-[#667781]';
  const tail = isFirstInGroup
    ? isSelf
      ? 'whatsapp-bubble-right rounded-[8px_0px_8px_8px]'
      : 'whatsapp-bubble-left rounded-[0px_8px_8px_8px]'
    : 'rounded-[8px]';

  return (
    <div className={`flex items-start gap-1.5 px-3 py-0.5 group relative ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isSelf && (
        <div className="w-7 h-7 flex-shrink-0 mt-[1px]">
          {isLastInGroup && participant && (
            <img
              src={participant.avatarUrl}
              alt={participant.name}
              className="w-7 h-7 rounded-full object-cover"
            />
          )}
        </div>
      )}
      <div className={`relative flex items-center gap-3 p-3 shadow-sm max-w-[68%] min-w-[210px] ${cardBg} ${tail}`}>
        {/* Call icon wrapper */}
        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
          isDark ? 'bg-[#2a3942]' : 'bg-[#f0f2f5]'
        }`}>
          {isMissed ? (
            <PhoneMissed size={18} className="text-red-500" />
          ) : (
            <Phone size={18} className="text-[#00a884]" />
          )}
        </div>
        
        {/* Call details */}
        <div className="flex-1 min-w-0 pr-6">
          <h4 className={`text-[13.5px] font-medium leading-snug ${textColor}`}>
            {isMissed ? 'Missed voice call' : 'Voice call'}
          </h4>
          <p className={`text-[12px] ${subColor} mt-0.5`}>
            {isMissed ? 'Missed voice call' : msg.duration ?? 'Voice call'}
          </p>
        </div>
        
        {/* Time */}
        <EditableTime
          value={msg.time}
          editable={isEditor}
          onEdit={(t) => onEditTime?.(msg.id, t)}
          className={`absolute bottom-1.5 right-2.5 text-[10px] ${subColor}`}
        />

        {/* Delete button (editor only) */}
        {isEditor && (
          <button
            onClick={() => onDelete?.(msg.id)}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md"
            title="Delete call log"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

const WAVEFORM_BARS = [10, 18, 24, 15, 27, 20, 12, 30, 18, 25, 14, 22, 28, 17, 31, 19, 13, 24, 16, 29, 21, 12, 18, 26, 15, 23, 17, 11];

const WhatsAppVoiceNoteCard: React.FC<{
  msg: VoiceNoteMessage;
  participant?: Participant;
  project: ChatProject;
  isEditor: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onDelete?: (id: string) => void;
  onEditTime?: (id: string, time: string) => void;
}> = ({ msg, participant, project, isEditor, isFirstInGroup, isLastInGroup, onDelete, onEditTime }) => {
  const isDark = project.theme === 'dark';
  const isSelf = participant?.isSelf ?? false;
  const bubbleBg = isSelf
    ? isDark ? 'bg-[#005c4b]' : 'bg-[#d9fdd3]'
    : isDark ? 'bg-[#202c33]' : 'bg-white';
  const textColor = isDark ? 'text-[#e9edef]' : 'text-[#111b21]';
  const subColor = isDark ? 'text-[#8696a0]' : 'text-[#667781]';
  const waveColor = isDark ? 'bg-[#8696a0]' : 'bg-[#9aa8af]';
  const playedWaveColor = isDark ? 'bg-[#53bdeb]' : 'bg-[#00a884]';
  const tail = isFirstInGroup
    ? isSelf
      ? 'whatsapp-bubble-right rounded-[8px_0px_8px_8px]'
      : 'whatsapp-bubble-left rounded-[0px_8px_8px_8px]'
    : 'rounded-[8px]';

  return (
    <div className={`flex items-start gap-1.5 px-3 py-0.5 group relative ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}>
      {!isSelf && (
        <div className="w-7 h-7 flex-shrink-0 mt-[1px]">
          {isLastInGroup && participant && (
            <img
              src={participant.avatarUrl}
              alt={participant.name}
              className="w-7 h-7 rounded-full object-cover"
            />
          )}
        </div>
      )}
      <div className={`relative flex items-center gap-2.5 px-3 py-2 shadow-sm min-w-[260px] max-w-[82%] ${bubbleBg} ${tail}`}>
        <button className={`w-8 h-8 flex items-center justify-center rounded-full ${isDark ? 'text-[#d1d7db]' : 'text-[#667781]'}`}>
          <Play size={22} fill="currentColor" strokeWidth={0} />
        </button>

        <div className="flex-1 min-w-0 pt-0.5">
          <div className="flex items-center gap-[2px] h-8">
            {WAVEFORM_BARS.map((height, index) => (
              <span
                key={index}
                className={`w-[2px] rounded-full ${index < 7 ? playedWaveColor : waveColor}`}
                style={{ height: `${height}px`, opacity: index < 7 ? 0.95 : 0.7 }}
              />
            ))}
          </div>
          <div className={`flex items-center justify-between mt-0.5 text-[10.5px] leading-none ${subColor}`}>
            <span>{msg.duration}</span>
            <EditableTime
              value={msg.time}
              editable={isEditor}
              onEdit={(t) => onEditTime?.(msg.id, t)}
            />
          </div>
        </div>

        {participant && (
          <div className="relative w-9 h-9 flex-shrink-0">
            <img
              src={participant.avatarUrl}
              alt={participant.name}
              className="w-9 h-9 rounded-full object-cover"
            />
            <span className="absolute -bottom-1 -left-1 w-4 h-4 rounded-full bg-[#00a884] flex items-center justify-center ring-2 ring-inherit">
              <Mic size={10} className="text-white" />
            </span>
          </div>
        )}

        {isEditor && (
          <button
            onClick={() => onDelete?.(msg.id)}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md"
            title="Delete voice note"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    </div>
  );
};

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
  onAddSystem?: (afterId: string) => void;
  onAddCall?: (afterId: string, isVoice?: boolean, duration?: string, status?: 'missed' | 'completed' | 'declined') => void;
  onAddVoiceNote?: (afterId: string, duration?: string) => void;
  onUpdateTitle?: (t: string) => void;
  onUpdateSubtitle?: (s: string) => void;
  onUpdateStatusTime?: (t: string) => void;
  onAvatarClick?: (participantId: string) => void;
  onGroupAvatarClick?: () => void;
  feedRef?: React.RefObject<HTMLDivElement | null>;
}


function isParticipantMessage(msg: Message | undefined): msg is TextMessage | ImageMessage | CallMessage | VoiceNoteMessage {
  return !!msg && (msg.kind === 'text' || msg.kind === 'image' || msg.kind === 'call' || msg.kind === 'voice');
}

/**
 * The avatar sits with the last TEXT bubble in a consecutive run from the same
 * sender, not just whatever happens to be the last message. Otherwise adding a
 * photo (or a call/voice card) below someone's text pulls the avatar off the
 * words and onto the attachment.
 */
function computeAvatarAnchorIds(messages: Message[]): Set<string> {
  const anchors = new Set<string>();
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (!isParticipantMessage(msg)) {
      i += 1;
      continue;
    }
    const participantId = msg.participantId;
    let j = i;
    let lastTextIdx = -1;
    while (j < messages.length) {
      const m = messages[j];
      if (!isParticipantMessage(m) || m.participantId !== participantId) break;
      if (m.kind === 'text') lastTextIdx = j;
      j += 1;
    }
    anchors.add(messages[lastTextIdx !== -1 ? lastTextIdx : j - 1].id);
    i = j;
  }
  return anchors;
}

export const WhatsAppPreview: React.FC<Props> = ({
  project, mode,
  visibleCount, typingParticipantId, activeReactionIds = [],
  onUpdateMessage, onSetReaction, onClearReaction, onDeleteMessage,
  onAddText, onAddImage, onAddDate, onAddSystem, onAddCall, onAddVoiceNote,
  onUpdateTitle, onUpdateSubtitle, onUpdateStatusTime, onAvatarClick, onGroupAvatarClick, feedRef,
}) => {
  const isEditor = mode === 'editor';
  const isDark = project.theme === 'dark';
  const allVisible = visibleCount === undefined;
  const hasBackground = hasCustomBackground(project);
  const doodleOn = showDoodle(project);

  // Blank timestamp -> drop the field, so platform defaults can kick back in
  const handleEditTime = useCallback(
    (id: string, time: string) => onUpdateMessage?.(id, { time: time || undefined } as Partial<Message>),
    [onUpdateMessage]
  );

  const getParticipant = useCallback(
    (id: string): Participant | undefined => project.participants.find((p) => p.id === id),
    [project.participants]
  );

  // Visible messages subset
  const displayMessages = allVisible
    ? project.messages
    : project.messages.slice(0, visibleCount);

  const avatarAnchorIds = useMemo(() => computeAvatarAnchorIds(displayMessages), [displayMessages]);

  // Current typing participant
  const typingParticipant = typingParticipantId
    ? getParticipant(typingParticipantId)
    : null;

  // Resolve group avatar
  const groupAvatarSrc = (project as any)._groupAvatarUrl ?? generateGroupInitials(project.title);
  const headerAvatarSrc = project.isGroup
    ? groupAvatarSrc
    : getParticipant(project.participants.find((p) => !p.isSelf)?.id ?? '')?.avatarUrl ?? '';

  // Colors
  const bg = isDark ? 'bg-[#0b141a]' : 'bg-[#efeae2]';
  const headerBg = isDark ? 'bg-[#202c33]' : 'bg-white border-b border-gray-200';
  const headerTextColor = isDark ? 'text-white' : 'text-gray-800';
  const headerSubColor = isDark ? 'text-green-400' : 'text-gray-500';
  const inputBg = isDark ? 'bg-[#0b141a]' : 'bg-[#f0f2f5]';
  const inputFieldBg = isDark ? 'bg-[#1f2c34]' : 'bg-white';

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
          className: 'outline-none cursor-text',
        }
      : { className: 'cursor-default select-none' };

  return (
    <div className={`flex flex-col h-full min-h-0 w-full overflow-hidden ${isDark ? 'dark' : ''}`}>
      <DeviceStatusBar
        os={project.deviceOS}
        theme={project.theme}
        surface="whatsapp"
        time={project.statusBarTime}
        editable={isEditor}
        onEditTime={onUpdateStatusTime}
      />

      {/* Header */}
      <div className={`${headerBg} flex items-center gap-2 px-2 py-2 flex-shrink-0 shadow-sm`}>
        <ChevronLeft size={22} className={`${headerTextColor} flex-shrink-0 cursor-pointer`} />
        <button
          onClick={project.isGroup ? onGroupAvatarClick : () => onAvatarClick?.(project.participants.find((p) => !p.isSelf)?.id ?? '')}
          className={`relative flex-shrink-0 ${isEditor ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
        >
          <img src={headerAvatarSrc} alt="avatar" className="w-9 h-9 rounded-full object-cover" />
        </button>
        <div className="flex-1 min-w-0">
          <div
            {...editableProps((v) => onUpdateTitle?.(v))}
            className={`${headerTextColor} text-[14.5px] font-semibold truncate ${editableProps(() => {}).className}`}
          >
            {project.title}
          </div>
          <div
            {...editableProps((v) => onUpdateSubtitle?.(v))}
            className={`${headerSubColor} text-[11.5px] truncate ${editableProps(() => {}).className}`}
          >
            {project.subtitle ?? (project.isGroup ? '3 members' : 'online')}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <Video size={20} className={headerTextColor} />
          <Phone size={20} className={headerTextColor} />
          <EllipsisVertical size={20} className={headerTextColor} />
        </div>
      </div>

      {/* Chat feed — the wallpaper sits in this wrapper, BEHIND the scroller,
          so it stays put while messages scroll over it, exactly like the real
          app (and so neither exporter has to compensate for it). */}
      <div className="relative flex flex-1 min-h-0 flex-col">
      <ChatBackgroundLayer project={project} />
      <div
        ref={feedRef}
        data-has-background={hasBackground ? '' : undefined}
        className={`phone-chat-scroll relative z-[1] flex-1 min-h-0 overflow-y-auto overflow-x-hidden ${hasBackground ? '' : bg}`}
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Inner wrapper grows to the full scroll height so the doodle covers
            the whole conversation, not just the first screen. The vertical
            padding lives here (not on the feed) so the pattern reaches the
            feed's top and bottom edges with no bare strip. */}
        <div className="relative min-h-full py-2">
        {/* WhatsApp doodle overlay (whatsapp-bg.png — white doodles; inverted
            on the light theme so they read dark on the beige bg) */}
        {doodleOn && (
        <div
          data-chat-wallpaper
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `url('${DOODLE_IMG}')`,
            backgroundRepeat: 'repeat',
            backgroundSize: '380px auto',
            opacity: isDark ? 0.05 : 0.07,
            filter: isDark ? undefined : 'invert(1)',
          }}
        />
        )}

        <div className="relative z-10 space-y-1 px-1">
          {displayMessages.map((msg, idx) => {
            if (msg.kind === 'date') {
              return (
                <SystemChip key={msg.id} text={msg.label} variant="date" theme={project.theme}
                  editable={isEditor}
                  onEdit={(t) => onUpdateMessage?.(msg.id, { label: t } as Partial<Message>)} />
              );
            }
            if (msg.kind === 'system') {
              return (
                <SystemChip key={msg.id} text={msg.text} variant="system" theme={project.theme}
                  editable={isEditor}
                  onEdit={(t) => onUpdateMessage?.(msg.id, { text: t } as Partial<Message>)} />
              );
            }
            if (msg.kind === 'call') {
              const callMsg = msg as CallMessage;
              const prev = displayMessages[idx - 1];
              const prevBubble = isParticipantMessage(prev) ? prev : null;
              const isFirstInGroup = !prevBubble || prevBubble.participantId !== callMsg.participantId;
              const isLastInGroup = avatarAnchorIds.has(callMsg.id);

              return (
                <WhatsAppCallCard
                  key={msg.id}
                  msg={callMsg}
                  project={project}
                  isEditor={isEditor}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  onDelete={onDeleteMessage}
                  onEditTime={handleEditTime}
                />
              );
            }
            if (msg.kind === 'voice') {
              const voiceMsg = msg as VoiceNoteMessage;
              const participant = getParticipant(voiceMsg.participantId);
              const prev = displayMessages[idx - 1];
              const prevBubble = isParticipantMessage(prev) ? prev : null;
              const isFirstInGroup = !prevBubble || prevBubble.participantId !== voiceMsg.participantId;
              const isLastInGroup = avatarAnchorIds.has(voiceMsg.id);

              return (
                <WhatsAppVoiceNoteCard
                  key={msg.id}
                  msg={voiceMsg}
                  participant={participant}
                  project={project}
                  isEditor={isEditor}
                  isFirstInGroup={isFirstInGroup}
                  isLastInGroup={isLastInGroup}
                  onDelete={onDeleteMessage}
                  onEditTime={handleEditTime}
                />
              );
            }

            const bubbleMsg = msg as TextMessage | ImageMessage;
            const participant = getParticipant(bubbleMsg.participantId);

            // Grouping
            const prev = displayMessages[idx - 1];
            const prevBubble = isParticipantMessage(prev) ? prev : null;
            const isFirstInGroup = !prevBubble || prevBubble.participantId !== bubbleMsg.participantId;
            const isLastInGroup = avatarAnchorIds.has(bubbleMsg.id);

            const showReaction = mode !== 'video' || activeReactionIds.includes(msg.id);
            const effectiveMsg = showReaction ? bubbleMsg : { ...bubbleMsg, reaction: undefined } as typeof bubbleMsg;

            return (
              <WhatsAppBubble
                key={msg.id}
                msg={effectiveMsg}
                participant={participant}
                project={project}
                mode={mode}
                isFirstInGroup={isFirstInGroup}
                isLastInGroup={isLastInGroup}
                showGroupName={project.isGroup}
                onEdit={(id, text) => onUpdateMessage?.(id, { text } as Partial<Message>)}
                onEditTime={handleEditTime}
                onReaction={onSetReaction}
                onClearReaction={onClearReaction}
                onDelete={onDeleteMessage}
                onAddText={onAddText}
                onAddImage={onAddImage}
                onAddDate={onAddDate}
                onAddSystem={onAddSystem}
                onAddCall={onAddCall}
                onAddVoiceNote={onAddVoiceNote}
              />
            );
          })}
        </div>

        {/* Typing indicator */}
        {typingParticipant && (
          <div data-typing-row className="flex items-end gap-1.5 px-3 py-0.5 relative z-10">
            <img
              src={typingParticipant.avatarUrl}
              alt={typingParticipant.name}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
            <div className={`${isDark ? 'bg-[#202c33]' : 'bg-white'} rounded-[12px_12px_12px_2px] shadow-sm`}>
              <TypingIndicator />
            </div>
          </div>
        )}

        {typingParticipant && <div className="h-16 relative z-10" data-typing-tail aria-hidden="true" />}

        {/* Empty state */}
        {project.messages.length === 0 && isEditor && (
          <div className="flex items-center justify-center h-full relative z-10">
            <span className="text-gray-400 text-sm">No messages yet</span>
          </div>
        )}
        </div>
      </div>
      </div>

      {/* Input bar matching the Android UI layout */}
      <div data-chat-input className={`${inputBg} flex items-center gap-1.5 px-2 pt-2 pb-3.5 flex-shrink-0`}>
        <div className={`flex-1 flex items-center gap-2 ${inputFieldBg} rounded-full px-3.5 py-2 shadow-sm`}>
          <Smile size={21} className="text-gray-400 dark:text-[#8696a0] flex-shrink-0 cursor-pointer" />
          <span className="flex-1 text-gray-400 dark:text-[#8696a0] text-[14px]">Message</span>
          <Paperclip size={19} className="text-gray-400 dark:text-[#8696a0] flex-shrink-0 -rotate-45 cursor-pointer" />
          <Camera size={19} className="text-gray-400 dark:text-[#8696a0] flex-shrink-0 cursor-pointer" />
        </div>
        <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center flex-shrink-0 shadow-sm cursor-pointer hover:scale-105 active:scale-95 transition-transform">
          <Mic size={19} className="text-white" />
        </div>
      </div>
    </div>
  );
};
