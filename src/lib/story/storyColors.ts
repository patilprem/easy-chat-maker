/**
 * Story-mode gradient backgrounds. Stored as stop arrays (not CSS strings) so
 * the same preset paints both the DOM preview (`presetCss`) and the video
 * export canvas (`paintPreset`) identically.
 */

export interface StoryColorPreset {
  id: string;
  name: string;
  /** CSS linear-gradient angle in degrees. */
  angleDeg: number;
  stops: { offset: number; color: string }[];
}

export const STORY_COLOR_PRESETS: StoryColorPreset[] = [
  { id: 'midnight', name: 'Midnight', angleDeg: 160, stops: [{ offset: 0, color: '#0A0A1A' }, { offset: 1, color: '#16213E' }] },
  { id: 'plum', name: 'Plum', angleDeg: 160, stops: [{ offset: 0, color: '#2D1B4E' }, { offset: 1, color: '#4A2A6B' }] },
  { id: 'ocean', name: 'Ocean', angleDeg: 160, stops: [{ offset: 0, color: '#0B2545' }, { offset: 1, color: '#13315C' }] },
  { id: 'sunset', name: 'Sunset', angleDeg: 160, stops: [{ offset: 0, color: '#3A1C2B' }, { offset: 1, color: '#7A3B3B' }] },
  { id: 'forest', name: 'Forest', angleDeg: 160, stops: [{ offset: 0, color: '#0F2E1D' }, { offset: 1, color: '#1F4A33' }] },
  { id: 'charcoal', name: 'Charcoal', angleDeg: 160, stops: [{ offset: 0, color: '#1A1A1A' }, { offset: 1, color: '#2E2E2E' }] },
  { id: 'cream', name: 'Cream', angleDeg: 160, stops: [{ offset: 0, color: '#F4E9D8' }, { offset: 1, color: '#E7D3B3' }] },
  { id: 'pinkblue', name: 'Pink Blue', angleDeg: 135, stops: [{ offset: 0, color: '#5C2A66' }, { offset: 1, color: '#1E3F6E' }] },
  { id: 'candy', name: 'Candy', angleDeg: 135, stops: [{ offset: 0, color: '#FF6B9D' }, { offset: 1, color: '#845EC2' }] },
  { id: 'noir', name: 'Noir', angleDeg: 160, stops: [{ offset: 0, color: '#000000' }, { offset: 1, color: '#1C1C1C' }] },
];

export function findColorPreset(id: string | undefined): StoryColorPreset {
  return STORY_COLOR_PRESETS.find((p) => p.id === id) ?? STORY_COLOR_PRESETS[0];
}

/** CSS `background` value for the DOM preview. */
export function presetCss(preset: StoryColorPreset): string {
  const stops = preset.stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ');
  return `linear-gradient(${preset.angleDeg}deg, ${stops})`;
}

/** Paints the preset into a canvas 2D context, filling (0,0,w,h). */
export function paintPreset(ctx: CanvasRenderingContext2D, preset: StoryColorPreset, w: number, h: number): void {
  // Convert the CSS angle (0deg = up, clockwise) to a gradient line across the box.
  const rad = ((preset.angleDeg - 90) * Math.PI) / 180;
  const cx = w / 2;
  const cy = h / 2;
  const len = (Math.abs(w * Math.cos(rad)) + Math.abs(h * Math.sin(rad))) / 2;
  const dx = Math.cos(rad) * len;
  const dy = Math.sin(rad) * len;
  const gradient = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  for (const stop of preset.stops) gradient.addColorStop(stop.offset, stop.color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}
