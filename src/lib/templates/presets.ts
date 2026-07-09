import { nanoid } from 'nanoid';
import { generateInitialsAvatar } from '../parser/parseChatScript';
import type { ChatProject } from '../parser/types';

export const PRESETS: Record<string, ChatProject> = {
  private: {
    id: nanoid(),
    platform: 'whatsapp',
    theme: 'light',
    deviceOS: 'ios',
    title: 'Priya \u2615',
    subtitle: 'online',
    isGroup: false,
    exportConsentAccepted: false,
    participants: [
      {
        id: 'p1',
        name: 'You',
        isSelf: true,
        avatarUrl: generateInitialsAvatar('You', true),
      },
      {
        id: 'p2',
        name: 'Priya',
        isSelf: false,
        avatarUrl: generateInitialsAvatar('Priya', false),
      },
    ],
    messages: [
      { id: nanoid(), kind: 'date', label: 'Today' },
      { id: nanoid(), kind: 'text', participantId: 'p2', text: 'Hey! You up?', time: '9:41 am' },
      { id: nanoid(), kind: 'text', participantId: 'p1', text: 'Yeah just woke up \uD83D\uDE34', time: '9:42 am' },
      { id: nanoid(), kind: 'text', participantId: 'p2', text: 'Coffee or no coffee today?', time: '9:42 am' },
      { id: nanoid(), kind: 'text', participantId: 'p1', text: 'Always coffee. Why even ask \uD83D\uDE02', time: '9:43 am', reaction: { emoji: '\uD83D\uDE02' } },
      { id: nanoid(), kind: 'text', participantId: 'p2', text: 'Haha fair. Want to grab some? 10:30?', time: '9:43 am' },
      { id: nanoid(), kind: 'text', participantId: 'p1', text: 'Yes! That little place near the park?', time: '9:44 am' },
      { id: nanoid(), kind: 'text', participantId: 'p2', text: 'Obviously. See you there \u2615', time: '9:44 am', reaction: { emoji: '\u2764\uFE0F' } },
      { id: nanoid(), kind: 'text', participantId: 'p1', text: '\uD83D\uDE4C', time: '9:45 am' },
    ],
  },

  group: {
    id: nanoid(),
    platform: 'whatsapp',
    theme: 'dark',
    deviceOS: 'ios',
    title: 'Squad Goals \uD83C\uDFD6\uFE0F',
    subtitle: '4 members',
    isGroup: true,
    exportConsentAccepted: false,
    participants: [
      {
        id: 'g1',
        name: 'You',
        isSelf: true,
        avatarUrl: generateInitialsAvatar('You', true),
      },
      {
        id: 'g2',
        name: 'Ananya',
        isSelf: false,
        avatarUrl: generateInitialsAvatar('Ananya', false),
      },
      {
        id: 'g3',
        name: 'Dev',
        isSelf: false,
        avatarUrl: generateInitialsAvatar('Dev', false),
      },
      {
        id: 'g4',
        name: 'Neha',
        isSelf: false,
        avatarUrl: generateInitialsAvatar('Neha', false),
      },
    ],
    messages: [
      { id: nanoid(), kind: 'system', text: 'You created group "Squad Goals \uD83C\uDFD6\uFE0F"' },
      { id: nanoid(), kind: 'system', text: 'You added Ananya, Dev, Neha' },
      { id: nanoid(), kind: 'date', label: '3/7/2026' },
      { id: nanoid(), kind: 'date', label: 'Friday' },
      { id: nanoid(), kind: 'text', participantId: 'g1', text: 'Guys. Goa. This weekend. Final answer?', time: '7:12 pm' },
      { id: nanoid(), kind: 'text', participantId: 'g2', text: 'YESSS been waiting forever \uD83D\uDE4C', time: '7:13 pm', reaction: { emoji: '\uD83D\uDD25' } },
      { id: nanoid(), kind: 'text', participantId: 'g3', text: "I'm in. Already checked tickets", time: '7:14 pm' },
      { id: nanoid(), kind: 'text', participantId: 'g4', text: "Can't believe we're actually doing this \uD83D\uDE2D", time: '7:15 pm' },
      { id: nanoid(), kind: 'system', text: 'Dev changed the group photo' },
      { id: nanoid(), kind: 'date', label: '4/7/2026' },
      { id: nanoid(), kind: 'date', label: 'Saturday' },
      { id: nanoid(), kind: 'text', participantId: 'g2', text: "Who's booking the stay?", time: '10:02 am' },
      { id: nanoid(), kind: 'text', participantId: 'g1', text: "I'll handle it. Just send me your share tonight", time: '10:04 am' },
      { id: nanoid(), kind: 'text', participantId: 'g3', text: 'Already transferred \uD83D\uDCB8', time: '10:05 am', reaction: { emoji: '\uD83D\uDC4D' } },
      { id: nanoid(), kind: 'text', participantId: 'g4', text: 'Same. Done \u2705', time: '10:06 am' },
      { id: nanoid(), kind: 'text', participantId: 'g1', text: 'Legend. Booking confirmed \uD83C\uDF89', time: '10:08 am', reaction: { emoji: '\uD83D\uDD25' } },
    ],
  },
};
