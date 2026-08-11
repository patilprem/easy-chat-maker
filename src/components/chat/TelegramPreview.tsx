import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarPlus, CheckCheck, ChevronLeft, EllipsisVertical, ImagePlus, MessageSquarePlus, Mic, Paperclip, Smile, Trash2 } from 'lucide-react';
import { DeviceStatusBar } from './DeviceStatusBar';
import { EditableTime } from './EditableTime';
import { TypingIndicator } from './TypingIndicator';
import type { ChatProject, ImageMessage, Message, Participant, TextMessage } from '../../lib/parser/types';
import { TELEGRAM_DOODLE_IMG } from '../../lib/doodlePattern';
import { ChatBackgroundLayer } from './ChatBackgroundLayer';
import { hasCustomBackground, showDoodle } from '../../lib/backgrounds';

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

function isTelegramMessage(msg: Message | undefined): msg is TextMessage | ImageMessage {
  return !!msg && (msg.kind === 'text' || msg.kind === 'image');
}

function formatTelegramDateChip(date = new Date()): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

function getMenuOverlayStyle(anchor: DOMRect, isSelf: boolean): React.CSSProperties {
  const width = 178;
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
  '\uD83D\uDC4D',
  '\u2764\uFE0F',
  '\uD83D\uDE02',
  '\uD83D\uDE2E',
  '\uD83D\uDE22',
  '\uD83D\uDD25',
  '\uD83D\uDE0D',
  '\uD83D\uDC4F',
];

const TELEGRAM_NAME_COLORS = ['#de9147', '#39a8a8', '#78b95f', '#ba75d6', '#4f9bd8', '#d96d8a'];

