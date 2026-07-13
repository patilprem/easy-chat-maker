import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  EllipsisVertical,
  Gift,
  ImagePlus,
  MessageSquarePlus,
  Mic,
  PhoneCall,
  Plus,
  Search,
  Smile,
  Sparkles,
  Trash2,
  Video,
} from 'lucide-react';
import { DeviceStatusBar } from './DeviceStatusBar';
import { TypingIndicator } from './TypingIndicator';
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
  onAddText?: (afterId: string) => void;
  onAddImage?: (afterId: string, file: File) => void;
  onAddDate?: (afterId: string, label?: string) => void;
  onUpdateTitle?: (t: string) => void;
  onUpdateSubtitle?: (s: string) => void;
  onAvatarClick?: (participantId: string) => void;
  feedRef?: React.RefObject<HTMLDivElement | null>;
}

function isDiscordMessage(msg: Message | undefined): msg is TextMessage | ImageMessage {
  return !!msg && (msg.kind === 'text' || msg.kind === 'image');
}

function formatDiscordDate(date = new Date()): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function getMenuOverlayStyle(anchor: DOMRect): React.CSSProperties {
  const width = 176;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - 178));
  return { position: 'fixed', left, top, width, zIndex: 9999 };
}

function getReactionOverlayStyle(anchor: DOMRect): React.CSSProperties {
  const width = 304;
  const height = 44;
  const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
  const preferredTop = anchor.top - height - 8;
  const top = preferredTop >= 8
    ? preferredTop
    : Math.min(anchor.bottom + 8, window.innerHeight - height - 8);

  return { position: 'fixed', left, top, width, zIndex: 9999 };
}

function getActionOverlayStyle(anchor: DOMRect): React.CSSProperties {
  const width = 62;
  const height = 28;
  const left = Math.max(4, Math.min(anchor.right - width - 6, window.innerWidth - width - 4));
  const top = Math.max(4, Math.min(anchor.top + 4, window.innerHeight - height - 4));
  return { position: 'fixed', left, top, width, zIndex: 9998 };
}

const QUICK_REACTIONS = [
  '\u2764\uFE0F',
  '\uD83D\uDE02',
  '\uD83D\uDE2E',
  '\uD83D\uDE22',
  '\uD83D\uDC4D',
  '\uD83D\uDC4E',
  '\uD83D\uDD25',
  '\uD83D\uDE0D',
  '\uD83D\uDC4F',
];

function discordHandle(name = ''): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'user';
}

function discordInitials(name = ''): string {
  return name
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '?';
}

function avatarColor(name = ''): string {
  const colors = ['#5865f2', '#f23f42', '#23a559', '#fee75c', '#eb459e', '#57f287', '#ffb02e'];
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

const DiscordAvatar: React.FC<{ participant?: Participant; size?: number; onClick?: () => void }> = ({ participant, size = 42, onClick }) => {
  if (!participant) return <div style={{ width: size, height: size }} className="flex-shrink-0" />;
  const isGenerated = participant.avatarUrl?.startsWith('data:image/svg+xml');
  const className = `${onClick ? 'cursor-pointer hover:opacity-85' : ''} flex-shrink-0 rounded-full object-cover`;

  if (!isGenerated && participant.avatarUrl) {
    return <img src={participant.avatarUrl} alt={participant.name} style={{ width: size, height: size }} className={className} onClick={onClick} />;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{ width: size, height: size, backgroundColor: avatarColor(participant.name) }}
      className={`${className} flex items-center justify-center text-[13px] font-extrabold text-white`}
    >
      {discordInitials(participant.name)}
    </button>
  );
};

const DiscordText: React.FC<{ text: string; isDark: boolean }> = ({ text, isDark }) => {
  const parts = text.split(/(@[\w.-]+|https?:\/\/\S+)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('@')) {
          return (
            <span key={`${part}-${index}`} className={`${isDark ? 'bg-[#3c3f73] text-[#d6dcff]' : 'bg-[#e8eaff] text-[#5865f2]'} rounded px-0.5 font-semibold`}>
              {part}
            </span>
          );
        }
        if (/^https?:\/\//.test(part)) {
          return <span key={`${part}-${index}`} className="text-[#00a8fc]">{part}</span>;
        }
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      })}
    </>
  );
};

