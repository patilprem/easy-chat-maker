import type { ChatProject } from '../parser/types';
import type { ProgressCallback } from './exportMp4';
import { buildFramePlan, FPS } from '../video/chatTimeline';

const RECORDER_ORIGIN = 'http://127.0.0.1:8817';
const RECORDER_URL = `${RECORDER_ORIGIN}/record`;
const PROBE_TIMEOUT_MS = 3000;

/**
 * The recorder only ever runs next to the local dev server (Run App.bat).
 * On the live site, requesting 127.0.0.1 makes newer Chrome/Edge show a
 * "local network access" permission prompt, and the request hangs until the
 * user answers it — which froze the export bar at 96%. So only try the
 * recorder when the editor itself is served from this machine or the LAN.
 */
function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === '[::1]' ||
    /^127\./.test(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  );
}

/** Quick reachability check so a missing/blocked recorder can't hang the export. */
async function recorderReachable(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    // no-cors: any answer (the server replies 404 to GET) proves it's up.
    await fetch(RECORDER_ORIGIN, { mode: 'no-cors', signal: controller.signal, cache: 'no-store' });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

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
  if (typeof window === 'undefined' || !isLocalHost(window.location.hostname)) throw new RecorderUnavailableError();
  if (!(await recorderReachable())) throw new RecorderUnavailableError();

  onProgress('preparing', 5);
  const durationMs = Math.ceil((buildFramePlan(project.messages, project.participants, project.playbackSpeed).length / FPS) * 1000);

  // The recorder replies only once the whole video is recorded (real time
  // plus browser start-up and encoding), so estimate progress from elapsed
  // time against that, never claiming more than 95% before it answers.
  const startedAt = Date.now();
  const expectedMs = durationMs + 15_000;
  const ticker = window.setInterval(() => {
    const pct = 5 + Math.min(90, ((Date.now() - startedAt) / expectedMs) * 90);
    onProgress('encoding', pct);
  }, 500);

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
  } finally {
    window.clearInterval(ticker);
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
