import http from 'node:http';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';

const require = createRequire(import.meta.url);

function resolveFfmpegPath() {
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && existsSync(staticPath)) return staticPath;
  } catch {
    // ffmpeg-static not installed or its binary download failed; fall back to system ffmpeg
  }
  return 'ffmpeg';
}

const ffmpegPath = resolveFfmpegPath();

const PORT = Number(process.env.ECM_RECORDER_PORT || 8817);
const PHONE_W = 390;
const PHONE_H = 844;
const VIDEO_SCALE = 1.4;
const VIDEO_W = Math.round(PHONE_W * VIDEO_SCALE / 2) * 2;
const VIDEO_H = Math.round(PHONE_H * VIDEO_SCALE / 2) * 2;
const VIDEO_QUERY = `w=${PHONE_W}&h=${PHONE_H}&scale=${VIDEO_SCALE}`;
const CAPTURE_FPS = 24;
const OUTPUT_FPS = 30;
const TYPING_FRAMES = Math.round(CAPTURE_FPS * 1.45);
const PAUSE_FRAMES = Math.round(CAPTURE_FPS * 0.9);
const INSTANT_PAUSE = Math.round(CAPTURE_FPS * 0.45);
const REACTION_DELAY = Math.round(CAPTURE_FPS * 0.5);
const END_HOLD = CAPTURE_FPS * 2.5;
const HERE = dirname(fileURLToPath(import.meta.url));
const RECORDING_DIR = join(HERE, '..', '.tmp', 'playwright-recordings');
const EXPORT_DIR = join(HERE, '..', '.tmp', 'exported-videos');
const SOUNDS_DIR = join(HERE, '..', 'public', 'sounds');
const SOUND_FILE_NAMES = {
  send: 'message-send.wav',
  receive: 'message-receive.wav',
  reaction: 'reaction-pop.wav',
};

// Per-platform sounds live in public/sounds/<platform>/, falling back to the
// defaults at the root of public/sounds/. Drop in your own WAVs to customize.
function resolveSoundFiles(platform) {
  const safePlatform = /^[a-z0-9_-]+$/i.test(String(platform || '')) ? String(platform) : null;
  const files = {};
  for (const [key, fileName] of Object.entries(SOUND_FILE_NAMES)) {
    const candidates = [
      ...(safePlatform ? [join(SOUNDS_DIR, safePlatform, fileName)] : []),
      join(SOUNDS_DIR, fileName),
    ];
    const found = candidates.find((candidate) => existsSync(candidate));
    if (found) files[key] = found;
  }
  return files;
}
const execFileAsync = promisify(execFile);

function sendCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Expose-Headers', 'X-Output-Filename');
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 10_000_000) {
        reject(new Error('Payload is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });
    req.on('error', reject);
  });
}