function telegramNameColor(participant?: Participant): string {
  const source = participant?.id || participant?.name || '';
  const hash = Array.from(source).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return TELEGRAM_NAME_COLORS[hash % TELEGRAM_NAME_COLORS.length];
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Telegram's purple gradient for outgoing ("your character") bubbles. */
const SELF_GRADIENT = 'linear-gradient(135deg, #7B4FD8 0%, #9450DF 52%, #A94FE8 100%)';
/** The bubble tail sits at the gradient's right edge, so it matches that stop. */
const SELF_GRADIENT_EDGE = '#A94FE8';

/** Chat wallpaper: a yellow-green to teal gradient on light, flat navy on dark. */
const WALLPAPER_LIGHT = 'linear-gradient(170deg, #C4C95B 0%, #BFC65F 20%, #A8BC6B 48%, #88B285 74%, #78AE95 100%)';
const WALLPAPER_DARK = '#18222C';

const TelegramBubble: React.FC<{
  msg: TextMessage | ImageMessage;
  participant?: Participant;
  project: ChatProject;
  isEditor: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onEdit?: (id: string, text: string) => void;
  onEditTime?: (id: string, time: string) => void;
  onReaction?: (id: string, emoji: string) => void;
  onClearReaction?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddText?: (afterId: string, replyToId?: string) => void;
  onAddImage?: (afterId: string, file: File) => void;
  onAddDate?: (afterId: string, label?: string) => void;
}> = ({
  msg, participant, project, isEditor, isFirstInGroup, isLastInGroup,
  onEdit, onEditTime, onReaction, onClearReaction, onDelete, onAddText, onAddImage, onAddDate,
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
  const actionHideTimerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const bubbleFill = isDark ? '#243244' : '#ffffff';
  // Outgoing bubbles use Telegram's purple gradient in both themes, so the
  // text on them is always white.
  const textPrimary = isSelf || isDark ? 'text-white' : 'text-[#111111]';
  const timeColor = isSelf
    ? 'text-white/85'
    : isDark ? 'text-[#aebbca]' : 'text-[#7d848b]';
  const senderColor = telegramNameColor(participant);
  const radius = isSelf
    ? 'rounded-[13px_13px_4px_13px]'
    : 'rounded-[13px_13px_13px_4px]';

  const updateActionAnchor = useCallback(() => {
    setActionAnchor(bubbleWrapRef.current?.getBoundingClientRect() ?? null);
  }, []);

  const clearActionHideTimer = useCallback(() => {
    if (actionHideTimerRef.current !== null) {
      window.clearTimeout(actionHideTimerRef.current);
      actionHideTimerRef.current = null;
    }
  }, []);

  const scheduleActionHide = useCallback(() => {
    clearActionHideTimer();
    actionHideTimerRef.current = window.setTimeout(() => {
      if (!showMenu && !showReactionPicker) setShowActionStrip(false);
      actionHideTimerRef.current = null;
    }, 120);
  }, [clearActionHideTimer, showMenu, showReactionPicker]);

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

  useEffect(() => () => clearActionHideTimer(), [clearActionHideTimer]);

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

  const replied = (msg as any).replyToId
    ? project.messages.find((m) => m.id === (msg as any).replyToId)
    : null;
  const repliedParticipant = replied && isTelegramMessage(replied)
    ? project.participants.find((p) => p.id === replied.participantId)
    : undefined;
  const repliedColor = repliedParticipant ? telegramNameColor(repliedParticipant) : senderColor;
  const repliedText = replied?.kind === 'text' ? replied.text : replied?.kind === 'image' ? 'Photo' : '';

  return (
    <div
      className={`group/message flex items-end gap-2 px-3 ${isFirstInGroup ? 'pt-2.5' : 'pt-1'} pb-0.5 ${isSelf ? 'justify-end' : 'justify-start'}`}
      onMouseEnter={() => {
        clearActionHideTimer();
        setShowActionStrip(true);
        updateActionAnchor();
      }}
      onMouseLeave={scheduleActionHide}
    >
      {/* Telegram only shows sender avatars in groups — a 1:1 chat has no
          avatar column at all, so incoming bubbles sit against the edge. */}
      {!isSelf && project.isGroup && (
        <div className="w-8 flex-shrink-0">
          {isLastInGroup && participant ? (
            <img src={participant.avatarUrl} alt={participant.name} className="h-8 w-8 rounded-full object-cover" />
          ) : null}
        </div>
      )}

      <div ref={bubbleWrapRef} className={`relative flex max-w-[78%] flex-col ${isSelf ? 'items-end' : 'items-start'}`}>
        <div
          className={`relative min-w-[76px] max-w-full ${radius} px-3 py-2 shadow-sm`}
          style={isSelf ? { backgroundImage: SELF_GRADIENT } : { backgroundColor: bubbleFill }}
        >
          {isLastInGroup && (
            <span
              className={`absolute bottom-0 h-3 w-3 ${isSelf ? '-right-[6px]' : '-left-[6px]'}`}
              style={{
                backgroundColor: isSelf ? SELF_GRADIENT_EDGE : bubbleFill,
                clipPath: isSelf
                  ? 'polygon(0 0, 0 100%, 100% 100%)'
                  : 'polygon(100% 0, 0 100%, 100% 100%)',
              }}
            />
          )}

          {project.isGroup && !isSelf && isFirstInGroup && participant && (
            <div className="mb-0.5 text-[12px] font-bold leading-[15px]" style={{ color: senderColor }}>
              {participant.name}
            </div>
          )}

          {replied && (
            <div
              className="mb-1.5 rounded-[5px] border-l-[4px] px-2 py-1"
              style={{
                borderLeftColor: repliedColor,
                backgroundColor: hexToRgba(repliedColor, isDark ? 0.24 : 0.13),
              }}
            >
              <div className="truncate text-[11.5px] font-bold leading-[14px]" style={{ color: repliedColor }}>
                {repliedParticipant?.name ?? 'Message'}
              </div>
              <div className={`${textPrimary} truncate text-[11.5px] leading-[15px] opacity-95`}>
                {repliedText}
              </div>
            </div>
          )}

          {msg.kind === 'image' && msg.objectUrl ? (
            <img src={msg.objectUrl} alt="" className="block max-h-[280px] max-w-[220px] rounded-[14px] object-cover" />
          ) : (
            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={(e) => onEdit?.(msg.id, e.currentTarget.textContent ?? '')}
              onPaste={(e) => {
                e.preventDefault();
                document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
              }}
              className={`telegram-message-text ${textPrimary} text-[14px] leading-[18.5px] outline-none ${isEditor ? 'cursor-text' : 'select-none'}`}
              style={{ overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', '--telegram-time-space': isSelf ? '70px' : '56px' } as React.CSSProperties}
            >
              {msg.kind === 'text' ? msg.text : ''}
            </div>
          )}

          <div className={`absolute bottom-1.5 right-3 flex items-center gap-0.5 ${timeColor}`}>
            <EditableTime
              value={msg.time}
              editable={isEditor}
              onEdit={(t) => onEditTime?.(msg.id, t)}
              className="text-[11.5px] font-medium leading-none"
            />
            {isSelf && <CheckCheck size={14} strokeWidth={2.1} />}
          </div>
        </div>

        {msg.reaction && (
          <button
            onClick={() => isEditor && onClearReaction?.(msg.id)}
            className={`reaction-badge mt-1 flex h-6 w-fit items-center gap-1 rounded-full px-2 text-[13px] shadow-sm transition-transform ${
              isDark ? 'bg-[#1b2838]' : 'bg-[#eaf4f8]'
            } ${isEditor ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
            title={isEditor ? 'Remove reaction' : undefined}
          >
            <span>{msg.reaction.emoji}</span>
            {project.isGroup && participant?.avatarUrl && (
              <img src={participant.avatarUrl} alt="" className="h-4 w-4 rounded-full object-cover" />
            )}
          </button>
        )}

        {isEditor && (
          <>
            {showActionStrip && actionAnchor && typeof document !== 'undefined' && createPortal(
              <div
                style={getActionOverlayStyle(actionAnchor, isSelf)}
                onMouseEnter={() => {
                  clearActionHideTimer();
                  setShowActionStrip(true);
                  updateActionAnchor();
                }}
                onMouseLeave={scheduleActionHide}
                className={`flex h-7 items-center gap-1 ${isSelf ? 'justify-end' : 'justify-start'}`}
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
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    isDark ? 'bg-[#26384a] text-white hover:bg-[#30465d]' : 'bg-white text-[#64748b] shadow-sm hover:bg-[#f1f5f9]'
                  }`}
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
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    isDark ? 'bg-[#26384a] text-white hover:bg-[#30465d]' : 'bg-white text-[#64748b] shadow-sm hover:bg-[#f1f5f9]'
                  }`}
                  title="Message options"
                >
                  <EllipsisVertical size={15} />
                </button>
              </div>,
              document.body
            )}

            {showReactionPicker && reactionAnchor && typeof document !== 'undefined' && createPortal(
              <div
                ref={reactionRef}
                style={getReactionOverlayStyle(reactionAnchor, isSelf)}
                className={`flex items-center justify-center gap-1 rounded-full border px-2 py-1.5 shadow-[0_8px_28px_rgba(0,0,0,0.24)] ${
                  isDark ? 'border-white/10 bg-[#213142]' : 'border-black/10 bg-white'
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
                className={`rounded-xl border py-1 shadow-[0_8px_28px_rgba(0,0,0,0.24)] ${
                  isDark ? 'border-white/10 bg-[#213142] text-white' : 'border-black/10 bg-white text-[#111111]'
                }`}
              >
                {[
                  { icon: <MessageSquarePlus size={14} />, label: 'Add message below', action: () => onAddText?.(msg.id) },
                  { icon: <MessageSquarePlus size={14} className="text-[#35a8e8]" />, label: 'Reply to this', action: () => onAddText?.(msg.id, msg.id) },
                  { icon: <ImagePlus size={14} />, label: 'Add image below', action: () => fileRef.current?.click() },
                  { icon: <CalendarPlus size={14} />, label: 'Add date below', action: () => onAddDate?.(msg.id, formatTelegramDateChip()) },
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
    </div>
  );
};

export const TelegramPreview: React.FC<Props> = ({
  project, mode, visibleCount, typingParticipantId, activeReactionIds = [],
  onUpdateMessage, onSetReaction, onClearReaction, onDeleteMessage, onAddText, onAddImage, onAddDate,
  onUpdateTitle, onUpdateSubtitle, onAvatarClick, onGroupAvatarClick, feedRef,
}) => {
  const isEditor = mode === 'editor';
  const isDark = project.theme === 'dark';
  const allVisible = visibleCount === undefined;
  const displayMessages = allVisible ? project.messages : project.messages.slice(0, visibleCount);
  const hasBackground = hasCustomBackground(project);
  const doodleOn = showDoodle(project);

  const getParticipant = useCallback(
    (id: string): Participant | undefined => project.participants.find((p) => p.id === id),
    [project.participants]
  );

  const typingParticipant = typingParticipantId ? getParticipant(typingParticipantId) : null;
  const otherParticipant = project.participants.find((p) => !p.isSelf);
  const headerAvatarSrc = project.isGroup
    ? ((project as any)._groupAvatarUrl ?? otherParticipant?.avatarUrl ?? project.participants[0]?.avatarUrl ?? '')
    : otherParticipant?.avatarUrl ?? project.participants[0]?.avatarUrl ?? '';

  const headerPillBg = isDark ? 'bg-[#243244]' : 'bg-white/80 backdrop-blur-md';
  const circleBg = isDark ? 'bg-[#243244]' : 'bg-white/80 backdrop-blur-md';
  const textPrimary = isDark ? 'text-white' : 'text-[#111111]';
  const textMuted = isDark ? 'text-[#a5b2bf]' : 'text-[#6b7280]';
  const inputBg = isDark ? 'bg-[#243244]' : 'bg-white/80 backdrop-blur-md';
  const inputIcon = isDark ? 'text-[#91a4b7]' : 'text-[#697782]';

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
    <div
      className="relative flex h-full min-h-0 w-full flex-col overflow-hidden"
      style={
        hasBackground
          ? undefined
          : isDark
            ? { backgroundColor: WALLPAPER_DARK }
            : { backgroundImage: WALLPAPER_LIGHT }
      }
    >
      {/* Telegram paints the wallpaper edge to edge, with the header pill and
          composer floating over it — so the layer covers the whole screen and
          the chrome is lifted above it. */}
      <ChatBackgroundLayer project={project} />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
      <DeviceStatusBar os={project.deviceOS} theme={project.theme} surface="telegram" />

      <div className="relative z-20 flex flex-shrink-0 items-center gap-2 px-3 pb-0.5 pt-0.5">
        <button className={`${circleBg} ${textPrimary} flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-white/20`}>
          <ChevronLeft size={25} strokeWidth={2.4} />
        </button>
        <div className={`${headerPillBg} flex min-w-0 flex-1 items-center gap-2 rounded-[22px] px-2 py-1 shadow-sm ring-1 ring-white/20`}>
          <button
            onClick={project.isGroup ? onGroupAvatarClick : () => onAvatarClick?.(otherParticipant?.id ?? '')}
            className={`flex-shrink-0 ${isEditor ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
          >
            <img src={headerAvatarSrc} alt="" className="h-9 w-9 rounded-full object-cover" />
          </button>
          <div className="min-w-0 flex-1">
            <div
              {...editableProps((v) => onUpdateTitle?.(v))}
              className={`${textPrimary} truncate text-[14.5px] font-bold leading-[17px] outline-none`}
            >
              {project.title}
            </div>
            <div
              {...editableProps((v) => onUpdateSubtitle?.(v))}
              className={`${textMuted} truncate text-[11.5px] leading-[14px] outline-none`}
            >
              {project.subtitle ?? (project.isGroup ? `${project.participants.length} members, 2 online` : 'last seen recently')}
            </div>
          </div>
        </div>
        <button className={`${circleBg} ${textPrimary} flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-white/20`}>
          <EllipsisVertical size={22} strokeWidth={2.5} />
        </button>
      </div>

      <div
        ref={feedRef}
        className="phone-chat-scroll relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden"
        style={{ scrollBehavior: 'smooth' }}
      >
        {/* Inner wrapper grows to the full scroll height so the wallpaper covers
            the whole conversation and keeps tiling as you scroll, rather than
            sitting still behind it. The padding lives here (not on the feed) so
            the pattern reaches the feed's top and bottom edges. */}
        <div className="relative min-h-full pb-3">
        {/* Doodle pattern — telegram-bg.png is white line art on transparency,
            so it reads straight over the dark navy and gets inverted to dark
            strokes over the light gradient. */}
        {doodleOn && (
        <div
          data-chat-wallpaper
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: `url('${TELEGRAM_DOODLE_IMG}')`,
            backgroundRepeat: 'repeat',
            // One tile exactly spans the width, so the pattern never shows a
            // vertical seam — whatever width the phone or the export renders at.
            backgroundSize: '100% auto',
            opacity: isDark ? 0.06 : 0.1,
            filter: isDark ? undefined : 'invert(1)',
          }}
        />
        )}

        <div className="relative z-10">
        {displayMessages.map((msg, idx) => {
          if (msg.kind === 'date') {
            return (
              <div key={msg.id} className="flex justify-center py-2">
                <span
                  contentEditable={isEditor}
                  suppressContentEditableWarning
                  onBlur={(e) => onUpdateMessage?.(msg.id, { label: e.currentTarget.textContent ?? '' } as Partial<Message>)}
                  className={`rounded-full px-3 py-1 text-[12px] font-bold leading-none outline-none ${
                    isDark ? 'bg-[#35516a] text-white' : 'bg-[#6aaa58] text-white'
                  } ${isEditor ? 'cursor-text' : 'select-none'}`}
                >
                  {msg.label}
                </span>
              </div>
            );
          }

          if (msg.kind === 'system') {
            return null;
          }

          if (!isTelegramMessage(msg)) return null;

          const participant = getParticipant(msg.participantId);
          const prev = displayMessages[idx - 1];
          const next = displayMessages[idx + 1];
          const prevMessage = isTelegramMessage(prev) ? prev : null;
          const nextMessage = isTelegramMessage(next) ? next : null;
          const isFirstInGroup = !prevMessage || prevMessage.participantId !== msg.participantId;
          const isLastInGroup = !nextMessage || nextMessage.participantId !== msg.participantId;
          const showReaction = mode !== 'video' || activeReactionIds.includes(msg.id);
          const effectiveMsg = showReaction ? msg : { ...msg, reaction: undefined } as typeof msg;

          return (
            <TelegramBubble
              key={msg.id}
              msg={effectiveMsg}
              participant={participant}
              project={project}
              isEditor={isEditor}
              isFirstInGroup={isFirstInGroup}
              isLastInGroup={isLastInGroup}
              onEdit={(id, text) => onUpdateMessage?.(id, { text } as Partial<Message>)}
              onEditTime={(id, time) => onUpdateMessage?.(id, { time: time || undefined } as Partial<Message>)}
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
          <div data-typing-row className="flex items-end gap-2 px-3 pt-2">
            {project.isGroup && (
              <img src={typingParticipant.avatarUrl} alt={typingParticipant.name} className="h-8 w-8 rounded-full object-cover" />
            )}
            <div className={`${isDark ? 'bg-[#243244]' : 'bg-white'} rounded-[18px] px-1 shadow-sm`}>
              <TypingIndicator />
            </div>
          </div>
        )}

        {/* Breathing room under the typing bubble. Video pins the feed to its
            exact bottom every frame, so without this the dots sit flush against
            the input bar — the editor only hides it because its smooth scroll
            lags behind the true bottom. */}
        {typingParticipant && <div className="h-16" data-typing-tail aria-hidden="true" />}
        </div>
        </div>
      </div>

      <div data-chat-input className="relative z-20 flex-shrink-0 px-3 pb-2 pt-0.5">
        <div className={`${inputBg} flex items-center gap-2 rounded-full px-3 py-1.5 shadow-sm ring-1 ring-white/20`}>
          <Smile size={20} strokeWidth={2.1} className={`${inputIcon} flex-shrink-0`} />
          <span className={`${inputIcon} min-w-0 flex-1 truncate text-[14px] leading-none`}>Message</span>
          <Paperclip size={21} strokeWidth={2.1} className={`${inputIcon} flex-shrink-0`} />
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#35a8e8] text-white">
            <Mic size={22} strokeWidth={2.2} />
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
