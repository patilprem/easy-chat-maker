import { nanoid } from 'nanoid';
import type { Participant, Message, ParsedChatResult, TextMessage } from './types';

function generateInitialsAvatar(name: string, isSelf: boolean): string {
  const initials = name
    .split(' ')
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);

  const colors = isSelf
    ? ['#075E54', '#128C7E']
    : ['#1a1a2e', '#16213e', '#0f3460', '#533483', '#2b2d42', '#6b4226', '#1b4332'];
  const bg = colors[Math.abs(name.charCodeAt(0) + (name.charCodeAt(1) ?? 0)) % colors.length];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
    <circle cx="20" cy="20" r="20" fill="${bg}"/>
    <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
      font-family="system-ui,sans-serif" font-size="15" font-weight="600" fill="white">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function formatTime(index: number): string {
  const base = new Date();
  base.setHours(9, 0, 0, 0);
  base.setMinutes(base.getMinutes() + index * 3);
  return base.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?(AM|PM)/i, (m) => m.toLowerCase());
}

export function parseChatScript(input: string, selfSpeakerName?: string): ParsedChatResult {
  const lines = input.split('\n').map((l) => l.trim()).filter(Boolean);
  const warnings: string[] = [];
  const participantMap = new Map<string, Participant>();
  const messages: Message[] = [];
  let firstSpeaker: string | null = null;
  const selectedSelf = selfSpeakerName?.trim();

  lines.forEach((line, idx) => {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) {
      warnings.push(`Line ${idx + 1}: no speaker found, skipped.`);
      return;
    }

    const speaker = line.slice(0, colonIdx).trim();
    const text = line.slice(colonIdx + 1).trim();
    const command = speaker.toLowerCase();

    if (!speaker || !text) {
      warnings.push(`Line ${idx + 1}: empty speaker or message, skipped.`);
      return;
    }

    if (command === 'system') {
      messages.push({ id: nanoid(), kind: 'system', text });
      return;
    }

    if (command === 'date' || command === 'day') {
      messages.push({ id: nanoid(), kind: 'date', label: text });
      return;
    }

    if (command === 'reaction' || command === 'react') {
      const target = [...messages].reverse().find((m) => m.kind === 'text' || m.kind === 'image');
      if (!target || (target.kind !== 'text' && target.kind !== 'image')) {
        warnings.push(`Line ${idx + 1}: no message found for reaction, skipped.`);
        return;
      }
      target.reaction = { emoji: text };
      return;
    }

    if (!participantMap.has(speaker)) {
      if (firstSpeaker === null) firstSpeaker = speaker;
      const isSelf = selectedSelf ? speaker === selectedSelf : speaker === firstSpeaker;
      const p: Participant = {
        id: nanoid(),
        name: speaker,
        isSelf,
        avatarUrl: generateInitialsAvatar(speaker, isSelf),
      };
      participantMap.set(speaker, p);
    }

    const participant = participantMap.get(speaker)!;
    const msg: TextMessage = {
      id: nanoid(),
      kind: 'text',
      participantId: participant.id,
      text,
      time: formatTime(messages.filter((m) => m.kind === 'text' || m.kind === 'image').length),
    };
    messages.push(msg);
  });

  return {
    participants: Array.from(participantMap.values()),
    messages,
    warnings,
  };
}

export { generateInitialsAvatar };