const DiscordDateDivider: React.FC<{ label: string; isDark: boolean; isEditor: boolean; onSave?: (value: string) => void }> = ({
  label, isDark, isEditor, onSave,
}) => (
  <div className="flex items-center gap-3 px-4 py-4">
    <div className={`h-px flex-1 ${isDark ? 'bg-[#3f4147]' : 'bg-[#d4d7dc]'}`} />
    <span
      contentEditable={isEditor}
      suppressContentEditableWarning
      onBlur={(e) => onSave?.(e.currentTarget.textContent ?? '')}
      className={`${isDark ? 'text-[#949ba4]' : 'text-[#6a7480]'} text-[12px] font-bold outline-none`}
    >
      {label}
    </span>
    <div className={`h-px flex-1 ${isDark ? 'bg-[#3f4147]' : 'bg-[#d4d7dc]'}`} />
  </div>
);

const DiscordMessageRow: React.FC<{
  msg: TextMessage | ImageMessage;
  participant?: Participant;
  project: ChatProject;
  isEditor: boolean;
  isFirstInGroup: boolean;
  onEdit?: (id: string, text: string) => void;
  onReaction?: (id: string, emoji: string) => void;
  onClearReaction?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddText?: (afterId: string) => void;
  onAddImage?: (afterId: string, file: File) => void;
  onAddDate?: (afterId: string, label?: string) => void;
  onAvatarClick?: (participantId: string) => void;
}> = ({
  msg, participant, project, isEditor, isFirstInGroup,
  onEdit, onReaction, onClearReaction, onDelete, onAddText, onAddImage, onAddDate, onAvatarClick,
}) => {
  const isDark = project.theme === 'dark';
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActionStrip, setShowActionStrip] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [reactionAnchor, setReactionAnchor] = useState<DOMRect | null>(null);
  const [actionAnchor, setActionAnchor] = useState<DOMRect | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const textPrimary = isDark ? 'text-[#dbdee1]' : 'text-[#2e3338]';
  const textMuted = isDark ? 'text-[#949ba4]' : 'text-[#6a7480]';
  const hoverBg = isDark ? 'hover:bg-[#2b2d31]' : 'hover:bg-[#f2f3f5]';

  const updateActionAnchor = useCallback(() => {
    setActionAnchor(rowRef.current?.getBoundingClientRect() ?? null);
  }, []);

  useEffect(() => {
    if (!showActionStrip && !showMenu && !showReactionPicker) return;
    updateActionAnchor();
    window.addEventListener('resize', updateActionAnchor);
    window.addEventListener('scroll', updateActionAnchor, true);
    return () => {
      window.removeEventListener('resize', updateActionAnchor);
      window.removeEventListener('scroll', updateActionAnchor, true);
    };
  }, [showActionStrip, showMenu, showReactionPicker, updateActionAnchor]);

  useEffect(() => {
    if (!showMenu && !showReactionPicker) return;
    const closeOverlays = () => {
      setShowMenu(false);
      setShowReactionPicker(false);
      setMenuAnchor(null);
      setReactionAnchor(null);
    };
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        menuRef.current?.contains(target) ||
        reactionRef.current?.contains(target) ||
        menuButtonRef.current?.contains(target) ||
        reactionButtonRef.current?.contains(target)
      ) return;
      closeOverlays();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeOverlays();
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', closeOverlays, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', closeOverlays, true);
    };
  }, [showMenu, showReactionPicker]);

  const actionBtnClass = isDark
    ? 'bg-[#313338] text-[#b5bac1] hover:bg-[#3a3d43] border border-white/5'
    : 'bg-white text-[#5c6470] hover:bg-[#f2f3f5] border border-black/10 shadow-sm';

  const actionStrip = isEditor ? (
    <div
      style={actionAnchor ? getActionOverlayStyle(actionAnchor) : undefined}
      onMouseEnter={() => {
        setShowActionStrip(true);
        updateActionAnchor();
      }}
      onMouseLeave={() => {
        if (!showMenu && !showReactionPicker) setShowActionStrip(false);
      }}
      className="flex h-7 w-[62px] items-center justify-end gap-1"
    >
      <button
        ref={reactionButtonRef}
        onClick={() => {
          const next = !showReactionPicker;
          setShowReactionPicker(next);
          setReactionAnchor(next ? reactionButtonRef.current?.getBoundingClientRect() ?? null : null);
          setShowMenu(false);
          setMenuAnchor(null);
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-full ${actionBtnClass}`}
        title="Add reaction"
      >
        <Smile size={15} />
      </button>
      <button
        ref={menuButtonRef}
        onClick={() => {
          const next = !showMenu;
          setShowMenu(next);
          setMenuAnchor(next ? menuButtonRef.current?.getBoundingClientRect() ?? null : null);
          setShowReactionPicker(false);
          setReactionAnchor(null);
        }}
        className={`flex h-7 w-7 items-center justify-center rounded-full ${actionBtnClass}`}
        title="Message options"
      >
        <EllipsisVertical size={15} />
      </button>
    </div>
  ) : null;

  return (
    <div
      ref={rowRef}
      onMouseEnter={() => {
        setShowActionStrip(true);
        updateActionAnchor();
      }}
      onMouseLeave={() => {
        if (!showMenu && !showReactionPicker) setShowActionStrip(false);
      }}
      className={`group/message relative flex gap-3 px-4 ${isFirstInGroup ? 'pt-3' : 'pt-1'} pb-1 ${hoverBg}`}
    >
      <div className="w-11 flex-shrink-0">
        {isFirstInGroup && participant ? (
          <DiscordAvatar participant={participant} onClick={() => onAvatarClick?.(participant.id)} />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        {showActionStrip && actionAnchor && typeof document !== 'undefined' && createPortal(actionStrip, document.body)}

        {isFirstInGroup && participant && (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className={`${textPrimary} truncate text-[14.5px] font-extrabold leading-[18px]`}>
              {participant.name}
            </span>
            <span className={`${textMuted} flex-shrink-0 text-[12.5px] leading-[17px]`}>
              {msg.time ?? '12:20 PM'}
            </span>
          </div>
        )}

        {msg.kind === 'image' && msg.objectUrl ? (
          <img src={msg.objectUrl} alt="" className="mt-1 block max-h-[260px] max-w-[210px] rounded-[16px] object-cover" />
        ) : (
          <div
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onEdit?.(msg.id, e.currentTarget.textContent ?? '')}
            onPaste={(e) => {
              e.preventDefault();
              document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            }}
            className={`${textPrimary} text-[14.5px] leading-[21px] outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
            style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
          >
            <DiscordText text={msg.kind === 'text' ? msg.text : ''} isDark={isDark} />
          </div>
        )}

        {msg.reaction && (
          <button
            onClick={() => isEditor && onClearReaction?.(msg.id)}
            className={`reaction-badge mt-2 inline-flex items-center gap-1 rounded-[5px] px-1.5 py-0.5 text-[14px] transition-transform ${
              isDark ? 'bg-[#2b2d31] text-[#d6d9df]' : 'bg-[#e9ecef] text-[#2e3338]'
            } ${isEditor ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
            title={isEditor ? 'Remove reaction' : undefined}
          >
            <span>{msg.reaction.emoji}</span>
            <span className="text-[12px] font-bold leading-none">1</span>
          </button>
        )}

        {showReactionPicker && reactionAnchor && typeof document !== 'undefined' && createPortal(
          <div
            ref={reactionRef}
            style={getReactionOverlayStyle(reactionAnchor)}
            className={`flex items-center justify-center gap-1 rounded-full border px-2 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.22)] ${
              isDark ? 'border-white/10 bg-[#313338]' : 'border-black/10 bg-white'
            }`}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReaction?.(msg.id, emoji);
                  setShowReactionPicker(false);
                  setReactionAnchor(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[19px] transition-transform hover:scale-125"
                title={`React ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>,
          document.body
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAddImage?.(msg.id, file);
            e.target.value = '';
          }}
        />

        {showMenu && menuAnchor && typeof document !== 'undefined' && createPortal(
          <div
            ref={menuRef}
            style={getMenuOverlayStyle(menuAnchor)}
            className={`rounded-xl border py-1 shadow-[0_8px_28px_rgba(0,0,0,0.22)] ${
              isDark ? 'border-white/10 bg-[#313338] text-white' : 'border-black/10 bg-white text-[#2e3338]'
            }`}
          >
            {[
              { icon: <MessageSquarePlus size={14} />, label: 'Add message below', action: () => onAddText?.(msg.id) },
              { icon: <ImagePlus size={14} />, label: 'Add image below', action: () => fileRef.current?.click() },
              { icon: <CalendarPlus size={14} />, label: 'Add date below', action: () => onAddDate?.(msg.id, formatDiscordDate()) },
              { icon: <Trash2 size={14} className="text-red-500" />, label: 'Delete message', action: () => onDelete?.(msg.id), danger: true },
            ].map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.action();
                  setShowMenu(false);
                  setMenuAnchor(null);
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${isDark ? 'hover:bg-white/8' : 'hover:bg-black/5'} ${item.danger ? 'text-red-500' : ''}`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body
        )}
      </div>
    </div>
  );
};

export const DiscordPreview: React.FC<Props> = ({
  project, mode, visibleCount, typingParticipantId, activeReactionIds = [],
  onUpdateMessage, onSetReaction, onClearReaction, onDeleteMessage, onAddText, onAddImage, onAddDate,
  onUpdateTitle, onUpdateSubtitle, onAvatarClick, feedRef,
}) => {
  const isEditor = mode === 'editor';
  const isDark = project.theme === 'dark';
  const allVisible = visibleCount === undefined;
  const displayMessages = allVisible ? project.messages : project.messages.slice(0, visibleCount);
  const getParticipant = useCallback(
    (id: string): Participant | undefined => project.participants.find((p) => p.id === id),
    [project.participants]
  );
  const typingParticipant = typingParticipantId ? getParticipant(typingParticipantId) : null;
  const otherParticipant = project.participants.find((p) => !p.isSelf);
  const headerParticipant = otherParticipant ?? project.participants[0];

  const bg = isDark ? 'bg-[#1e1f22]' : 'bg-white';
  const headerBg = isDark ? 'bg-[#1e1f22] border-[#2b2d31]' : 'bg-white border-[#d9dce1]';
  const textPrimary = isDark ? 'text-[#f2f3f5]' : 'text-[#060607]';
  const textMuted = isDark ? 'text-[#949ba4]' : 'text-[#6a7480]';
  const iconButton = isDark ? 'bg-[#282a2f] text-[#dbdee1]' : 'bg-[#f2f3f5] text-[#4e5661]';
  const inputBg = isDark ? 'bg-[#282a2f]' : 'bg-[#f2f3f5]';

  const editableProps = (onSave: (value: string) => void) =>
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
    <div className={`flex h-full min-h-0 w-full flex-col overflow-hidden ${bg}`}>
      <DeviceStatusBar os={project.deviceOS} theme={project.theme} surface="discord" />

      <div className={`${headerBg} flex flex-shrink-0 items-center gap-2 border-b px-3 py-1.5`}>
        <button className={`${textPrimary} flex h-8 w-7 flex-shrink-0 items-center justify-center`}>
          <ChevronLeft size={26} strokeWidth={2.7} />
        </button>
        <DiscordAvatar participant={headerParticipant} size={32} onClick={() => onAvatarClick?.(headerParticipant?.id ?? '')} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1">
            <span
              {...editableProps((v) => onUpdateTitle?.(v))}
              className={`${textPrimary} truncate text-[16px] font-extrabold leading-[20px] outline-none`}
            >
              {project.title}
            </span>
            <ChevronRight size={17} className={textMuted} />
          </div>
          <div
            {...editableProps((v) => onUpdateSubtitle?.(v))}
            className={`${textMuted} truncate text-[12.5px] font-medium leading-[15px] outline-none`}
          >
            {project.subtitle ?? (project.isGroup ? `${project.participants.length} Members` : 'Active now')}
          </div>
        </div>
        <button className={`${iconButton} flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full`}>
          <PhoneCall size={17} strokeWidth={2.5} />
        </button>
        {!project.isGroup && (
          <button className={`${iconButton} flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full`}>
            <Video size={17} strokeWidth={2.5} />
          </button>
        )}
        <button className={`${iconButton} flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full`}>
          <Search size={18} strokeWidth={2.5} />
        </button>
      </div>

      <div
        ref={feedRef}
        className="phone-chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3"
        style={{ scrollBehavior: 'smooth' }}
      >
        {displayMessages.map((msg, idx) => {
          if (msg.kind === 'date') {
            return (
              <DiscordDateDivider
                key={msg.id}
                label={msg.label}
                isDark={isDark}
                isEditor={isEditor}
                onSave={(label) => onUpdateMessage?.(msg.id, { label } as Partial<Message>)}
              />
            );
          }

          if (msg.kind === 'system') {
            return (
              <div
                key={msg.id}
                contentEditable={isEditor}
                suppressContentEditableWarning
                onBlur={(e) => onUpdateMessage?.(msg.id, { text: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                className={`mx-0 my-2 border-l-4 px-4 py-2 text-[14.5px] leading-[21px] outline-none ${
                  isDark ? 'border-[#f0b232] bg-[#2f2b22] text-[#dbdee1]' : 'border-[#f0b232] bg-[#fff8e5] text-[#2e3338]'
                }`}
              >
                <DiscordText text={msg.text} isDark={isDark} />
              </div>
            );
          }

          if (!isDiscordMessage(msg)) return null;

          const participant = getParticipant(msg.participantId);
          const prev = displayMessages[idx - 1];
          const prevMessage = isDiscordMessage(prev) ? prev : null;
          const isFirstInGroup = !prevMessage || prevMessage.participantId !== msg.participantId;
          const showReaction = mode !== 'video' || activeReactionIds.includes(msg.id);
          const effectiveMsg = showReaction ? msg : { ...msg, reaction: undefined } as typeof msg;

          return (
            <DiscordMessageRow
              key={msg.id}
              msg={effectiveMsg}
              participant={participant}
              project={project}
              isEditor={isEditor}
              isFirstInGroup={isFirstInGroup}
              onEdit={(id, text) => onUpdateMessage?.(id, { text } as Partial<Message>)}
              onReaction={onSetReaction}
              onClearReaction={onClearReaction}
              onDelete={onDeleteMessage}
              onAddText={onAddText}
              onAddImage={onAddImage}
              onAddDate={onAddDate}
              onAvatarClick={onAvatarClick}
            />
          );
        })}

        {typingParticipant && (
          <div className="flex items-end gap-3 px-4 pt-3">
            <DiscordAvatar participant={typingParticipant} size={42} />
            <div className={`${isDark ? 'bg-[#2b2d31]' : 'bg-[#f2f3f5]'} rounded-[18px] px-2 py-0.5`}>
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      <div data-chat-input className={`${isDark ? 'bg-[#1e1f22]' : 'bg-white'} flex flex-shrink-0 items-center gap-2 border-t px-3 py-2 ${isDark ? 'border-[#2b2d31]' : 'border-[#e3e5e8]'}`}>
        <button className={`${iconButton} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full`}>
          <Plus size={23} strokeWidth={2.1} />
        </button>
        <button className={`${iconButton} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full`}>
          <Sparkles size={20} strokeWidth={2.2} />
        </button>
        <button className={`${iconButton} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full`}>
          <Gift size={20} strokeWidth={2.2} />
        </button>
        <div className={`${inputBg} ${textMuted} flex min-w-0 flex-1 items-center gap-2 rounded-full px-3.5 py-2`}>
          <span className="min-w-0 flex-1 truncate text-[14px] leading-none">Message {project.isGroup ? project.title : '...'}</span>
          <Smile size={20} strokeWidth={2.2} className="flex-shrink-0" />
        </div>
        <button className={`${iconButton} flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full`}>
          <Mic size={21} strokeWidth={2.2} />
        </button>
      </div>

      {project.deviceOS === 'android' && (
        <div className={`${isDark ? 'bg-[#1e1f22] text-white' : 'bg-white text-[#4e5661]'} flex h-8 flex-shrink-0 items-center justify-around`}>
          <span className="text-[23px] leading-none">|||</span>
          <span className="h-[15px] w-[15px] rounded-full border-2 border-current" />
          <ChevronLeft size={24} strokeWidth={2.1} className="-rotate-180" />
        </div>
      )}
    </div>
  );
};
