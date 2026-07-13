import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, ChevronLeft, EllipsisVertical, ImagePlus, MessageSquarePlus, Smile, Trash2 } from 'lucide-react';
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

function isBubbleMessage(msg: Message | undefined): msg is TextMessage | ImageMessage {
  return !!msg && (msg.kind === 'text' || msg.kind === 'image');
}

function formatMessengerDateChip(date = new Date()): string {
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).toUpperCase();
}

function getMenuOverlayStyle(anchor: DOMRect, isSelf: boolean): React.CSSProperties {
  const width = 176;
  const preferredLeft = isSelf ? anchor.right - width : anchor.left;
  const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - width - 8));
  const top = Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - 178));

  return { position: 'fixed', left, top, width, zIndex: 9999 };
}

function getReactionOverlayStyle(anchor: DOMRect, isSelf: boolean): React.CSSProperties {
  const width = 304;
  const height = 44;
  const preferredLeft = isSelf ? anchor.right - width : anchor.left;
  const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - width - 8));
  const preferredTop = anchor.top - height - 8;
  const top = preferredTop >= 8
    ? preferredTop
    : Math.min(anchor.bottom + 8, window.innerHeight - height - 8);

  return { position: 'fixed', left, top, width, zIndex: 9999 };
}

function getActionOverlayStyle(anchor: DOMRect, isSelf: boolean): React.CSSProperties {
  const width = 62;
  const height = 28;
  const gap = 4;
  const preferredLeft = isSelf ? anchor.left - width - gap : anchor.right + gap;
  const left = Math.max(4, Math.min(preferredLeft, window.innerWidth - width - 4));
  const top = Math.max(4, Math.min(anchor.top + anchor.height / 2 - height / 2, window.innerHeight - height - 4));

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

type MessengerIconProps = {
  size?: number;
  className?: string;
};

const MessengerPhoneIcon: React.FC<MessengerIconProps> = ({ size = 25, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M6.62 10.79c1.45 2.86 3.73 5.14 6.59 6.59l2.2-2.2c.34-.34.85-.45 1.3-.28 1.43.48 2.96.74 4.54.74.69 0 1.25.56 1.25 1.25v3.49c0 .69-.56 1.25-1.25 1.25C10.9 21.63 2.37 13.1 2.37 2.75c0-.69.56-1.25 1.25-1.25h3.49c.69 0 1.25.56 1.25 1.25 0 1.58.26 3.11.74 4.54.14.45.05.95-.3 1.3l-2.18 2.2Z" />
  </svg>
);

const MessengerVideoIcon: React.FC<MessengerIconProps> = ({ size = 27, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M4 7.15C4 5.96 4.96 5 6.15 5h8.05c1.19 0 2.15.96 2.15 2.15v9.7c0 1.19-.96 2.15-2.15 2.15H6.15A2.15 2.15 0 0 1 4 16.85v-9.7Z" />
    <path d="M17.65 9.1c0-.36.18-.69.49-.88l2.26-1.39c.7-.43 1.6.07 1.6.89v8.56c0 .82-.9 1.32-1.6.89l-2.26-1.39a1.04 1.04 0 0 1-.49-.88V9.1Z" />
  </svg>
);

const MessengerInfoIcon: React.FC<MessengerIconProps> = ({ size = 26, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-11.1c.7 0 1.25.55 1.25 1.25v5.1a1.25 1.25 0 1 1-2.5 0v-5.1c0-.7.55-1.25 1.25-1.25Zm0-4.7a1.55 1.55 0 1 1 0 3.1 1.55 1.55 0 0 1 0-3.1Z" />
  </svg>
);

const MessengerPlusIcon: React.FC<MessengerIconProps> = ({ size = 25, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm1.1-15.1v4h4a1.1 1.1 0 1 1 0 2.2h-4v4a1.1 1.1 0 1 1-2.2 0v-4h-4a1.1 1.1 0 1 1 0-2.2h4v-4a1.1 1.1 0 1 1 2.2 0Z" />
  </svg>
);

const MessengerCameraIcon: React.FC<MessengerIconProps> = ({ size = 26, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M8.2 5.1 9.45 3.5h5.1l1.25 1.6h2.45A2.75 2.75 0 0 1 21 7.85v9.05a2.75 2.75 0 0 1-2.75 2.75H5.75A2.75 2.75 0 0 1 3 16.9V7.85A2.75 2.75 0 0 1 5.75 5.1H8.2Zm3.8 11.1a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Zm0-2.1a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Z" />
  </svg>
);

const MessengerGalleryIcon: React.FC<MessengerIconProps> = ({ size = 25, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm1.4 13.2h11.2c.5 0 .75-.6.4-.96l-3.1-3.2a.72.72 0 0 0-1.02 0l-2.14 2.12-1.05-1.08a.72.72 0 0 0-1.03 0L6 16.23c-.35.36-.1.97.4.97ZM8.4 10a1.8 1.8 0 1 0 0-3.6 1.8 1.8 0 0 0 0 3.6Z" />
  </svg>
);

const MessengerMicIcon: React.FC<MessengerIconProps> = ({ size = 25, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 14.8a3.8 3.8 0 0 0 3.8-3.8V6.1a3.8 3.8 0 0 0-7.6 0V11a3.8 3.8 0 0 0 3.8 3.8Z" />
    <path d="M18.2 10.45a1.05 1.05 0 0 0-2.1 0V11a4.1 4.1 0 1 1-8.2 0v-.55a1.05 1.05 0 1 0-2.1 0V11a6.22 6.22 0 0 0 5.1 6.12v2.03H8.65a1.05 1.05 0 1 0 0 2.1h6.7a1.05 1.05 0 1 0 0-2.1H13.1v-2.03A6.22 6.22 0 0 0 18.2 11v-.55Z" />
  </svg>
);

const MessengerSmileIcon: React.FC<MessengerIconProps> = ({ size = 23, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-3.3-9.2a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm6.6 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Zm-6.1 2.55a.9.9 0 0 1 1.24.28c.33.5.87.85 1.56.85s1.23-.35 1.56-.85a.9.9 0 1 1 1.52.96 3.6 3.6 0 0 1-6.16 0 .9.9 0 0 1 .28-1.24Z" />
  </svg>
);

const MessengerLikeIcon: React.FC<MessengerIconProps> = ({ size = 29, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M9.2 21H5.9A2.15 2.15 0 0 1 3.75 18.85v-7.1A2.15 2.15 0 0 1 5.9 9.6h3.3V21Z" />
    <path d="M10.7 9.65c1.6-1.43 2.45-3.03 2.65-5.1.09-.95.86-1.65 1.78-1.55 1.42.15 2.45 1.4 2.34 2.82-.08.98-.32 1.92-.72 2.78h2.05a2.45 2.45 0 0 1 2.38 3.05l-1.55 6.15A4.15 4.15 0 0 1 15.6 21h-4.9V9.65Z" />
  </svg>
);

const MessengerBubble: React.FC<{
  msg: TextMessage | ImageMessage;
  participant?: Participant;
  project: ChatProject;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  isEditor: boolean;
  onEdit?: (id: string, text: string) => void;
  onReaction?: (id: string, emoji: string) => void;
  onClearReaction?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddText?: (afterId: string) => void;
  onAddImage?: (afterId: string, file: File) => void;
  onAddDate?: (afterId: string, label?: string) => void;
}> = ({
  msg, participant, project, isFirstInGroup, isLastInGroup, isEditor,
  onEdit, onReaction, onClearReaction, onDelete, onAddText, onAddImage, onAddDate,
}) => {
  const isSelf = participant?.isSelf ?? false;
  const isDark = project.theme === 'dark';
  const [showMenu, setShowMenu] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showActionStrip, setShowActionStrip] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [reactionAnchor, setReactionAnchor] = useState<DOMRect | null>(null);
  const [actionAnchor, setActionAnchor] = useState<DOMRect | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const reactionButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const reactionRef = useRef<HTMLDivElement>(null);
  const bubbleWrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bubbleBg = isSelf ? 'bg-[#0084ff]' : isDark ? 'bg-[#303030]' : 'bg-[#f0f2f5]';
  const textColor = isSelf ? 'text-white' : isDark ? 'text-white' : 'text-[#050505]';

  const updateActionAnchor = useCallback(() => {
    setActionAnchor(bubbleWrapRef.current?.getBoundingClientRect() ?? null);
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

  const radius = isSelf
    ? isFirstInGroup && isLastInGroup
      ? 'rounded-[20px]'
      : isFirstInGroup
        ? 'rounded-[20px_20px_5px_20px]'
        : isLastInGroup
          ? 'rounded-[20px_5px_20px_20px]'
          : 'rounded-[20px_5px_5px_20px]'
    : isFirstInGroup && isLastInGroup
      ? 'rounded-[20px]'
      : isFirstInGroup
        ? 'rounded-[20px_20px_20px_5px]'
        : isLastInGroup
          ? 'rounded-[5px_20px_20px_20px]'
          : 'rounded-[5px_20px_20px_5px]';

  const avatar = !isSelf && isLastInGroup && participant ? (
    <img src={participant.avatarUrl} alt={participant.name} className="h-7 w-7 rounded-full object-cover" />
  ) : (
    <div className="h-7 w-7" />
  );

  const actionBtnClass = isDark
    ? 'bg-[#303030] text-[#b0b3b8] hover:bg-[#3a3a3a]'
    : 'bg-white text-[#65676b] shadow-sm hover:bg-[#f0f2f5]';

  const editorActionStrip = isEditor ? (
    <div
      style={actionAnchor ? getActionOverlayStyle(actionAnchor, isSelf) : undefined}
      onMouseEnter={() => {
        setShowActionStrip(true);
        updateActionAnchor();
      }}
      onMouseLeave={() => {
        if (!showMenu && !showReactionPicker) setShowActionStrip(false);
      }}
      className={`flex h-7 w-[62px] items-center gap-1 ${isSelf ? 'justify-end' : 'justify-start'}`}
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
        className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${actionBtnClass}`}
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
        className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${actionBtnClass}`}
        title="Message options"
      >
        <EllipsisVertical size={15} />
      </button>
    </div>
  ) : null;

  return (
    <div
      onMouseEnter={() => {
        setShowActionStrip(true);
        updateActionAnchor();
      }}
      onMouseLeave={() => {
        if (!showMenu && !showReactionPicker) setShowActionStrip(false);
      }}
      className={`group/message flex items-end gap-2 px-3 ${isFirstInGroup ? 'pt-2.5' : 'pt-0.5'} ${msg.reaction ? 'pb-3' : 'pb-0'} ${isSelf ? 'justify-end' : 'justify-start'}`}
    >
      {!isSelf && avatar}
      <div ref={bubbleWrapRef} className={`relative max-w-[78%] ${isSelf ? 'items-end' : 'items-start'} flex flex-col`}>
        {showActionStrip && actionAnchor && typeof document !== 'undefined' && createPortal(editorActionStrip, document.body)}

        {project.isGroup && !isSelf && isFirstInGroup && participant && (
          <div className={`mb-0.5 px-2 text-[10.5px] leading-none ${isDark ? 'text-[#9a9a9a]' : 'text-[#65676b]'}`}>
            {participant.name}
          </div>
        )}

        {msg.kind === 'image' && msg.objectUrl ? (
          <div className={`${radius} overflow-hidden bg-black/5 max-w-full`}>
            <img src={msg.objectUrl} alt="" className="block max-h-[260px] w-full object-cover" />
          </div>
        ) : (
          <div
            contentEditable={isEditor}
            suppressContentEditableWarning
            onBlur={(e) => onEdit?.(msg.id, e.currentTarget.textContent ?? '')}
            onPaste={(e) => {
              e.preventDefault();
              document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
            }}
            className={`${bubbleBg} ${textColor} ${radius} px-[14px] py-[8px] text-[15.5px] leading-[20px] outline-none shadow-none ${isEditor ? 'cursor-text' : 'select-none'}`}
            style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}
          >
            {msg.kind === 'text' ? msg.text : ''}
          </div>
        )}

        {msg.reaction && (
          <button
            onClick={() => isEditor && onClearReaction?.(msg.id)}
            className={`reaction-badge absolute -bottom-3 ${isSelf ? 'left-2' : 'right-2'} flex h-6 min-w-8 items-center justify-center rounded-full border px-2 text-[14px] shadow-sm transition-transform ${
              isDark ? 'border-black bg-[#303030]' : 'border-white bg-white'
            } ${isEditor ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
            title={isEditor ? 'Remove reaction' : undefined}
          >
            {msg.reaction.emoji}
          </button>
        )}

        {isEditor && (
          <>
            {showReactionPicker && reactionAnchor && typeof document !== 'undefined' && createPortal(
              <div
                ref={reactionRef}
                style={getReactionOverlayStyle(reactionAnchor, isSelf)}
                className={`flex items-center justify-center gap-1 rounded-full border px-2 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.22)] ${
                  isDark ? 'border-white/10 bg-[#242526]' : 'border-black/10 bg-white'
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
                style={getMenuOverlayStyle(menuAnchor, isSelf)}
                className={`rounded-xl border py-1 shadow-[0_8px_28px_rgba(0,0,0,0.22)] ${
                  isDark
                    ? 'border-white/10 bg-[#242526] text-white'
                    : 'border-black/10 bg-white text-[#050505]'
                }`}
              >
                {[
                  { icon: <MessageSquarePlus size={14} />, label: 'Add message below', action: () => onAddText?.(msg.id) },
                  { icon: <ImagePlus size={14} />, label: 'Add image below', action: () => fileRef.current?.click() },
                  { icon: <CalendarPlus size={14} />, label: 'Add date below', action: () => onAddDate?.(msg.id, formatMessengerDateChip()) },
                  { icon: <Trash2 size={14} className="text-red-500" />, label: 'Delete message', action: () => onDelete?.(msg.id), danger: true },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      item.action();
                      setShowMenu(false);
                      setMenuAnchor(null);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
                      isDark ? 'hover:bg-white/8' : 'hover:bg-black/5'
                    } ${item.danger ? 'text-red-500' : ''}`}
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
    </div>
  );
};

export const MessengerPreview: React.FC<Props> = ({
  project, mode, visibleCount, typingParticipantId, activeReactionIds = [],
  onUpdateMessage, onSetReaction, onClearReaction, onDeleteMessage, onAddText, onAddImage, onAddDate,
  onUpdateTitle, onUpdateSubtitle, onAvatarClick, feedRef,
}) => {
  const isEditor = mode === 'editor';
  const isDark = project.theme === 'dark';
  const allVisible = visibleCount === undefined;

  const getParticipant = useCallback(
    (id: string): Participant | undefined => project.participants.find((p) => p.id === id),
    [project.participants]
  );

  const displayMessages = allVisible ? project.messages : project.messages.slice(0, visibleCount);
  const typingParticipant = typingParticipantId ? getParticipant(typingParticipantId) : null;
  const otherParticipant = project.participants.find((p) => !p.isSelf);
  const headerAvatarSrc = otherParticipant?.avatarUrl ?? project.participants[0]?.avatarUrl ?? '';

  const bg = isDark ? 'bg-black' : 'bg-white';
  const headerBg = isDark ? 'bg-black' : 'bg-white border-b border-black/10';
  const textPrimary = isDark ? 'text-white' : 'text-[#050505]';
  const textSecondary = isDark ? 'text-[#b0b3b8]' : 'text-[#65676b]';
  const accent = 'text-[#0084ff]';
  const inputBg = isDark ? 'bg-[#303030]' : 'bg-[#f0f2f5]';

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
      <DeviceStatusBar os={project.deviceOS} theme={project.theme} surface="messenger" />

      <div className={`${headerBg} flex flex-shrink-0 items-center gap-3 px-3 py-2 shadow-sm`}>
        <ChevronLeft size={28} strokeWidth={2.4} className={`${accent} flex-shrink-0`} />
        <button
          onClick={() => onAvatarClick?.(otherParticipant?.id ?? '')}
          className={`flex-shrink-0 ${isEditor ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
        >
          <img src={headerAvatarSrc} alt="" className="h-10 w-10 rounded-full object-cover" />
        </button>
        <div className="min-w-0 flex-1">
          <div
            {...editableProps((v) => onUpdateTitle?.(v))}
            className={`${textPrimary} truncate text-[17px] font-bold leading-[20px] outline-none`}
          >
            {project.title}
          </div>
          <div
            {...editableProps((v) => onUpdateSubtitle?.(v))}
            className={`${textSecondary} truncate text-[12.5px] leading-[16px] outline-none`}
          >
            {project.subtitle ?? 'Active now'}
          </div>
        </div>
        <div className={`flex flex-shrink-0 items-center gap-4 ${accent}`}>
          <MessengerPhoneIcon size={25} />
          <MessengerVideoIcon size={27} />
          <MessengerInfoIcon size={26} />
        </div>
      </div>

      <div
        ref={feedRef}
        className={`phone-chat-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden ${bg} py-2`}
        style={{ scrollBehavior: 'smooth' }}
      >
        {displayMessages.map((msg, idx) => {
          if (msg.kind === 'date') {
            return (
              <div key={msg.id} className="flex justify-center px-8 py-4">
                <span
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateMessage?.(msg.id, { label: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                  className={`${textSecondary} text-center text-[13px] font-medium uppercase leading-[16px] outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
                >
                  {msg.label}
                </span>
              </div>
            );
          }

          if (msg.kind === 'system') {
            return (
              <div key={msg.id} className="flex justify-center px-10 py-4">
                <span
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateMessage?.(msg.id, { text: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                  className={`${textSecondary} text-center text-[13px] leading-[17px] outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
                >
                  {msg.text}
                </span>
              </div>
            );
          }

          if (!isBubbleMessage(msg)) return null;

          const participant = getParticipant(msg.participantId);
          const prev = displayMessages[idx - 1];
          const next = displayMessages[idx + 1];
          const prevBubble = isBubbleMessage(prev) ? prev : null;
          const nextBubble = isBubbleMessage(next) ? next : null;
          const isFirstInGroup = !prevBubble || prevBubble.participantId !== msg.participantId;
          const isLastInGroup = !nextBubble || nextBubble.participantId !== msg.participantId;
          const showReaction = mode !== 'video' || activeReactionIds.includes(msg.id);
          const effectiveMsg = showReaction ? msg : { ...msg, reaction: undefined } as typeof msg;

          return (
            <MessengerBubble
              key={msg.id}
              msg={effectiveMsg}
              participant={participant}
              project={project}
              isFirstInGroup={isFirstInGroup}
              isLastInGroup={isLastInGroup}
              isEditor={isEditor}
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
          <div className="flex items-end gap-2 px-3 pt-2">
            <img src={typingParticipant.avatarUrl} alt={typingParticipant.name} className="h-7 w-7 rounded-full object-cover" />
            <div className={`${isDark ? 'bg-[#303030]' : 'bg-[#f0f2f5]'} rounded-[20px] px-1`}>
              <TypingIndicator />
            </div>
          </div>
        )}

        {typingParticipant && <div className="h-16" aria-hidden="true" />}
      </div>

      <div data-chat-input className={`${bg} flex flex-shrink-0 items-center gap-3 px-3 pb-3 pt-2 ${accent}`}>
        <MessengerPlusIcon size={25} className="flex-shrink-0" />
        <MessengerCameraIcon size={26} className="flex-shrink-0" />
        <MessengerGalleryIcon size={25} className="flex-shrink-0" />
        <MessengerMicIcon size={25} className="flex-shrink-0" />
        <div className={`${inputBg} flex min-w-0 flex-1 items-center gap-2 rounded-full px-3 py-2`}>
          <span className={`${textSecondary} min-w-0 flex-1 truncate text-[16px] leading-none`}>Message</span>
          <MessengerSmileIcon size={23} className={`${accent} flex-shrink-0`} />
        </div>
        <MessengerLikeIcon size={29} className="flex-shrink-0" />
      </div>

      {project.deviceOS === 'android' && (
        <div className={`${isDark ? 'bg-black text-white' : 'bg-[#303030] text-white'} flex h-8 flex-shrink-0 items-center justify-around`}>
          <span className="text-[23px] leading-none">|||</span>
          <span className="h-[15px] w-[15px] rounded-full border-2 border-current" />
          <ChevronLeft size={24} strokeWidth={2.1} className="-rotate-180" />
        </div>
      )}
    </div>
  );
};
