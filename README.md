# Easy Chat Maker

Easy Chat Maker is an Astro and React app for turning simple chat scripts into fictional WhatsApp-style or Instagram DM-style mockups. It supports editing messages, participants, images, reactions, themes, and exporting the preview as PNG or MP4.

This tool is intended for creative, educational, storytelling, demo, and UI mockup use. It should not be used as real evidence, impersonation, fraud, harassment, or to mislead others.

## Run Locally

```sh
npm install
npm run dev
```

Open the local URL shown by Astro. The editor is available at both `/` and `/editor`.

## Build

```sh
npm run build
```

If the build environment blocks Astro telemetry config writes, run with telemetry disabled:

```sh
ASTRO_TELEMETRY_DISABLED=1 npm run build
```

On PowerShell:

```powershell
$env:ASTRO_TELEMETRY_DISABLED='1'; npm run build
```

## Main Features

- Paste `Name: message` chat scripts and parse them into bubbles.
- Switch between WhatsApp-style and Instagram DM-style previews.
- Edit participants, titles, messages, images, reactions, and themes.
- Save drafts locally in the browser.
- Store uploaded images in IndexedDB instead of localStorage.
- Export PNG screenshots.
- Export MP4 video in browsers with WebCodecs H.264 support.

## Project Structure

- `src/pages/index.astro` and `src/pages/editor.astro`: editor entry points.
- `src/pages/render/chat.astro`: hidden render route used by export flows.
- `src/components/editor`: editor controls and export panel.
- `src/components/chat`: platform-specific chat previews and bubbles.
- `src/lib/parser`: script parsing and shared project types.
- `src/lib/state`: Zustand editor state and local draft persistence.
- `src/lib/media`: IndexedDB-backed local media storage.
- `src/lib/export`: PNG and MP4 export helpers.