function psString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function pickSavePath(fileName, filter = 'MP4 video (*.mp4)|*.mp4|All files (*.*)|*.*') {
  if (process.platform !== 'win32') {
    throw new Error('Choosing a save location after export is only supported on Windows in this local exporter.');
  }

  await mkdir(RECORDING_DIR, { recursive: true });
  const scriptPath = join(RECORDING_DIR, `save-dialog-${Date.now()}-${Math.random().toString(16).slice(2)}.ps1`);
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.SaveFileDialog
$dialog.Title = 'Save chat video'
$dialog.Filter = ${psString(filter)}
$dialog.FileName = ${psString(fileName)}
$dialog.InitialDirectory = [Environment]::GetFolderPath('Desktop')
$dialog.OverwritePrompt = $true
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.StartPosition = 'CenterScreen'
$owner.ShowInTaskbar = $false
$owner.WindowState = 'Minimized'
$owner.Show()
$owner.Activate()
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::Out.Write($dialog.FileName)
}
$owner.Close()
`;

  await writeFile(scriptPath, script, 'utf8');

  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
      { timeout: 120_000, windowsHide: false }
    );

    return stdout.trim();
  } catch (error) {
    const stderr = typeof error === 'object' && error && 'stderr' in error ? String(error.stderr).trim() : '';
    const message = stderr || (error instanceof Error ? error.message : '');
    throw new Error(`Could not open the Save As dialog.${message ? ` ${message.slice(0, 300)}` : ''}`);
  } finally {
    await rm(scriptPath, { force: true }).catch(() => {});
  }
}

async function convertWebmToMp4(webmPath, mp4Path) {
  if (!ffmpegPath) {
    throw new Error('FFmpeg is not available. Run: npm install');
  }

  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-fflags', '+genpts',
        '-i', webmPath,
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-vf', 'fps=30,format=yuv420p',
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level:v', '4.2',
        '-preset', 'veryfast',
        '-crf', '20',
        '-r', '30',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-shortest',
        '-movflags', '+faststart',
        mp4Path,
      ],
      { timeout: 120_000, windowsHide: true }
    );
  } catch (error) {
    const stderr = typeof error === 'object' && error && 'stderr' in error ? String(error.stderr).trim() : '';
    const message = stderr || (error instanceof Error ? error.message : '');
    throw new Error(`Could not convert video to MP4.${message ? ` ${message.slice(0, 500)}` : ''}`);
  }
}

function buildFramePlan(messages = [], participants = []) {
  const reveals = [];
  const selfParticipantIds = new Set(participants.filter((p) => p.isSelf).map((p) => p.id));
  let frame = 0;
  const msgHeight = 80;
  const phoneHeight = 844 - 56 - 60 - 56;

  for (const msg of messages) {
    if (msg.kind === 'system' || msg.kind === 'date') {
      const startFrame = frame;
      reveals.push({
        msgId: msg.id,
        participantId: undefined,
        showsTyping: false,
        hasReaction: false,
        startFrame,
        revealFrame: startFrame,
        reactionFrame: -1,
      });
      frame += INSTANT_PAUSE;
    } else if (msg.kind === 'text' || msg.kind === 'image' || msg.kind === 'voice') {
      const startFrame = frame;
      const revealFrame = frame + TYPING_FRAMES;
      const hasReaction = !!(msg.reaction?.emoji);
      const showsTyping = !selfParticipantIds.has(msg.participantId);
      reveals.push({
        msgId: msg.id,
        participantId: msg.participantId,
        showsTyping,
        hasReaction,
        startFrame,
        revealFrame,
        reactionFrame: hasReaction ? revealFrame + REACTION_DELAY : -1,
      });
      frame = revealFrame + PAUSE_FRAMES;
    }
  }

  const plans = [];
  const totalFrames = frame + END_HOLD;
  for (let f = 0; f < totalFrames; f += 1) {
    let visibleCount = 0;
    let typingParticipantId = null;
    const activeReactionIds = [];

    for (const r of reveals) {
      if (f < r.startFrame) break;

      if (f >= r.revealFrame) {
        visibleCount += 1;
        if (r.hasReaction && r.reactionFrame !== -1 && f >= r.reactionFrame) {
          activeReactionIds.push(r.msgId);
        }
      } else if (r.participantId && r.showsTyping) {
        typingParticipantId = r.participantId;
      }
    }

    plans.push({
      visibleCount,
      typingParticipantId,
      activeReactionIds,
      scrollY: Math.max(0, visibleCount * msgHeight - phoneHeight),
    });
  }

  return plans;
}

// Mirrors the frame arithmetic of buildFramePlan so each sound lands exactly
// when its bubble/reaction becomes visible.
function buildAudioEvents(messages = [], participants = [], soundFiles = {}) {
  const selfParticipantIds = new Set(participants.filter((p) => p.isSelf).map((p) => p.id));
  const events = [];
  let frame = 0;

  for (const msg of messages) {
    if (msg.kind === 'system' || msg.kind === 'date') {
      frame += INSTANT_PAUSE;
    } else if (msg.kind === 'text' || msg.kind === 'image' || msg.kind === 'voice') {
      const revealFrame = frame + TYPING_FRAMES;
      events.push({
        timeSec: revealFrame / CAPTURE_FPS,
        sound: selfParticipantIds.has(msg.participantId) ? 'send' : 'receive',
      });
      if (msg.reaction?.emoji) {
        events.push({
          timeSec: (revealFrame + REACTION_DELAY) / CAPTURE_FPS,
          sound: 'reaction',
        });
      }
      frame = revealFrame + PAUSE_FRAMES;
    }
  }

  return events.filter((event) => soundFiles[event.sound]);
}

function buildAudioMixArgs(audioEvents, soundFiles) {
  const inputArgs = [];
  const filters = [];
  const mixLabels = ['[1:a]'];
  const soundNames = [...new Set(audioEvents.map((event) => event.sound))];
  let inputIndex = 2; // 0 = video frames, 1 = silent base track

  for (const sound of soundNames) {
    inputArgs.push('-i', soundFiles[sound]);
    const events = audioEvents.filter((event) => event.sound === sound);
    const copyLabels = events.map((_, i) => `[${sound}${i}]`);

    if (events.length > 1) {
      filters.push(`[${inputIndex}:a]asplit=${events.length}${copyLabels.join('')}`);
    }

    events.forEach((event, i) => {
      const source = events.length > 1 ? copyLabels[i] : `[${inputIndex}:a]`;
      const delayMs = Math.max(0, Math.round(event.timeSec * 1000));
      const label = `[${sound}d${i}]`;
      filters.push(`${source}adelay=${delayMs}:all=1${label}`);
      mixLabels.push(label);
    });

    inputIndex += 1;
  }

  filters.push(`${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:normalize=0[aout]`);
  return { inputArgs, filterComplex: filters.join(';') };
}

function getCompleteFrame(project) {
  return {
    visibleCount: project.messages.length,
    typingParticipantId: null,
    activeReactionIds: project.messages
      .filter((message) => message.reaction?.emoji)
      .map((message) => message.id),
    scrollY: Number.MAX_SAFE_INTEGER,
  };
}

function concatPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/'/g, "'\\''");
}

async function encodeFrameSegmentsToMp4(listPath, mp4Path, audioEvents = [], soundFiles = {}) {
  if (!ffmpegPath) {
    throw new Error('FFmpeg is not available. Run: npm install');
  }

  const hasSounds = audioEvents.length > 0;
  const { inputArgs, filterComplex } = hasSounds
    ? buildAudioMixArgs(audioEvents, soundFiles)
    : { inputArgs: [], filterComplex: '' };

  try {
    await execFileAsync(
      ffmpegPath,
      [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        ...inputArgs,
        ...(hasSounds ? ['-filter_complex', filterComplex] : []),
        '-map', '0:v:0',
        '-map', hasSounds ? '[aout]' : '1:a:0',
        '-vf', `fps=${OUTPUT_FPS},format=yuv420p`,
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level:v', '4.2',
        '-preset', 'veryfast',
        '-crf', '18',
        '-r', String(OUTPUT_FPS),
        '-c:a', 'aac',
        '-b:a', '96k',
        '-shortest',
        '-movflags', '+faststart',
        mp4Path,
      ],
      { timeout: 300_000, windowsHide: true }
    );
  } catch (error) {
    const stderr = typeof error === 'object' && error && 'stderr' in error ? String(error.stderr).trim() : '';
    const message = stderr || (error instanceof Error ? error.message : '');
    throw new Error(`Could not create MP4 from rendered preview frames.${message ? ` ${message.slice(0, 500)}` : ''}`);
  }
}

async function setRenderedFrame(page, plan, token, frameIndex) {
  await page.evaluate(({ nextPlan, nextToken, nextFrameIndex, captureFps }) => {
    window.__ECM_FRAME_READY = null;
    document.documentElement.style.setProperty('--typing-dot-play-state', 'paused');
    document.documentElement.style.setProperty('--typing-dot-offset', `${-(nextFrameIndex / captureFps)}s`);
    window.postMessage({ type: 'SET_FRAME', plan: nextPlan, token: nextToken }, '*');
  }, { nextPlan: plan, nextToken: token, nextFrameIndex: frameIndex, captureFps: CAPTURE_FPS });

  await page.waitForFunction((nextToken) => window.__ECM_FRAME_READY === nextToken, token, { timeout: 5000 });
}

async function renderProjectFrames(page, project, runDir, mp4Path, includeSounds) {
  const frameDir = join(runDir, 'frames');
  await mkdir(frameDir, { recursive: true });

  const completeFrame = getCompleteFrame(project);
  const frames = [
    ...buildFramePlan(project.messages, project.participants),
    ...Array.from({ length: CAPTURE_FPS * 2 }, () => completeFrame),
  ];

  const segments = [];
  let captureIndex = 0;
  let i = 0;
  while (i < frames.length) {
    const plan = frames[i];
    const hasTyping = !!plan.typingParticipantId;
    let durationFrames = 1;

    if (!hasTyping) {
      const staticKey = JSON.stringify({
        visibleCount: plan.visibleCount,
        activeReactionIds: plan.activeReactionIds,
        scrollY: plan.scrollY,
      });
      let next = i + 1;
      while (next < frames.length) {
        const nextPlan = frames[next];
        if (nextPlan.typingParticipantId) break;
        const nextKey = JSON.stringify({
          visibleCount: nextPlan.visibleCount,
          activeReactionIds: nextPlan.activeReactionIds,
          scrollY: nextPlan.scrollY,
        });
        if (nextKey !== staticKey) break;
        next += 1;
      }
      durationFrames = next - i;
    }

    const framePath = join(frameDir, `frame-${String(captureIndex).padStart(5, '0')}.jpg`);
    const token = `frame-${i}`;
    await setRenderedFrame(page, plan, token, i);
    await page.screenshot({
      path: framePath,
      type: 'jpeg',
      quality: 95,
      animations: 'allow',
    });

    segments.push({
      path: framePath,
      duration: durationFrames / CAPTURE_FPS,
    });
    captureIndex += 1;
    i += durationFrames;
  }

  const listPath = join(runDir, 'frames.txt');
  const concatList = segments.flatMap((segment) => [
    `file '${concatPath(segment.path)}'`,
    `duration ${segment.duration.toFixed(6)}`,
  ]);
  if (segments.length > 0) {
    concatList.push(`file '${concatPath(segments[segments.length - 1].path)}'`);
  }
  await writeFile(listPath, `${concatList.join('\n')}\n`, 'utf8');
  const soundFiles = includeSounds ? resolveSoundFiles(project.platform) : {};
  const audioEvents = includeSounds
    ? buildAudioEvents(project.messages, project.participants, soundFiles)
    : [];
  await encodeFrameSegmentsToMp4(listPath, mp4Path, audioEvents, soundFiles);
}

async function openRenderPage(page, url, requireText = false) {
  let lastError;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForSelector('#phone-screen-export', { state: 'visible', timeout: 20_000 });
      if (requireText) {
        await page.waitForFunction(() => document.body.innerText.trim().length > 0, null, { timeout: 20_000 });
      }
      return;
    } catch (error) {
      lastError = error;
      await page.waitForTimeout(1000);
    }
  }

  throw lastError;
}

async function recordProject({ project, appUrl, durationMs, promptForSave = false, saveToExportDir = true, includeSounds = true }) {
  if (!project) throw new Error('Missing project payload.');
  const safeDurationMs = Number.isFinite(durationMs) && durationMs > 0
    ? Math.min(Math.max(durationMs, 1500), 120_000)
    : 20_000;

  await mkdir(RECORDING_DIR, { recursive: true });
  await mkdir(EXPORT_DIR, { recursive: true });
  const runDir = join(RECORDING_DIR, `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  await mkdir(runDir, { recursive: true });

  let browser;
  try {
    const launchOptions = { headless: true };
    if (process.env.ECM_CHROMIUM_PATH) {
      launchOptions.executablePath = process.env.ECM_CHROMIUM_PATH;
    }
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    throw new Error(
      `Could not launch Playwright Chromium. Run: npx playwright install chromium\n${error instanceof Error ? error.message : ''}`
    );
  }

  try {
    const baseUrl = typeof appUrl === 'string' && appUrl ? appUrl.replace(/\/$/, '') : 'http://127.0.0.1:4324';

    const context = await browser.newContext({
      viewport: { width: VIDEO_W, height: VIDEO_H },
      deviceScaleFactor: 1,
    });

    await context.addInitScript((payload) => {
      localStorage.setItem('ecm:v1:export-payload', JSON.stringify(payload));
    }, project);

    const page = await context.newPage();
    await openRenderPage(page, `${baseUrl}/render/chat/?mode=video&${VIDEO_QUERY}`, true);
    await page.waitForTimeout(300);
    const safePlatform = String(project.platform || 'chat').replace(/[^a-z0-9_-]/gi, '-').toLowerCase();
    const baseName = `${safePlatform}-chat-${Date.now()}`;
    const fileName = `${baseName}.mp4`;
    const mp4Path = join(runDir, fileName);
    await renderProjectFrames(page, project, runDir, mp4Path, includeSounds !== false);
    await context.close();
    const buffer = await readFile(mp4Path);
    let outputPath = null;

    if (promptForSave) {
      outputPath = await pickSavePath(fileName);
      if (!outputPath) {
        throw new Error('Save cancelled.');
      }
      await writeFile(outputPath, buffer);
    } else if (saveToExportDir) {
      outputPath = join(EXPORT_DIR, fileName);
      await writeFile(outputPath, buffer);
    }

    await rm(runDir, { recursive: true, force: true });
    return { buffer, fileName, outputPath };
  } finally {
    await browser.close().catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  sendCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/record') {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
    return;
  }

  try {
    const payload = await readJson(req);
    const { buffer, fileName, outputPath } = await recordProject(payload);

    if (payload.returnFile === true) {
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.byteLength,
        'X-Output-Filename': fileName,
      });
      res.end(buffer);
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({
      ok: true,
      outputPath,
      bytes: buffer.byteLength,
    }));
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end(error instanceof Error ? error.message : 'Video export failed.');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Playwright recorder ready at http://127.0.0.1:${PORT}`);
});
