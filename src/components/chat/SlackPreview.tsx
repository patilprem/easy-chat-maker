import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, ChevronDown, ChevronLeft, EllipsisVertical, Headphones, ImagePlus, MessageSquarePlus, Mic, Plus, Smile, Trash2 } from 'lucide-react';
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

function isSlackMessage(msg: Message | undefined): msg is TextMessage | ImageMessage {
  return !!msg && (msg.kind === 'text' || msg.kind === 'image');
}

function formatSlackDateChip(date = new Date()): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
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

function slackHandle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return 'user';
  const words = trimmed.split(/\s+/);
  if (words.length >= 2) return words.map((word) => word[0] ?? '').join('').toLowerCase();
  return trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function slackInitials(name = ''): string {
  return name
    .split(/\s+/)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2) || '?';
}

function slackAvatarColor(name = ''): string {
  const colors = ['#1b4332', '#6b4226', '#0f3460', '#533483', '#2b2d42', '#075e54', '#8a3ffc'];
  const hash = Array.from(name).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colors[hash % colors.length];
}

function formattedSlackCreatedDate(date = new Date()): string {
  const day = date.getDate();
  const suffix = day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th';
  const month = date.toLocaleDateString('en-US', { month: 'long' });
  return `${month} ${day}${suffix}, ${date.getFullYear()}`;
}

function parseSlackCreatedEvent(text: string): { creator: string } | null {
  const match = text.match(/^(.+?)\s+created\s+(?:group|channel)/i);
  return match ? { creator: match[1].trim() } : null;
}

function parseSlackAddedEvent(text: string): { inviter: string; addedNames: string[] } | null {
  const match = text.match(/^(.+?)\s+added\s+(.+)$/i);
  if (!match) return null;
  const addedNames = match[2]
    .replace(/\band\b/gi, ',')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return addedNames.length > 0 ? { inviter: match[1].trim(), addedNames } : null;
}

const SlackMention: React.FC<{ children: React.ReactNode; isDark: boolean }> = ({ children, isDark }) => (
  <span className={`${isDark ? 'bg-[#12384c] text-[#6ec6ff]' : 'bg-[#e8f5ff] text-[#1264a3]'} rounded-sm px-0.5`}>
    {children}
  </span>
);

const SlackLockIcon: React.FC<{ size?: number; className?: string; filled?: boolean }> = ({ size = 18, className = '', filled = false }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path
      d="M7.2 10.4V8.15C7.2 5.45 9.25 3.5 12 3.5s4.8 1.95 4.8 4.65v2.25h.35c1.05 0 1.9.85 1.9 1.9v6.3c0 1.05-.85 1.9-1.9 1.9H6.85a1.9 1.9 0 0 1-1.9-1.9v-6.3c0-1.05.85-1.9 1.9-1.9h.35Zm2.15 0h5.3V8.15c0-1.52-1.05-2.55-2.65-2.55S9.35 6.63 9.35 8.15v2.25Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.9}
      strokeLinejoin="round"
    />
  </svg>
);

