import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Smile, EllipsisVertical, MessageSquarePlus, ImagePlus, CalendarPlus, Trash2 } from 'lucide-react';
import { ReactionBadge } from './ReactionBadge';
import type { TextMessage, ImageMessage, Participant, ChatProject } from '../../lib/parser/types';

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '👎', '🔥', '😍', '👏'];

interface Props {
  msg: TextMessage | ImageMessage;
  participant: Participant | undefined;
  project: ChatProject;
  mode: 'editor' | 'export' | 'video';
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  showSenderName?: boolean;
  onEdit?: (id: string, text: string) => void;
  onReaction?: (id: string, emoji: string) => void;
  onClearReaction?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAddText?: (afterId: string) => void;
  onAddImage?: (afterId: string, file: File) => void;
  onAddDate?: (afterId: string, label?: string) => void;
}

function getMenuOverlayStyle(anchor: DOMRect, alignRight: boolean): React.CSSProperties {
  const width = 172;
  const height = 176;
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

export const InstagramBubble: React.FC<Props> = ({
  msg, participant, project, mode,
  isFirstInGroup, isLastInGroup, showSenderName = false,
  onEdit, onReaction, onClearReaction, onDelete, onAddText, onAddImage, onAddDate,
}) => {
  const isSelf = participant?.isSelf ?? false;
  const isEditor = mode === 'editor';
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
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

  const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const text = e.currentTarget.textContent ?? '';
    if (text !== (msg.kind === 'text' ? msg.text : '')) onEdit?.(msg.id, text);
  }, [msg, onEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  }, []);

  const isDark = project.theme === 'dark';
  const reaction = (msg.kind === 'text' || msg.kind === 'image') ? msg.reaction : undefined;

  const bubbleBg = isSelf
    ? 'bg-gradient-to-b from-[#d800d8] via-[#ba21e8] to-[#8738f2]'
    : isDark ? 'bg-[#1f1f1f]' : 'bg-[#efefef]';

  const textColor = isSelf ? 'text-white' : isDark ? 'text-white' : 'text-black';
  const nameColor = isDark ? 'text-[#a8a8a8]' : 'text-[#737373]';

  const br = 'rounded-[22px]';
  const actionBtnBg = isDark
    ? 'bg-[#262626] hover:bg-[#323232] text-gray-300'
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
        ref={reactionButtonRef}
        onClick={() => {
          const next = !showReactionPicker;
          setShowReactionPicker(next);
          setReactionAnchor(next ? reactionButtonRef.current?.getBoundingClientRect() ?? null : null);
          setShowMenu(false);
          setMenuAnchor(null);
        }}
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
          setReactionAnchor(null);
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
      className={`group/message relative flex items-end gap-2 px-4 ${reaction ? 'pb-4' : 'pb-1.5'} ${showSenderName ? 'pt-1.5' : 'pt-0.5'} ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      {!isSelf && (
        <div className="w-7 h-7 flex-shrink-0">
          {isLastInGroup && participant && (
            <img src={participant.avatarUrl} alt={participant.name}
              className="w-7 h-7 rounded-full object-cover" />
          )}
        </div>
      )}

      <div ref={bubbleWrapRef} className={`relative group min-w-0 ${isSelf ? 'max-w-[78%]' : 'max-w-[76%]'}`}>
        {showActionStrip && actionAnchor && typeof document !== 'undefined' && createPortal(editorActionStrip, document.body)}

        {showSenderName && participant && (
          <div className={`${nameColor} mb-1 px-1 text-[10.5px] leading-[12.5px] font-semibold`}>
            {participant.name}
          </div>
        )}

        {/* Reaction picker */}
        {showReactionPicker && reactionAnchor && typeof document !== 'undefined' && createPortal(
          <div
            ref={reactionRef}
            style={getReactionOverlayStyle(reactionAnchor, isSelf)}
            className={`flex items-center justify-center gap-1 rounded-full border px-2 py-1.5 ${
            isDark
              ? 'bg-[#1c1c1c] border-[#2a2a2a] shadow-[0_4px_15px_rgba(0,0,0,0.4)]'
              : 'bg-white border-gray-150 shadow-[0_4px_15px_rgba(0,0,0,0.1)]'
          }`}
          >
            {QUICK_REACTIONS.map((e) => (
              <button
                key={e}
                onClick={() => {
                  onReaction?.(msg.id, e);
                  setShowReactionPicker(false);
                  setReactionAnchor(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[19px] hover:scale-125 transition-transform"
              >
                {e}
              </button>
            ))}
          </div>,
          document.body
        )}

        {/* More menu */}
        {showMenu && menuAnchor && typeof document !== 'undefined' && createPortal(
          <div
            ref={menuRef}
            style={getMenuOverlayStyle(menuAnchor, isSelf)}
            className={`rounded-xl py-1 border ${
            isDark
              ? 'bg-[#1c1c1c] border-[#2a2a2a] shadow-[0_4px_15px_rgba(0,0,0,0.4)] text-gray-200'
              : 'bg-white border-gray-150 shadow-[0_4px_15px_rgba(0,0,0,0.1)] text-gray-700'
          }`}>
            {[
              { icon: <MessageSquarePlus size={13} />, label: 'Add message below', action: () => onAddText?.(msg.id) },
              { icon: <ImagePlus size={13} />, label: 'Add image below', action: () => fileRef.current?.click() },
              { icon: <CalendarPlus size={13} />, label: 'Add date below', action: () => onAddDate?.(msg.id) },
              null,
              { icon: <Trash2 size={13} className="text-red-500" />, label: 'Delete', action: () => onDelete?.(msg.id), danger: true },
            ].map((item, i) =>
              item === null ? <div key={`d${i}`} className={`h-px my-1 ${isDark ? 'bg-gray-800' : 'bg-gray-100'}`} /> : (
                <button key={item.label} onClick={() => { item.action(); setShowMenu(false); setMenuAnchor(null); }}
                  className={`flex items-center gap-2 w-full px-3 py-1.5 text-xs ${
                    isDark ? 'hover:bg-gray-800 text-gray-200' : 'hover:bg-gray-50 text-gray-700'
                  } ${'danger' in item && item.danger ? 'text-red-500' : ''}`}>
                  {item.icon} {item.label}
                </button>
              )
            )}
          </div>,
          document.body
        )}

        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onAddImage?.(msg.id, f); e.target.value = ''; }} />

        {/* Bubble body */}
        <div className={`${bubbleBg} ${br} overflow-hidden`}>
          {msg.kind === 'image' && msg.objectUrl ? (
            <div className="relative max-w-[210px] overflow-hidden rounded-[6px]">
              <img src={msg.objectUrl} alt="" className="block w-full object-cover" />
            </div>
          ) : msg.kind === 'text' ? (
            <div
              contentEditable={isEditor}
              suppressContentEditableWarning
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              className={`px-[12px] py-[7px] text-[13.5px] leading-[17.5px] whitespace-pre-wrap break-words outline-none ${textColor} ${isEditor ? 'cursor-text' : 'select-none cursor-default'}`}
            >
              {msg.text}
            </div>
          ) : null}
        </div>

        {/* Reaction */}
        {reaction && (
          <ReactionBadge emoji={reaction.emoji}
            onRemove={isEditor ? () => onClearReaction?.(msg.id) : undefined}
            theme={project.theme}
            className={`absolute -bottom-3 ${isSelf ? 'right-3' : 'left-3'} z-20`} />
        )}
      </div>
    </div>
  );
};
