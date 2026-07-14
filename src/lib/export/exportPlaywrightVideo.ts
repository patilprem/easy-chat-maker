import type { ChatProject } from '../parser/types';
import type { ProgressCallback } from './exportMp4';
import { buildFramePlan, FPS } from '../video/chatTimeline';

const RECORDER_URL = 'http://127.0.0.1:8817/record';

/** The local Playwright recorder isn't reachable (not started, or we're on the live site). */
export class RecorderUnavailableError extends Error {
  constructor() {
    super('Video exporter is not running.');
    this.name = 'RecorderUnavailableError';
  }
}

interface RecorderResponse {
  ok: boolean;
  outputPath: string;
  bytes: number;
}

export interface PlaywrightVideoOptions {
  includeSounds?: boolean;
}

export async function exportPlaywrightVideo(
  project: ChatProject,
  onProgress: ProgressCallback,
  options: PlaywrightVideoOptions = {},
): Promise<string> {
  onProgress('preparing', 5);
  const durationMs = Math.ceil((buildFramePlan(project.messages, project.participants).length / FPS) * 1000);

  let response: Response;
  try {
    response = await fetch(RECORDER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project,
        appUrl: window.location.origin,
        durationMs,
        promptForSave: true,
        includeSounds: options.includeSounds !== false,
      }),
    });
  } catch {
    throw new RecorderUnavailableError();
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(errorText || 'Video export failed.');
  }

  onProgress('downloading', 99);
  const result = await response.json() as RecorderResponse;
  if (!result.ok || !result.outputPath) throw new Error('Recorder did not return a saved file path.');
  onProgress('idle', 100);
  return result.outputPath;
}