const SlackLogoIcon: React.FC<{ size?: number; className?: string }> = ({ size = 28, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 28 28" className={className} aria-hidden="true">
    <rect width="28" height="28" rx="7" fill="#F6F7F8" />
    <path d="M9.05 14.9a2.15 2.15 0 1 1-2.15-2.15h2.15v2.15Z" fill="#36C5F0" />
    <path d="M10.1 14.9a2.15 2.15 0 0 1 4.3 0v5.35a2.15 2.15 0 1 1-4.3 0V14.9Z" fill="#36C5F0" />
    <path d="M13.1 9.05a2.15 2.15 0 1 1 2.15-2.15v2.15H13.1Z" fill="#2EB67D" />
    <path d="M13.1 10.1a2.15 2.15 0 0 1 0 4.3H7.75a2.15 2.15 0 1 1 0-4.3h5.35Z" fill="#2EB67D" />
    <path d="M18.95 13.1a2.15 2.15 0 1 1 2.15 2.15h-2.15V13.1Z" fill="#ECB22E" />
    <path d="M17.9 13.1a2.15 2.15 0 0 1-4.3 0V7.75a2.15 2.15 0 1 1 4.3 0v5.35Z" fill="#ECB22E" />
    <path d="M14.9 18.95a2.15 2.15 0 1 1-2.15 2.15v-2.15h2.15Z" fill="#E01E5A" />
    <path d="M14.9 17.9a2.15 2.15 0 0 1 0-4.3h5.35a2.15 2.15 0 1 1 0 4.3H14.9Z" fill="#E01E5A" />
  </svg>
);

const SlackAvatar: React.FC<{ participant?: Participant; size?: number }> = ({ participant, size = 40 }) => {
  if (!participant) return <div style={{ width: size, height: size }} className="flex-shrink-0" />;
  const isGenerated = participant.avatarUrl?.startsWith('data:image/svg+xml');

  if (!isGenerated && participant.avatarUrl) {
    return (
      <img
        src={participant.avatarUrl}
        alt={participant.name}
        style={{ width: size, height: size }}
        className="rounded-[10px] object-cover"
      />
    );
  }

  return (
    <div
      style={{ width: size, height: size, backgroundColor: slackAvatarColor(participant.name) }}
      className="flex flex-shrink-0 items-center justify-center rounded-[10px] text-sm font-extrabold text-white"
    >
      {slackInitials(participant.name)}
    </div>
  );
};

const SlackChannelCreatedEvent: React.FC<{
  project: ChatProject;
  creator: string;
  isDark: boolean;
}> = ({ project, creator, isDark }) => {
  const textPrimary = isDark ? 'text-[#f8f8f8]' : 'text-[#1d1c1d]';
  const textMuted = isDark ? 'text-[#b9babd]' : 'text-[#616061]';
  const dateText = formattedSlackCreatedDate();

  return (
    <div className={`mx-4 mb-3 mt-5 border-b pb-5 ${isDark ? 'border-[#3a3a3f]' : 'border-[#dddddd]'}`}>
      <div className={`flex items-center gap-2 ${textPrimary}`}>
        <SlackLockIcon size={16} filled className="flex-shrink-0" />
        <span className="min-w-0 truncate text-[15px] font-extrabold leading-[19px]">
          {project.title}
        </span>
      </div>
      <p className={`${textMuted} mt-3 text-[14.5px] leading-[21px]`}>
        <SlackMention isDark={isDark}>@{slackHandle(creator)}</SlackMention>
        {' '}created this channel {dateText}. This is the very beginning of the {project.title} channel.
      </p>
    </div>
  );
};

const SlackMemberJoinedEvent: React.FC<{
  project: ChatProject;
  inviter: string;
  addedNames: string[];
  participant?: Participant;
  isDark: boolean;
}> = ({ project, inviter, addedNames, participant, isDark }) => {
  const textPrimary = isDark ? 'text-[#f8f8f8]' : 'text-[#1d1c1d]';
  const textMuted = isDark ? 'text-[#b9babd]' : 'text-[#616061]';
  const actorName = addedNames[0] ?? participant?.name ?? inviter;
  const remainingNames = addedNames.slice(1);

  return (
    <div className="flex gap-3 px-4 pb-2 pt-3">
      <div className="w-10 flex-shrink-0">
        <SlackAvatar participant={participant} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <span className={`${textPrimary} truncate text-[15px] font-extrabold leading-[19px]`}>
            {actorName}
          </span>
          <span className={`${textMuted} flex-shrink-0 text-[12.5px] leading-[17px]`}>9:56 AM</span>
        </div>
        <p className={`${textMuted} text-[14.5px] leading-[21px]`}>
          joined {project.title} by invitation from{' '}
          <SlackMention isDark={isDark}>@{slackHandle(inviter)}</SlackMention>
          {remainingNames.length > 0 && (
            <>
              {' '}along with{' '}
              {remainingNames.map((name, index) => (
                <React.Fragment key={`${name}-${index}`}>
                  <SlackMention isDark={isDark}>@{slackHandle(name)}</SlackMention>
                  {index < remainingNames.length - 2 ? ', ' : index === remainingNames.length - 2 ? ', and ' : ''}
                </React.Fragment>
              ))}
            </>
          )}
          .
        </p>
      </div>
    </div>
  );
};

const SlackMessageRow: React.FC<{
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
}> = ({
  msg, participant, project, isEditor, isFirstInGroup,
  onEdit, onReaction, onClearReaction, onDelete, onAddText, onAddImage, onAddDate,
}) => {
  const isDark = project.theme === 'dark';
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [reactionAnchor, setReactionAnchor] = useState<DOMRect | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textPrimary = isDark ? 'text-[#f8f8f8]' : 'text-[#1d1c1d]';
  const textMuted = isDark ? 'text-[#a1a1aa]' : 'text-[#616061]';

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

  return (
    <div className={`group/message relative flex gap-3 px-4 ${isFirstInGroup ? 'pt-3' : 'pt-1'} pb-1`}>
      <div className="w-10 flex-shrink-0">
        {isFirstInGroup && participant ? (
          <SlackAvatar participant={participant} />
        ) : null}
      </div>

      <div className="min-w-0 flex-1">
        {isFirstInGroup && participant && (
          <div className="flex min-w-0 items-baseline gap-2">
            <span className={`${textPrimary} truncate text-[15px] font-extrabold leading-[19px]`}>
              {participant.name}
            </span>
            <span className={`${textMuted} flex-shrink-0 text-[12.5px] leading-[17px]`}>
              {msg.time ?? '9:41 AM'}
            </span>
          </div>
        )}

        {msg.kind === 'image' && msg.objectUrl ? (
          <img
            src={msg.objectUrl}
            alt=""
            className="mt-1 block max-h-[300px] max-w-[185px] rounded-[18px] object-cover"
          />
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
            {msg.kind === 'text' ? msg.text : ''}
          </div>
        )}

        {msg.reaction && (
          <button
            onClick={() => isEditor && onClearReaction?.(msg.id)}
            className={`reaction-badge mt-2 inline-flex items-center gap-1 rounded-full px-3 py-1 text-[16px] transition-transform ${
              isDark ? 'bg-[#27272b]' : 'bg-[#f6f6f6]'
            } ${isEditor ? 'cursor-pointer hover:scale-105' : 'cursor-default'}`}
            title={isEditor ? 'Remove reaction' : undefined}
          >
            <span>{msg.reaction.emoji}</span>
            <span className={`${textPrimary} text-[13.5px] font-bold`}>1</span>
          </button>
        )}
      </div>

      {isEditor && (
        <>
          <button
            ref={reactionButtonRef}
            onClick={() => {
              const next = !showReactionPicker;
              setShowReactionPicker(next);
              setReactionAnchor(next ? reactionButtonRef.current?.getBoundingClientRect() ?? null : null);
              setShowMenu(false);
              setMenuAnchor(null);
            }}
            className={`absolute right-11 top-2 hidden h-7 w-7 items-center justify-center rounded-full group-hover/message:flex ${
              isDark ? 'bg-[#2b2d31] text-[#d1d2d3] hover:bg-[#373a40]' : 'bg-white text-[#616061] shadow-sm hover:bg-[#f6f6f6]'
            }`}
            title="Add reaction"
          >
            <Smile size={15} />
          </button>

          {showReactionPicker && reactionAnchor && typeof document !== 'undefined' && createPortal(
            <div
              ref={reactionRef}
              style={getReactionOverlayStyle(reactionAnchor)}
              className={`flex items-center justify-center gap-1 rounded-full border px-2 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.22)] ${
                isDark ? 'border-white/10 bg-[#222429]' : 'border-black/10 bg-white'
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

          <button
            ref={menuButtonRef}
            onClick={() => {
              const next = !showMenu;
              setShowMenu(next);
              setMenuAnchor(next ? menuButtonRef.current?.getBoundingClientRect() ?? null : null);
              setShowReactionPicker(false);
              setReactionAnchor(null);
            }}
            className={`absolute right-3 top-2 hidden h-7 w-7 items-center justify-center rounded-full group-hover/message:flex ${
              isDark ? 'bg-[#2b2d31] text-[#d1d2d3] hover:bg-[#373a40]' : 'bg-white text-[#616061] shadow-sm hover:bg-[#f6f6f6]'
            }`}
            title="Message options"
          >
            <EllipsisVertical size={15} />
          </button>

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
                isDark ? 'border-white/10 bg-[#222429] text-white' : 'border-black/10 bg-white text-[#1d1c1d]'
              }`}
            >
              {[
                { icon: <MessageSquarePlus size={14} />, label: 'Add message below', action: () => onAddText?.(msg.id) },
                { icon: <ImagePlus size={14} />, label: 'Add image below', action: () => fileRef.current?.click() },
                { icon: <CalendarPlus size={14} />, label: 'Add date below', action: () => onAddDate?.(msg.id, formatSlackDateChip()) },
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
        </>
      )}
    </div>
  );
};

export const SlackPreview: React.FC<Props> = ({
  project, mode, visibleCount, typingParticipantId,
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
  const headerParticipant = project.isGroup ? undefined : otherParticipant ?? project.participants[0];

  const bg = isDark ? 'bg-[#1d1c21]' : 'bg-white';
  const headerBg = isDark ? 'bg-[#1d1c21] border-[#3a3a3f]' : 'bg-white border-[#dddddd]';
  const headerPill = isDark ? 'bg-[#232428]' : 'bg-[#f7f7f7]';
  const textPrimary = isDark ? 'text-[#f8f8f8]' : 'text-[#1d1c1d]';
  const textMuted = isDark ? 'text-[#c7c7cc]' : 'text-[#616061]';
  const inputBg = isDark ? 'bg-[#1d1c21] border-[#3a3a3f]' : 'bg-white border-[#dddddd]';
  const inputIconBg = isDark ? 'bg-[#2a2b2f]' : 'bg-[#f2f2f2]';

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
    <div className={`flex h-full min-h-0 w-full flex-col overflow-hidden ${bg}`}>
      <DeviceStatusBar os={project.deviceOS} theme={project.theme} surface="slack" />

      <div className={`${headerBg} flex flex-shrink-0 items-center gap-3 border-b px-3 py-2`}>
        <ChevronLeft size={29} strokeWidth={2.4} className={`${textPrimary} flex-shrink-0`} />
        <div className={`${headerPill} flex min-w-0 flex-1 items-center gap-2 rounded-2xl px-2.5 py-1.5`}>
          {project.isGroup ? (
            <SlackLockIcon size={19} className={`${textPrimary} flex-shrink-0`} />
          ) : (
            <button
              onClick={() => onAvatarClick?.(otherParticipant?.id ?? '')}
              className={`relative flex-shrink-0 ${isEditor ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
            >
              <SlackAvatar participant={headerParticipant} size={36} />
              <span className={`absolute -bottom-1.5 right-0 h-3.5 w-3.5 rounded-full border-2 ${isDark ? 'border-[#232428]' : 'border-[#f7f7f7]'} bg-white`} />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div
              {...editableProps((v) => onUpdateTitle?.(v))}
              className={`${textPrimary} truncate text-[14.5px] font-extrabold leading-[17px] outline-none`}
            >
              {project.title}
            </div>
            <div
              {...editableProps((v) => onUpdateSubtitle?.(v))}
              className={`${textMuted} flex items-center gap-1 truncate text-[12px] leading-[15px] outline-none`}
            >
              {project.subtitle ?? (project.isGroup ? `${project.participants.length} members • 4 tabs` : '3 tabs')}
              <ChevronDown size={14} />
            </div>
          </div>
        </div>
        <SlackLogoIcon size={30} className="flex-shrink-0" />
        <Headphones size={23} strokeWidth={2.3} className={`${textPrimary} flex-shrink-0`} />
      </div>

      <div
        ref={feedRef}
        className={`phone-chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${bg} pb-3`}
        style={{ scrollBehavior: 'smooth' }}
      >
        {displayMessages.map((msg, idx) => {
          if (msg.kind === 'date') {
            return (
              <div key={msg.id} className="relative my-4 flex items-center justify-center">
                <div className={`absolute inset-x-0 top-1/2 h-px ${isDark ? 'bg-[#3a3a3f]' : 'bg-[#dddddd]'}`} />
                <span
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateMessage?.(msg.id, { label: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                  className={`${bg} ${textMuted} relative rounded-full border px-3 py-1 text-[12.5px] font-bold leading-none outline-none ${
                    isDark ? 'border-[#3a3a3f]' : 'border-[#dddddd]'
                  } ${isEditor ? 'cursor-text' : 'select-none'}`}
                >
                  {msg.label}
                </span>
              </div>
            );
          }

          if (msg.kind === 'system') {
            const createdEvent = parseSlackCreatedEvent(msg.text);
            if (createdEvent) {
              return (
                <SlackChannelCreatedEvent
                  key={msg.id}
                  project={project}
                  creator={createdEvent.creator}
                  isDark={isDark}
                />
              );
            }

            const addedEvent = parseSlackAddedEvent(msg.text);
            if (addedEvent) {
              const participant = project.participants.find((p) => (
                p.name.toLowerCase() === addedEvent.addedNames[0]?.toLowerCase()
              ));
              return (
                <SlackMemberJoinedEvent
                  key={msg.id}
                  project={project}
                  inviter={addedEvent.inviter}
                  addedNames={addedEvent.addedNames}
                  participant={participant}
                  isDark={isDark}
                />
              );
            }

            return (
              <div key={msg.id} className={`px-[86px] py-3 text-[14.5px] leading-[24px] ${textPrimary}`}>
                <span
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateMessage?.(msg.id, { text: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                  className={`outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
                >
                  {msg.text}
                </span>
              </div>
            );
          }

          if (!isSlackMessage(msg)) return null;

          const participant = getParticipant(msg.participantId);
          const prev = displayMessages[idx - 1];
          const prevMessage = isSlackMessage(prev) ? prev : null;
          const isFirstInGroup = !prevMessage || prevMessage.participantId !== msg.participantId;

          return (
            <SlackMessageRow
              key={msg.id}
              msg={msg}
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
            />
          );
        })}

        {typingParticipant && (
          <div className="flex gap-3 px-4 pt-3">
            <SlackAvatar participant={typingParticipant} />
            <div className={`${isDark ? 'bg-[#2a2b2f]' : 'bg-[#f6f6f6]'} rounded-xl px-2`}>
              <TypingIndicator />
            </div>
          </div>
        )}
      </div>

      <div data-chat-input className={`${bg} flex-shrink-0 px-0 pt-1`}>
        <div className={`${inputBg} flex items-center gap-2.5 rounded-t-[18px] border px-5 py-2`}>
          <div className={`${inputIconBg} flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${textPrimary}`}>
            <Plus size={22} strokeWidth={2.1} />
          </div>
          <span className={`${textMuted} min-w-0 flex-1 truncate text-[14.5px] leading-none`}>
            Message {project.title}
          </span>
          <Mic size={22} strokeWidth={2.2} className={`${textMuted} flex-shrink-0`} />
        </div>
      </div>

      {project.deviceOS === 'android' && (
        <div className={`${isDark ? 'bg-[#1d1c21] text-white' : 'bg-white text-[#555555]'} flex h-8 flex-shrink-0 items-center justify-around`}>
          <span className="text-[23px] leading-none">|||</span>
          <span className="h-[15px] w-[15px] rounded-full border-2 border-current" />
          <ChevronLeft size={24} strokeWidth={2.1} className="-rotate-180" />
        </div>
      )}
    </div>
  );
};
