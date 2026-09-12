import type { ChatProject } from '../parser/types';

/**
 * Master switch for Story Mode (the chrome-less "texting story" format —
 * bubbles over a background, 9:16/16:9 video export, AI voiceover).
 *
 * Turned OFF for now: the whole feature is hidden from the editor rather
 * than removed, so flipping this back to `true` restores it exactly as it
 * was — the settings panel, the preview, the story exporter and everything
 * under lib/story and lib/tts are all still here and still built.
 *
 * Read it through `isStoryEnabled(project)` rather than directly, so a
 * project saved while the feature was live (its `story.enabled` is still
 * true in localStorage) falls back to the normal phone mode instead of
 * stranding someone in a story layout with no visible way out.
 */
export const STORY_MODE_ENABLED = false;

/** Whether this project should render and export as a story. */
export function isStoryEnabled(project: ChatProject): boolean {
  return STORY_MODE_ENABLED && (project.story?.enabled ?? false);
}
