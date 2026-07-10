import React from 'react';
import { WhatsAppPreview } from './WhatsAppPreview';
import { InstagramPreview } from './InstagramPreview';
import { MessengerPreview } from './MessengerPreview';
import { SlackPreview } from './SlackPreview';
import { TelegramPreview } from './TelegramPreview';
import { DiscordPreview } from './DiscordPreview';
import { ChatGPTPreview } from './ChatGPTPreview';
import { ClaudePreview } from './ClaudePreview';
import { GeminiPreview } from './GeminiPreview';
import type { ChatProject, Message } from '../../lib/parser/types';

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
  onAvatarClick?: (participantId: string) => void;
  onGroupAvatarClick?: () => void;
  feedRef?: React.RefObject<HTMLDivElement | null>;
  id?: string;
  style?: React.CSSProperties;
}

export const ChatPreview: React.FC<Props> = ({ project, mode, id, feedRef, style, ...rest }) => {
  const wrapperId = id ?? (mode === 'editor' ? 'phone-screen' : 'phone-screen-export');

  return (
    <div
      id={wrapperId}
      className="w-full h-full min-h-0 overflow-hidden"
      style={{ fontFamily: "'Inter', sans-serif", ...style }}
    >
      {project.platform === 'whatsapp' ? (
        <WhatsAppPreview project={project} mode={mode} feedRef={feedRef} {...rest} />
      ) : project.platform === 'instagram' ? (
        <InstagramPreview project={project} mode={mode} feedRef={feedRef} {...rest} />
      ) : project.platform === 'slack' ? (
        <SlackPreview project={project} mode={mode} feedRef={feedRef} {...rest} />
      ) : project.platform === 'telegram' ? (
        <TelegramPreview project={project} mode={mode} feedRef={feedRef} {...rest} />
      ) : project.platform === 'discord' ? (
        <DiscordPreview project={project} mode={mode} feedRef={feedRef} {...rest} />
      ) : project.platform === 'chatgpt' ? (
        <ChatGPTPreview project={project} mode={mode} feedRef={feedRef} {...rest} />
      ) : project.platform === 'claude' ? (
        <ClaudePreview project={project} mode={mode} feedRef={feedRef} {...rest} />
      ) : project.platform === 'gemini' ? (
        <GeminiPreview project={project} mode={mode} feedRef={feedRef} {...rest} />
      ) : (
        <MessengerPreview project={project} mode={mode} feedRef={feedRef} {...rest} />
      )}
    </div>
  );
};
