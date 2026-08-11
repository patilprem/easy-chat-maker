import type { ChatProject, Platform, Theme } from './parser/types';

/**
 * Chat backgrounds, modelled on what the real apps actually ship.
 *
 * - WhatsApp / Telegram: a "wallpaper" — a solid colour, gradient or photo that
 *   sits behind the message list and stays put while messages scroll over it.
 *   An optional doodle pattern overlays it (WhatsApp calls it the doodle
 *   overlay; Telegram calls it a pattern).
 * - Instagram / Messenger: a "chat theme" — a gradient behind the thread that
 *   ALSO recolours the outgoing bubbles. That bubble tint is the part that makes
 *   a theme read as authentic, so presets carry it.
 *
 * Slack, Discord and the AI assistants have no such feature, so the editor
 * hides the control for them (see BACKGROUND_PLATFORMS).
 */

/** Platforms whose real apps let you change the chat background. */
export const BACKGROUND_PLATFORMS: Platform[] = ['whatsapp', 'telegram', 'instagram', 'messenger'];

export function supportsBackground(platform: Platform): boolean {
  return BACKGROUND_PLATFORMS.includes(platform);
}

/** Platforms that draw a doodle/pattern overlay on top of the wallpaper. */
export function supportsDoodle(platform: Platform): boolean {
  return platform === 'whatsapp' || platform === 'telegram';
}

/**
 * Telegram paints its wallpaper edge to edge (the header floats on top of it as
 * a translucent pill). Everyone else keeps their header and composer chrome and
 * shows the background behind the messages only.
 */
export function backgroundCoversChrome(platform: Platform): boolean {
  return platform === 'telegram';
}

export interface BackgroundPreset {
  id: string;
  name: string;
  /** Which platforms offer this preset. */
  platforms: Platform[];
  /** CSS `background` value per theme. */
  light: string;
  dark: string;
  /** Chat themes (Instagram/Messenger) also tint the outgoing bubble. */
  bubble?: string;
  /** Small swatch shown in the picker (defaults to the light value). */
  swatch?: string;
}

const MESSAGING: Platform[] = ['whatsapp', 'telegram'];
const THEMED: Platform[] = ['instagram', 'messenger'];

/**
 * Wallpapers for WhatsApp/Telegram: muted solids and gradients that keep chat
 * bubbles readable, in the spirit of the stock wallpaper pickers.
 */
const WALLPAPERS: BackgroundPreset[] = [
  { id: 'sand', name: 'Sand', platforms: MESSAGING, light: '#efeae2', dark: '#1c1810' },
  { id: 'mint', name: 'Mint', platforms: MESSAGING, light: '#d8ece0', dark: '#10231a' },
  { id: 'sky', name: 'Sky', platforms: MESSAGING, light: '#dbe8f5', dark: '#0f1c2b' },
  { id: 'rose', name: 'Rose', platforms: MESSAGING, light: '#f5dfe3', dark: '#26141a' },
  { id: 'sage', name: 'Sage', platforms: MESSAGING, light: '#e3e8d5', dark: '#191d12' },
  { id: 'charcoal', name: 'Charcoal', platforms: MESSAGING, light: '#d5d7da', dark: '#101418' },
  {
    id: 'sunset', name: 'Sunset', platforms: MESSAGING,
    light: 'linear-gradient(170deg, #f7c9a6 0%, #f0a58f 55%, #d98299 100%)',
    dark: 'linear-gradient(170deg, #3a2130 0%, #2b1a2b 55%, #1b1420 100%)',
  },
  {
    id: 'ocean', name: 'Ocean', platforms: MESSAGING,
    light: 'linear-gradient(170deg, #bfe3e8 0%, #9fc9de 52%, #8fb2d6 100%)',
    dark: 'linear-gradient(170deg, #10242e 0%, #122c3a 52%, #101f2e 100%)',
  },
  {
    id: 'aurora', name: 'Aurora', platforms: MESSAGING,
    light: 'linear-gradient(170deg, #cfe9d4 0%, #b6dfe0 50%, #c8cdea 100%)',
    dark: 'linear-gradient(170deg, #10261f 0%, #0f2530 50%, #191c33 100%)',
  },
  {
    id: 'dusk', name: 'Dusk', platforms: MESSAGING,
    light: 'linear-gradient(170deg, #d7cdea 0%, #bcbfe4 50%, #a9b6dd 100%)',
    dark: 'linear-gradient(170deg, #1d1830 0%, #171a2c 50%, #121623 100%)',
  },
];

/**
 * Instagram/Messenger chat themes. Each one recolours the background AND the
 * outgoing bubbles, the way picking a theme does in those apps.
 */
