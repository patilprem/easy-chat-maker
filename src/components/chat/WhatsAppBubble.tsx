import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smile, EllipsisVertical, MessageSquarePlus, ImagePlus, CalendarPlus, Zap, Trash2, Check, CheckCheck, Phone, PhoneMissed, Mic } from 'lucide-react';
import { ReactionBadge } from './ReactionBadge';
import type { TextMessage, ImageMessage, Participant, ChatProject } from '../../lib/parser/types';

const SAFE_QUICK_REACTIONS = ['\u2764\uFE0F', '\uD83D\uDE02', '\uD83D\uDE2E', '\uD83D\uDE22', '\uD83D\uDC4D', '\uD83D\uDC4E', '\uD83D\uDD25', '\uD83D\uDE0D', '\uD83D\uDC4F'];
const GROUP_NAME_COLORS = ['#009f78', '#2f96c8', '#8460d6', '#d96a43', '#c88418', '#d84c78', '#209e72', '#5f70d6'];

function formatDateChip(date = new Date()): string {
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

function formatDayChip(date = new Date()): string {
  return date.toLocaleDateString('en-US', { weekday: 'long' });
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '👎', '🔥', '😍', '👏'];

function getGroupNameColor(participant?: Participant): string {
  const source = participant?.id || participant?.name || '';
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return GROUP_NAME_COLORS[hash % GROUP_NAME_COLORS.length];
}

interface Props {
  msg: TextMessage | ImageMessage;
  participant: Participant | undefined;
  project: ChatProject;
  mode: 'editor' | 'export' | 'video';
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onEdit?: (id: string, text: string) => void;
  onReaction?: (id: string, emoji: string) => void;
  onClearReaction?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddText?: (afterId: string, replyToId?: string) => void;
  onAddImage?: (afterId: string, file: File) => void;
  onAddDate?: (afterId: string, label?: string) => void;
  onAddSystem?: (afterId: string) => void;
  onAddCall?: (afterId: string, isVoice?: boolean, duration?: string, status?: 'missed' | 'completed' | 'declined') => void;
  onAddVoiceNote?: (afterId: string, duration?: string) => void;
  showGroupName?: boolean;
}

function getMenuOverlayStyle(anchor: DOMRect, alignRight: boolean): React.CSSProperties {
  const width = 184;
  const height = 324;
  const preferredLeft = alignRight ? anchor.right - width : anchor.left;
  const left = Math.max(8, Math.min(preferredLeft, window.innerWidth - width - 8));
  const preferredTop = anchor.bottom + 6;
  const top = preferredTop + height <= window.innerHeight - 8
    ? preferredTop
    : Math.max(8, anchor.top - height - 6);

  return { position: 'fixed', top, left, width, zIndex: 9999 };
}

function getActionOverlayStyle(anchor: DOMRect, isSelf: boolean): React.CSSProperties {
  const width = 62;
  const height = 28;
  const gap = 4;
  const preferredLeft = isSelf ? anchor.left - width - gap : anchor.right + gap;
  const left = Math.max(4, Math.min(preferredLeft, window.innerWidth - width - 4));
  const top = Math.max(4, Math.min(anchor.top + anchor.height / 2 - height / 2, window.innerHeight - height - 4));

  return { position: 'fixed', top, left, width, zIndex: 9998 };
}

export const WhatsAppBubble: React.FC<Props> = ({
  msg, participant, project, mode,
  isFirstInGroup, isLastInGroup,
  onEdit, onReaction, onClearReaction, onDelete,
  onAddText, onAddImage, onAddDate, onAddSystem, onAddCall, onAddVoiceNote, showGroupName = false,
}) => {
  const isSelf = participant?.isSelf ?? false;
  const isEditor = mode === 'editor';
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const [showActionStrip, setShowActionStrip] = useState(false);
  const [actionAnchor, setActionAnchor] = useState<DOMRect | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const bubbleWrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (!showMenu) return;

    const closeMenu = () => {
      setShowMenu(false);
      setMenuAnchor(null);
    };

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      closeMenu();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', closeMenu, true);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', closeMenu, true);
    };
  }, [showMenu]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent ?? '';
    if (text !== (msg.kind === 'text' ? msg.text : '')) onEdit?.(msg.id, text);
  }, [msg, onEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      (e.currentTarget as HTMLDivElement).blur();
    }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const plain = e.clipboardData.getData('text/plain');
    document.execCommand('insertText', false, plain);
  }, []);

  const isDark = project.theme === 'dark';

  const bubbleBg = isSelf
    ? isDark ? 'bg-[#005c4b]' : 'bg-[#d9fdd3]'
    : isDark ? 'bg-[#202c33]' : 'bg-white';

  const textColor = isDark ? 'text-[#e9edef]' : 'text-[#111b21]';
  const timeColor = isDark ? 'text-[#8696a0]' : 'text-[#667781]';

  // Tail shape: first message in group gets the tail at the top-left/top-right
  const tail = isFirstInGroup
    ? isSelf
      ? 'whatsapp-bubble-right rounded-[8px_0px_8px_8px]'
      : 'whatsapp-bubble-left rounded-[0px_8px_8px_8px]'
    : 'rounded-[8px]';

  const reaction = (msg.kind === 'text' || msg.kind === 'image') ? msg.reaction : undefined;
  const status = msg.kind === 'text' || msg.kind === 'image' ? 'read' : undefined;
  const showSenderName = !isSelf && showGroupName && isFirstInGroup && !!participant;
  const senderNameColor = getGroupNameColor(participant);
  const textTopPadding = showSenderName ? 'pt-[1px]' : 'pt-[6px]';
  const textRightPadding = 'pr-[9px]';
  const bubbleMinWidth = isSelf ? 'min-w-[92px]' : 'min-w-[82px]';
  const actionBtnBg = isDark
    ? 'bg-[#2a3942] hover:bg-[#374248] text-gray-300'
    : 'bg-white hover:bg-gray-100 text-gray-500 shadow-[0_2px_4px_rgba(0,0,0,0.08)] border border-gray-200';

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
        onClick={() => { setShowReactionPicker(!showReactionPicker); setShowMenu(false); }}
        className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${actionBtnBg}`}
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
        }}
        className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${actionBtnBg}`}
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
      className={`group/message relative flex items-start gap-1.5 px-3 pt-0.5 ${reaction ? 'pb-3' : 'pb-0.5'} ${
        isSelf ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Avatar — left side only, last in group */}
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

      {/* Bubble */}
      <div ref={bubbleWrapRef} className={`relative group min-w-0 ${msg.kind === 'image' ? 'max-w-[82%]' : 'max-w-[82%]'}`}>
        {/* Action strip — editor only */}
        {showActionStrip && actionAnchor && typeof document !== 'undefined' && createPortal(editorActionStrip, document.body)}

        {/* Reaction picker */}
        {showReactionPicker && (
          <div
            className={`absolute bottom-full mb-1 ${
              isSelf ? 'right-0' : 'left-0'
            } flex gap-1 rounded-full border px-2 py-1.5 z-50 ${
              isDark 
                ? 'bg-[#233138] border-[#2d373c] shadow-[0_4px_15px_rgba(0,0,0,0.4)]' 
                : 'bg-white border-gray-150 shadow-[0_4px_15px_rgba(0,0,0,0.1)]'
            }`}
          >
            {SAFE_QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                onClick={() => { onReaction?.(msg.id, e); setShowReactionPicker(false); }}
                className="text-lg hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* More menu */}
        {showMenu && menuAnchor && typeof document !== 'undefined' && createPortal(
          <div
            ref={menuRef}
            style={getMenuOverlayStyle(menuAnchor, isSelf)}
            className={`rounded-xl py-1 border ${
              isDark 
                ? 'bg-[#233138] border-[#2d373c] shadow-[0_4px_15px_rgba(0,0,0,0.4)] text-gray-200' 
                : 'bg-white border-gray-150 shadow-[0_4px_15px_rgba(0,0,0,0.1)] text-gray-700'
            }`}
          >
            {[
              { icon: <MessageSquarePlus size={14} />, label: 'Add message below', action: () => onAddText?.(msg.id) },
              { icon: <MessageSquarePlus size={14} className="text-[#60EFFF]" />, label: 'Reply to this', action: () => {
                if (onAddText) {
                  (onAddText as any)(msg.id, msg.id);
                }
              }},
              { icon: <ImagePlus size={14} />, label: 'Add image below', action: () => fileRef.current?.click() },
              { icon: <CalendarPlus size={14} />, label: 'Add date below', action: () => onAddDate?.(msg.id, formatDateChip()) },
              { icon: <CalendarPlus size={14} className="text-[#60EFFF]" />, label: 'Add day below', action: () => onAddDate?.(msg.id, formatDayChip()) },
              { icon: <Mic size={14} className="text-[#00a884]" />, label: 'Add voice note below', action: () => onAddVoiceNote?.(msg.id, '0:07') },
              { icon: <Phone size={14} className="text-green-500" />, label: 'Add voice call below', action: () => onAddCall?.(msg.id, true, '1 min', 'completed') },
              { icon: <PhoneMissed size={14} className="text-red-500" />, label: 'Add missed call below', action: () => onAddCall?.(msg.id, true, undefined, 'missed') },
              ...(project.isGroup ? [{ icon: <Zap size={14} />, label: 'Add event below', action: () => onAddSystem?.(msg.id) }] : []),
              null,
              { icon: <Trash2 size={14} className="text-red-500" />, label: 'Delete', action: () => onDelete?.(msg.id), danger: true },
            ].map((item, i) =>
              item === null ? (
                <div key={`div-${i}`} className={`h-px my-1 ${isDark ? 'bg-gray-700' : 'bg-gray-100'}`} />
              ) : (
                <button
                  key={item.label}
                  onClick={() => { item.action(); setShowMenu(false); setMenuAnchor(null); }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${
                    isDark ? 'hover:bg-[#2e3b43]' : 'hover:bg-gray-50'
                  } ${
                    'danger' in item && item.danger ? 'text-red-500' : isDark ? 'text-gray-200' : 'text-gray-700'
                  }`}
                >
                  {item.icon} {item.label}
                </button>
              )
            )}
          </div>,
          document.body
        )}

        {/* Hidden file input for image */}
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

        {/* Bubble body */}
        <div className={`relative max-w-full ${bubbleBg} ${tail} shadow-sm flex flex-col overflow-visible ${msg.kind === 'image' ? 'p-[3px]' : bubbleMinWidth}`}>
          {/* Group sender name */}
          {showSenderName && (
            <div className="px-[9px] pt-[6px] text-[11.5px] leading-[15px] font-semibold" style={{ color: senderNameColor }}>
              {participant.name}
            </div>
          )}

          {/* Quoted Message Quote Box */}
          {(msg as any).replyToId && (() => {
            const repliedId = (msg as any).replyToId;
            const rMsg = project.messages.find((m) => m.id === repliedId);
            if (!rMsg) return null;
            const rSender = project.participants.find((p) => p.id === (rMsg as any).participantId);
            const rSenderName = rSender ? (rSender.isSelf ? 'You' : rSender.name) : 'System';
            const rText = rMsg.kind === 'text' ? rMsg.text : rMsg.kind === 'image' ? '📷 Photo' : 'Call';
            
            const quoteBg = isSelf
              ? isDark ? 'bg-[#0b3f35]' : 'bg-[#cff4c9]'
              : isDark ? 'bg-[#111b21]' : 'bg-[#f5f6f6]';
            const quoteText = isDark ? 'text-[#c7d0d5]' : 'text-[#52646d]';

            return (
              <div className={`mx-[5px] mt-[5px] mb-[1px] flex max-h-[64px] flex-col overflow-hidden rounded-[6px] border-l-[4px] border-[#06cf9c] px-[7px] py-[5px] pr-3 text-[11.5px] leading-[15px] select-none ${quoteBg}`}>
                <span className="mb-[1px] text-[11px] font-bold leading-[14px] text-[#008f72]">{rSenderName}</span>
                <span className={`${quoteText} truncate`}>{rText}</span>
              </div>
            );
          })()}

          {/* Content */}
          {msg.kind === 'image' && msg.objectUrl ? (
            <div className="relative w-[250px] max-w-full aspect-[4/5] rounded-[7px] overflow-hidden bg-black/5 dark:bg-white/10">
              <img
                src={msg.objectUrl}
                alt=""
                className="block w-full h-full object-cover"
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 via-black/20 to-transparent z-10" />
              <div className="absolute bottom-1.5 right-1.5 flex items-center gap-0.5 text-white/95 text-[10px] select-none z-20 drop-shadow-sm">
                <span>{msg.time}</span>
                {isSelf && (
                  status === 'read'
                    ? <CheckCheck size={12} className="text-[#53bdeb]" />
                    : <Check size={12} className="text-white/85" />
                )}
              </div>
            </div>
          ) : msg.kind === 'text' ? (
            isEditor ? (
              <div
                contentEditable
                suppressContentEditableWarning
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                className={`max-w-full pl-[9px] ${textRightPadding} ${textTopPadding} pb-[18px] text-[13.5px] leading-[18px] whitespace-pre-wrap break-words outline-none ${
                  textColor
                } cursor-text`}
                style={{ minWidth: 40, overflowWrap: 'anywhere' }}
              >
                {msg.text}
              </div>
            ) : (
              <div
                className={`max-w-full pl-[9px] ${textRightPadding} ${textTopPadding} pb-[18px] text-[13.5px] leading-[18px] whitespace-pre-wrap break-words select-none cursor-default ${
                  textColor
                }`}
                style={{ minWidth: 40, overflowWrap: 'anywhere' }}
              >
                {(() => {
                  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g;
                  const phoneRegex = /(\+?\d[\d-\s]{8,}\d)/g;
                  const parts = msg.text.split(/(\s+)/);
                  const content = parts.map((part, idx) => {
                    if (part.match(urlRegex)) {
                      return (
                        <a key={idx} href={part.startsWith('www') ? `https://${part}` : part} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                          {part}
                        </a>
                      );
                    }
                    if (part.match(phoneRegex) && part.replace(/[^\d]/g, '').length >= 9) {
                      return (
                        <a key={idx} href={`tel:${part}`} className="text-blue-500 hover:underline">
                          {part}
                        </a>
                      );
                    }
                    return part;
                  });
                  return (
                    <>
                      {content}
                    </>
                  );
                })()}
              </div>
            )
          ) : null}

          {msg.kind !== 'image' && (
            <div className={`absolute bottom-[4px] right-[9px] flex items-center justify-end gap-0.5 whitespace-nowrap ${timeColor}`}>
              <span className="text-[10.5px] leading-none">{msg.time}</span>
              {isSelf && (
                status === 'read'
                  ? <CheckCheck size={14} className="text-[#53bdeb]" />
                  : <Check size={14} />
              )}
            </div>
          )}
        </div>

        {/* Reaction badge */}
        {reaction && (
          <ReactionBadge
            emoji={reaction.emoji}
            onRemove={isEditor ? () => onClearReaction?.(msg.id) : undefined}
            theme={project.theme}
            className={`absolute -bottom-2.5 ${isSelf ? 'right-2.5' : 'left-2.5'} z-20`}
          />
        )}
      </div>

    </div>
  );
};
