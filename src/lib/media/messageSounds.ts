export type MessageSound = 'send' | 'receive' | 'reaction';

const SOUND_URLS: Record<MessageSound, string> = {
  send: '/sounds/message-send.wav',
  receive: '/sounds/message-receive.wav',
  reaction: '/sounds/reaction-pop.wav',
};

const PREVIEW_VOLUME = 0.55;

const cache = new Map<MessageSound, HTMLAudioElement>();

export function playMessageSound(name: MessageSound): void {
  if (typeof Audio === 'undefined') return;

  let base = cache.get(name);
  if (!base) {
    base = new Audio(SOUND_URLS[name]);
    base.preload = 'auto';
    cache.set(name, base);
  }

  // Clone so overlapping sounds (e.g. receive + reaction) don't cut each other off
  const node = base.cloneNode() as HTMLAudioElement;
  node.volume = PREVIEW_VOLUME;
  node.play().catch(() => {
    // Autoplay policy or missing file — preview sound is best-effort
  });
}