const CHAT_THEMES: BackgroundPreset[] = [
  {
    id: 'love', name: 'Love', platforms: THEMED,
    light: 'linear-gradient(180deg, #ffdde4 0%, #ffc2cf 100%)',
    dark: 'linear-gradient(180deg, #2a1018 0%, #3d121f 100%)',
    bubble: 'linear-gradient(180deg, #ff5c8a 0%, #e8265f 100%)',
    swatch: 'linear-gradient(135deg, #ff5c8a 0%, #e8265f 100%)',
  },
  {
    id: 'purple-haze', name: 'Purple', platforms: THEMED,
    light: 'linear-gradient(180deg, #ede0fb 0%, #d9c2f7 100%)',
    dark: 'linear-gradient(180deg, #1d1330 0%, #2a1747 100%)',
    bubble: 'linear-gradient(180deg, #d800d8 0%, #8738f2 100%)',
    swatch: 'linear-gradient(135deg, #d800d8 0%, #8738f2 100%)',
  },
  {
    id: 'aqua', name: 'Aqua', platforms: THEMED,
    light: 'linear-gradient(180deg, #d9f2f7 0%, #b6e2f2 100%)',
    dark: 'linear-gradient(180deg, #0d2028 0%, #10303d 100%)',
    bubble: 'linear-gradient(180deg, #2ac8e0 0%, #1479d1 100%)',
    swatch: 'linear-gradient(135deg, #2ac8e0 0%, #1479d1 100%)',
  },
  {
    id: 'tropical', name: 'Tropical', platforms: THEMED,
    light: 'linear-gradient(180deg, #fdeccd 0%, #ffd6b0 100%)',
    dark: 'linear-gradient(180deg, #2a1e0f 0%, #3a2413 100%)',
    bubble: 'linear-gradient(180deg, #ffb03a 0%, #f7683c 100%)',
    swatch: 'linear-gradient(135deg, #ffb03a 0%, #f7683c 100%)',
  },
  {
    id: 'berry', name: 'Berry', platforms: THEMED,
    light: 'linear-gradient(180deg, #f3dcf3 0%, #e2c0ea 100%)',
    dark: 'linear-gradient(180deg, #241028 0%, #341539 100%)',
    bubble: 'linear-gradient(180deg, #b354d6 0%, #7a2fb0 100%)',
    swatch: 'linear-gradient(135deg, #b354d6 0%, #7a2fb0 100%)',
  },
  {
    id: 'forest', name: 'Forest', platforms: THEMED,
    light: 'linear-gradient(180deg, #ddf0dd 0%, #bfe3c4 100%)',
    dark: 'linear-gradient(180deg, #0f2116 0%, #123322 100%)',
    bubble: 'linear-gradient(180deg, #3fbf72 0%, #17864b 100%)',
    swatch: 'linear-gradient(135deg, #3fbf72 0%, #17864b 100%)',
  },
  {
    id: 'monochrome', name: 'Mono', platforms: THEMED,
    light: 'linear-gradient(180deg, #f0f0f0 0%, #d8d8d8 100%)',
    dark: 'linear-gradient(180deg, #141414 0%, #262626 100%)',
    bubble: 'linear-gradient(180deg, #4a4a4a 0%, #111111 100%)',
    swatch: 'linear-gradient(135deg, #4a4a4a 0%, #111111 100%)',
  },
  {
    id: 'candy', name: 'Candy', platforms: THEMED,
    light: 'linear-gradient(180deg, #ffe3f1 0%, #dfe0ff 100%)',
    dark: 'linear-gradient(180deg, #2b1424 0%, #171a35 100%)',
    bubble: 'linear-gradient(180deg, #ff7ac0 0%, #6c7bff 100%)',
    swatch: 'linear-gradient(135deg, #ff7ac0 0%, #6c7bff 100%)',
  },
];

export const BACKGROUND_PRESETS: BackgroundPreset[] = [...WALLPAPERS, ...CHAT_THEMES];

export function presetsForPlatform(platform: Platform): BackgroundPreset[] {
  return BACKGROUND_PRESETS.filter((p) => p.platforms.includes(platform));
}

export function findPreset(id: string | undefined): BackgroundPreset | undefined {
  if (!id) return undefined;
  return BACKGROUND_PRESETS.find((p) => p.id === id);
}

export function presetSwatch(preset: BackgroundPreset, theme: Theme): string {
  return preset.swatch ?? (theme === 'dark' ? preset.dark : preset.light);
}

/**
 * The preset in effect, or undefined. A preset only counts on the platforms it
 * was designed for, so switching a WhatsApp wallpaper over to Instagram falls
 * back to Instagram's stock look instead of painting a wallpaper there.
 */
export function activePreset(project: ChatProject): BackgroundPreset | undefined {
  const preset = findPreset(project.background?.presetId);
  if (!preset || !preset.platforms.includes(project.platform)) return undefined;
  return preset;
}

/** True when the project has a background the previews should paint. */
export function hasCustomBackground(project: ChatProject): boolean {
  if (!supportsBackground(project.platform)) return false;
  const bg = project.background;
  if (!bg) return false;
  return Boolean(bg.imageUrl || activePreset(project));
}

/**
 * Whether the doodle/pattern overlay should be drawn. It stays on by default
 * (that is the stock look, and the look every existing project already has),
 * and defaults OFF once a photo wallpaper is set — a busy pattern over a photo
 * is not what the apps do.
 */
export function showDoodle(project: ChatProject): boolean {
  if (!supportsDoodle(project.platform)) return false;
  const bg = project.background;
  if (!bg) return true;
  if (bg.doodle !== undefined) return bg.doodle;
  return !bg.imageUrl;
}

/** The outgoing-bubble tint a chat theme applies, if any. */
export function selfBubbleBackground(project: ChatProject): string | undefined {
  if (!supportsBackground(project.platform)) return undefined;
  return activePreset(project)?.bubble;
}

/** The resolved CSS `background` shorthand for the current project, if any. */
export function backgroundCss(project: ChatProject): string | undefined {
  if (!supportsBackground(project.platform)) return undefined;
  if (project.background?.imageUrl) return undefined; // photos are painted as tiles
  const preset = activePreset(project);
  if (!preset) return undefined;
  return project.theme === 'dark' ? preset.dark : preset.light;
}
