import { generateInitialsAvatar } from '../parser/parseChatScript';
import type { ChatProject, Message, Participant } from '../parser/types';

/** Ready-made example conversations for the homepage use-case deep links */

type Scenario = Omit<ChatProject, 'id' | 'exportConsentAccepted'>;

function person(id: string, name: string, isSelf: boolean): Participant {
  return { id, name, isSelf, avatarUrl: generateInitialsAvatar(name, isSelf) };
}

const chatStory: Scenario = {
  platform: 'whatsapp',
  theme: 'light',
  deviceOS: 'ios',
  title: 'Maria ✈️',
  subtitle: 'online',
  isGroup: false,
  participants: [person('you', 'You', true), person('maria', 'Maria', false)],
  messages: [
    { id: 's1', kind: 'text', participantId: 'maria', text: 'Guess who just landed in Goa 🌴', time: '4:02 pm' },
    { id: 's2', kind: 'text', participantId: 'you', text: 'NO WAY. With who??', time: '4:02 pm' },
    { id: 's3', kind: 'text', participantId: 'maria', text: 'The whole gang. The Airbnb has a pool 😎', time: '4:03 pm', reaction: { emoji: '😍' } },
    { id: 's4', kind: 'text', participantId: 'you', text: "I'm booking a flight right now", time: '4:04 pm' },
    { id: 's5', kind: 'text', participantId: 'maria', text: 'DO IT. Rooftop party tonight 🎉', time: '4:04 pm' },
  ] as Message[],
};

const testimonial: Scenario = {
  platform: 'slack',
  theme: 'light',
  deviceOS: 'ios',
  title: 'customer-love',
  subtitle: '12 members • 4 tabs',
  isGroup: true,
  participants: [person('you', 'Priya', true), person('jake', 'Jake', false), person('sam', 'Sam', false)],
  messages: [
    { id: 't1', kind: 'text', participantId: 'jake', text: 'Just got off a call with Meadow Café — the new dashboard saves them 6 hours a week 🤯', time: '9:41 AM' },
    { id: 't2', kind: 'text', participantId: 'sam', text: 'Screenshot that for the case study 📸', time: '9:42 AM', reaction: { emoji: '🎉' } },
    { id: 't3', kind: 'text', participantId: 'you', text: 'Adding it to the launch thread now 🚀', time: '9:43 AM' },
  ] as Message[],
};

const aiDemo: Scenario = {
  platform: 'chatgpt',
  theme: 'dark',
  deviceOS: 'ios',
  title: 'ChatGPT',
  subtitle: '',
  isGroup: false,
  participants: [person('you', 'You', true), person('ai', 'ChatGPT', false)],
  messages: [
    { id: 'a1', kind: 'text', participantId: 'you', text: 'Write a 3-line pitch for our note-taking app', time: '9:41 am' },
    { id: 'a2', kind: 'text', participantId: 'ai', text: '1. Capture ideas the moment they strike.\n2. Organize nothing — search finds everything.\n3. Share a living doc, not an attachment.', time: '9:41 am' },
    { id: 'a3', kind: 'text', participantId: 'you', text: 'Perfect. Now a shorter tagline?', time: '9:42 am' },
    { id: 'a4', kind: 'text', participantId: 'ai', text: 'Notes that keep up with your brain ⚡', time: '9:42 am' },
  ] as Message[],
};

export const SCENARIOS: Record<string, Scenario> = {
  'chat-story': chatStory,
  'testimonial': testimonial,
  'ai-demo': aiDemo,
};
