import type { ChatProject } from '../parser/types';

/**
 * Whether this project renders and exports as a story (chrome-less bubbles
 * over a background, 9:16/16:9 video, AI voiceover). Story projects live on
 * the /story-editor page; the editorStore's mode normalisation guarantees
 * `story.enabled` is true there and false on /editor.
 */
export function isStoryEnabled(project: ChatProject): boolean {
  return project.story?.enabled ?? false;
}
