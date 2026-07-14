export type MessageSound = 'send' | 'receive' | 'reaction';

const SOUND_FILE_NAMES: Record<MessageSound, string> = {
  send: 'message-send.wav',
  receive: 'message-receive.wav',
  reaction: 'reaction-pop.wav',
};

const PREVIEW_VOLUME = 0.55;

const cache = new Map<string, HTMLAudioElement>();

function tryPlay(urls: string[], index: number): void {
  if (index >= urls.length) return;
  const url = urls[index];

  let base = cache.get(url);
  if (!base) {
    base = new Audio(url);
    base.preload = 'auto';
    cache.set(url, base);
  }

  // Clone so overlapping sounds (e.g. receive + reaction) don't cut each other off
  const node = base.cloneNode() as HTMLAudioElement;
  node.volume = PREVIEW_VOLUME;
  node.play().catch(() => tryPlay(urls, index + 1));
}

/**
 * Play a message sound, preferring the platform-specific file in
 * public/sounds/<platform>/ and falling back to the default in public/sounds/.
 */
export function playMessageSound(name: MessageSound, platform?: string): void {
  if (typeof Audio === 'undefined') return;

  const fileName = SOUND_FILE_NAMES[name];
  const urls: string[] = [];
  if (platform && /^[a-z0-9_-]+$/i.test(platform)) {
    urls.push(`/sounds/${platform}/${fileName}`);
  }
  urls.push(`/sounds/${fileName}`);
  tryPlay(urls, 0);
}
