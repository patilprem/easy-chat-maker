# Implementation Plan — AI Chat Script to WhatsApp/Instagram Screenshot + MP4 Tool

## Product Summary

Build a simple, free web tool where users paste an AI-generated chat script and convert it into a realistic WhatsApp-style or Instagram DM-style chat mockup.

The user should be able to:

1. Paste a chat script.
2. Convert it into chat bubbles automatically.
3. Select WhatsApp or Instagram style.
4. Edit participants and messages.
5. Add image messages.
6. Add emoji reactions.
7. Export a PNG screenshot.
8. Export an MP4 chat video.

Core promise:

> Paste a chat script → instantly create a realistic chat screenshot or MP4 video → edit everything before export.

This is a creator/mockup tool for memes, reels, skits, storytelling, UI mockups, demos, and educational examples. Do not position it as a deception, fake-proof, impersonation, or fraud tool.

---

## Important V1 Decision

The tool must support **MP4 export**, not only WebM.

However, keep video rendering **client-side** in V1. Do not use Cloudflare Workers for FFmpeg-style video rendering.

Use this V1 strategy:

1. Render the chat animation to a hidden canvas.
2. Generate video frames from the canvas.
3. Try to encode MP4 in browser using WebCodecs + MP4 muxing.
4. Add a fallback path using browser recording + ffmpeg.wasm conversion only if required.
5. Keep the output simple: no audio, no timeline editor, no 4K.

This keeps the app free, serverless, and cheap to host.

---

## Tech Stack

Use this stack for version 1:

- Framework: AstroJS
- Interactive editor: React island inside Astro
- Styling: Tailwind CSS
- Hosting: Cloudflare Workers with static assets
- Language: TypeScript
- Main editor state: Zustand
- Local draft persistence: localStorage
- Local uploaded media storage: IndexedDB
- Database: None in V1
- Login: None in V1
- AI generation inside app: Not required in V1
- Screenshot export: Client-side DOM/canvas export
- MP4 video export: Client-side canvas renderer + MP4 encoder/muxer
- Ads: AdSense later, after content and policy pages are ready

Recommended libraries:

```bash
npm install zustand nanoid html-to-image idb-keyval
```

For MP4 export, use one of these implementation paths:

### Preferred MP4 Path

```bash
npm install mp4-muxer
```

Use:

- Canvas renderer
- WebCodecs `VideoEncoder`
- H.264 codec when available
- MP4 muxer to produce `.mp4`

### Fallback MP4 Path

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

Use this only as a lazy-loaded fallback if WebCodecs MP4 export is not available.

Important:

- Do not load ffmpeg.wasm on initial page load.
- Load it only when the user clicks `Export MP4` and the preferred MP4 path is unsupported.
- Show a progress state because conversion can be slow on mobile.

Do not use server-side FFmpeg, Remotion, Puppeteer, or external rendering in V1.

---

## V1 Scope

### Must Have

- Paste chat script
- Parse speakers and messages automatically
- WhatsApp-style preview
- Instagram DM-style preview
- Edit participant names
- Edit participant usernames
- Edit participant avatars
- Edit messages
- Add text messages
- Add image messages
- Add/delete/reorder messages
- Switch sender side: left/right
- Add emoji reaction to any message
- Remove emoji reaction
- Light/dark theme
- Basic phone preview
- Export PNG screenshot
- Export MP4 video
- Save current draft locally
- Store uploaded images locally in browser
- Reset editor
- Example scripts
- Disclaimer before export
- SEO landing pages
- Privacy Policy page
- Acceptable Use page
- Contact page
- About page

### Not Required in V1

- Login
- User accounts
- Online project saving
- Database
- Payment
- Pro plan
- Complex video timeline editor
- 4K video export
- Server-side video rendering
- AI script generation inside app
- Avatar AI generation
- Official WhatsApp/Instagram logos
- Public share links
- Audio export
- Captions/subtitles

---

## Brand and Safety Positioning

Use copy like:

> Create fictional WhatsApp-style and Instagram DM-style chat screenshots and MP4 videos for content creation, memes, skits, education, demos, and storytelling.

Avoid copy like:

- Fake proof
- Fake evidence
- Trick anyone
- Impersonate someone
- Bypass verification
- Create fake payment proof
- Use as real chat proof

Before export, show this checkbox:

> I understand this is a fictional chat mockup and I will not use it as real evidence, impersonation, fraud, harassment, or to mislead others.

User must check this before PNG or MP4 export.

Add a footer disclaimer:

> This tool creates fictional chat mockups for creative, educational, and design use. It is not affiliated with WhatsApp, Instagram, Meta, or any other platform.

---

## Recommended Project Setup

If starting from scratch:

```bash
npm create cloudflare@latest chat-mockup-tool -- --framework=astro
cd chat-mockup-tool
```

Then add React and Tailwind:

```bash
npx astro add react
npx astro add tailwind
npm install zustand nanoid html-to-image idb-keyval
npm install mp4-muxer
```

Add ffmpeg.wasm only if the first MP4 implementation needs a fallback:

```bash
npm install @ffmpeg/ffmpeg @ffmpeg/util
```

If the Cloudflare template prompts differ, create Astro normally and then configure Cloudflare deployment:

```bash
npm create astro@latest chat-mockup-tool
cd chat-mockup-tool
npx astro add react
npx astro add tailwind
npx astro add cloudflare
npm install zustand nanoid html-to-image idb-keyval mp4-muxer
```

Use TypeScript strict mode.

---

## Cloudflare Deployment Direction

For V1, the app is mostly static with a client-side editor. Deploy it on Cloudflare Workers with static assets.

Expected deployment commands:

```bash
npm run build
npx wrangler deploy
```

Add or update `wrangler.jsonc` as needed:

```jsonc
{
  "name": "chat-mockup-tool",
  "compatibility_date": "2026-06-25",
  "assets": {
    "directory": "./dist"
  }
}
```

If Astro Cloudflare adapter generates a different output structure, follow the generated config.

For V1, do not add D1, R2, KV, Queues, or Workers AI.

Later upgrade path:

- D1: saved projects, templates, user accounts
- R2: uploaded avatars and exported files
- KV: cached templates and feature flags
- Workers AI/API: AI script generation or script cleanup
- External render worker/service: heavy video rendering if needed later

---

## Folder Structure

Create this structure:

```text
src/
  pages/
    index.astro
    editor.astro
    whatsapp-chat-generator.astro
    instagram-dm-generator.astro
    chat-screenshot-generator.astro
    chat-video-generator.astro
    templates.astro
    about.astro
    contact.astro
    privacy-policy.astro
    acceptable-use.astro

  components/
    editor/
      ChatEditorApp.tsx
      ScriptInput.tsx
      PlatformSelector.tsx
      PhonePreview.tsx
      WhatsAppPreview.tsx
      InstagramPreview.tsx
      MessageListEditor.tsx
      MessageEditorRow.tsx
      ParticipantEditor.tsx
      ImageMessageUploader.tsx
      ReactionPicker.tsx
      ExportPanel.tsx
      SafetyExportCheckbox.tsx
      ThemeToggle.tsx
      ExampleScriptButtons.tsx
      VideoExportProgress.tsx

    landing/
      Hero.astro
      ToolSteps.astro
      UseCases.astro
      FeatureGrid.astro
      FAQ.astro
      CTA.astro
      SEOContent.astro

  lib/
    parser/
      parseChatScript.ts
      normalizeScript.ts
      parserTypes.ts

    media/
      mediaStore.ts
      imageUtils.ts
      createObjectUrl.ts

    render/
      canvasRenderer.ts
      renderWhatsappFrame.ts
      renderInstagramFrame.ts
      renderTextBubble.ts
      renderImageBubble.ts
      renderReaction.ts
      renderTypingIndicator.ts

    export/
      exportPng.ts
      exportMp4.ts
      exportMp4WithWebCodecs.ts
      exportMp4WithFfmpegFallback.ts
      videoTimeline.ts
      downloadFile.ts

    state/
      editorStore.ts
      defaultState.ts
      localStorageSync.ts

    templates/
      exampleScripts.ts
      defaultParticipants.ts

    safety/
      safetyCopy.ts
      blockedUseCases.ts

    seo/
      seoConfig.ts

  styles/
    global.css
```

---

## Data Model

Create these TypeScript types:

```ts
export type ChatPlatform = 'whatsapp' | 'instagram';
export type ChatTheme = 'light' | 'dark';
export type MessageSide = 'left' | 'right';
export type MessageStatus = 'sent' | 'delivered' | 'read' | 'seen' | 'none';
export type ChatMessageType = 'text' | 'image';
export type ExportFormat = 'png' | 'mp4';

export interface ChatParticipant {
  id: string;
  name: string;
  username?: string;
  avatarMediaId?: string;
  avatarUrl?: string;
  side: MessageSide;
}

export interface ChatReaction {
  emoji: string;
  position?: 'bottom-left' | 'bottom-right';
}

export interface ChatImageAttachment {
  mediaId: string;
  objectUrl?: string;
  alt?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

export interface ChatMessage {
  id: string;
  participantId: string;
  side: MessageSide;
  type: ChatMessageType;
  text?: string;
  image?: ChatImageAttachment;
  time?: string;
  status?: MessageStatus;
  reaction?: ChatReaction;
}

export interface ChatProject {
  id: string;
  platform: ChatPlatform;
  theme: ChatTheme;
  title: string;
  subtitle?: string;
  participants: ChatParticipant[];
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  exportConsentAccepted: boolean;
}

export interface LocalMediaItem {
  id: string;
  blob: Blob;
  fileName: string;
  mimeType: string;
  createdAt: string;
  width?: number;
  height?: number;
}
```

Important local storage rule:

- Store project JSON in `localStorage`.
- Store uploaded images/avatars in IndexedDB.
- Do not store large base64 images directly in `localStorage`.

---

## Script Input Format

Support this simple format first:

```text
Raj: Bro, Goa plan confirmed?
Amit: 100%
Neha: I already booked my leave.
Raj: Great. So nobody is cancelling this time?
Amit: Actually...
```

Parser rules:

1. Each non-empty line is a message.
2. Format is `Speaker: message`.
3. Speaker name is text before the first colon.
4. Message is text after the first colon.
5. Trim whitespace.
6. Ignore empty lines.
7. If no colon exists, treat the line as a message from the previous speaker.
8. First detected speaker defaults to right side.
9. Other speakers default to left side.
10. User can manually change side later.

For V1, image messages and emoji reactions are primarily added in edit mode.

Optional advanced syntax can be added after the basic parser works:

```text
Raj: Bro, Goa plan confirmed?
Amit: 100%
Neha: [image]
Raj: Nice 😍
Amit: [reaction 😂] Actually...
```

Advanced parser rules if implemented:

- `[image]` creates an image placeholder message that user can upload later.
- `[reaction 😂]` attaches 😂 reaction to the previous or current message, depending on syntax.
- If parser is unsure, create normal text and show a warning instead of failing.

---

## Parser Implementation

Create `src/lib/parser/parseChatScript.ts`.

Expected function:

```ts
export function parseChatScript(input: string): ParsedChatResult
```

Expected output:

```ts
export interface ParsedChatResult {
  participants: ChatParticipant[];
  messages: ChatMessage[];
  warnings: string[];
}
```

Implementation notes:

- Use `nanoid()` for IDs.
- Build participant map by speaker name.
- Assign side based on first speaker = right, others = left.
- Generate basic times if not provided.
- Default parsed messages to `type: 'text'`.
- Do not fail hard. Return warnings for malformed lines.
- Keep parser deterministic and testable.

Example expected result:

```ts
const input = `Raj: Bro, Goa plan confirmed?
Amit: 100%`;

parseChatScript(input);
```

Should return two participants and two messages.

---

## Local Media Storage

Create `src/lib/media/mediaStore.ts`.

Use IndexedDB through `idb-keyval`.

Required functions:

```ts
export async function saveLocalMedia(file: File): Promise<LocalMediaItem>;
export async function getLocalMedia(id: string): Promise<LocalMediaItem | undefined>;
export async function deleteLocalMedia(id: string): Promise<void>;
export async function createMediaObjectUrl(id: string): Promise<string | undefined>;
```

Image handling rules:

- Accept image files only: PNG, JPG, JPEG, WebP.
- Reject files above a safe limit, for example 5 MB.
- Compress/resize large images before storing if needed.
- Store image dimensions.
- Use object URLs for preview.
- Revoke object URLs when not needed.

Image message behavior:

1. User clicks `Add Image Message`.
2. User selects an image.
3. Image is stored in IndexedDB.
4. A new `ChatMessage` is added with `type: 'image'` and `image.mediaId`.
5. Preview renders the image bubble.
6. PNG and MP4 export must include the image.

Avatar behavior:

1. User uploads avatar in participant editor.
2. Avatar is stored in IndexedDB.
3. Participant stores `avatarMediaId`.
4. Preview renders avatar via object URL.

---

## Editor State

Use Zustand.

Create `src/lib/state/editorStore.ts`.

Store actions:

- `setPlatform(platform)`
- `setTheme(theme)`
- `parseAndLoadScript(script)`
- `updateMessage(id, patch)`
- `deleteMessage(id)`
- `duplicateMessage(id)`
- `moveMessage(id, direction)`
- `addTextMessage(participantId?)`
- `addImageMessage(participantId?, file)`
- `replaceMessageImage(messageId, file)`
- `removeMessageImage(messageId)`
- `setMessageReaction(messageId, emoji)`
- `removeMessageReaction(messageId)`
- `updateParticipant(id, patch)`
- `updateParticipantAvatar(id, file)`
- `resetProject()`
- `loadExample(exampleId)`
- `setExportConsentAccepted(value)`
- `hydrateFromLocalStorage()`
- `saveToLocalStorage()`

LocalStorage key:

```ts
const STORAGE_KEY = 'chat-mockup-tool:v1:project';
```

Autosave editor state after changes.

Do not save Blob data in localStorage. Only save media IDs.

---

## Main Editor UX

Desktop layout:

```text
Left panel: Paste script + examples
Center panel: Phone preview
Right panel: Participants + messages + export
```

Mobile layout:

```text
Step 1: Paste Script
Step 2: Edit
Step 3: Preview & Export
```

Use a tabbed interface on mobile.

Primary CTA:

> Generate Chat

Secondary CTAs:

> Export PNG
> Export MP4

---

## Edit Chat Mode

The edit mode is important. Users must be able to refine the AI-generated chat after parsing.

### Message Row Controls

In `MessageListEditor.tsx`, each message row should include:

- Sender dropdown
- Message type selector: Text / Image
- Textarea for text messages
- Image uploader for image messages
- Side toggle: left/right
- Time input
- Status dropdown
- Emoji reaction button
- Delete reaction button
- Delete message button
- Duplicate message button
- Move up/down buttons

Add buttons:

- `Add Text Message`
- `Add Image Message`

### Emoji Reaction UX

Create `ReactionPicker.tsx`.

Keep V1 simple.

Show quick reactions:

```text
❤️ 😂 😮 😢 👍 👎 🔥 😍 👏
```

User flow:

1. User clicks reaction button on a message.
2. Reaction picker opens.
3. User selects emoji.
4. Reaction appears as a small chip attached to that message bubble.
5. User can remove it.

Position rules:

- For right-side messages, reaction chip appears near lower-left or lower-right edge of bubble, whichever looks more natural for the platform.
- For left-side messages, reaction chip appears near lower-right edge of bubble.
- Keep reaction chip visible in PNG and MP4 export.

### Image Message UX

Create `ImageMessageUploader.tsx`.

User flow:

1. User clicks `Add Image Message`.
2. File picker opens.
3. User selects image.
4. Tool adds an image bubble.
5. User can change sender, side, time, status, and reaction.
6. User can replace or remove image.

Image bubble requirements:

- Rounded corners
- Max width similar to chat image bubbles
- Preserve image aspect ratio
- Add time/status overlay for WhatsApp style if needed
- Instagram style should show image inside DM layout cleanly
- Show loading skeleton if object URL is not ready
- Show error if image is missing from IndexedDB

---

## Participant Editing

In `ParticipantEditor.tsx`, allow:

- Edit name
- Edit username
- Change side
- Upload avatar locally
- Remove avatar

Avatar upload in V1:

- Use file input.
- Store in IndexedDB.
- Preview using object URL.
- Do not upload to server.

---

## Phone Preview Requirements

Create a centered phone frame.

Recommended preview dimensions:

- Internal preview ratio: 9:16
- Screenshot export: 1080 x 1920 or scaled equivalent
- MP4 export: 1080 x 1920 by default
- Phone preview can visually render smaller on page but export at high quality

Preview should support:

- Platform switch
- Light/dark mode
- Chat title
- Subtitle/online status
- Participant avatars
- Text bubbles
- Image bubbles
- Emoji reaction chips
- Message time
- Read/seen status

---

## WhatsApp-Style Preview

Build `WhatsAppPreview.tsx`.

Must include:

- Top app/header bar
- Back arrow visual
- Avatar circle
- Contact/group name
- Online/status text
- Chat wallpaper/background
- Left and right bubbles
- Text messages
- Image messages
- Emoji reaction chips
- Message time
- Sent/delivered/read tick visual
- Light/dark theme

Do not use official WhatsApp logo.

Use generic icons or CSS shapes.

Image bubble behavior:

- Right-side image bubble aligns right.
- Left-side image bubble aligns left.
- Rounded image corners.
- Time/tick can be placed in a subtle overlay at bottom-right of image for WhatsApp style.

Reaction behavior:

- Small rounded chip overlapping the bubble edge.
- Chip should have slight shadow or border.
- Keep it platform-inspired but generic.

---

## Instagram DM-Style Preview

Build `InstagramPreview.tsx`.

Must include:

- Top DM header
- Back arrow visual
- Username/title
- Avatar circle
- DM bubbles
- Text messages
- Image messages
- Seen status
- Emoji reaction chips
- Light/dark theme

Do not use official Instagram logo.

Use generic visual styling only.

Image bubble behavior:

- Image appears as rounded DM media bubble.
- For sender messages, align right.
- For received messages, align left.

Reaction behavior:

- Reaction chip appears below/overlapping the selected message.
- Keep reaction visible in exported PNG/MP4.

---

## PNG Export

Create `src/lib/export/exportPng.ts`.

Approach:

1. Give phone preview root an ID/ref.
2. Use `html-to-image` to capture the node.
3. Export as PNG.
4. Download using a generated filename.

Expected API:

```ts
export async function exportPreviewAsPng(node: HTMLElement, filename?: string): Promise<void>
```

Quality requirements:

- Export must not include editor UI.
- Export only phone preview.
- Use 2x pixel ratio if supported.
- Background should not be transparent unless intentionally chosen.
- Text, images, avatars, and emoji reactions must be included.
- Filename example: `chat-mockup-whatsapp.png`.

Before export:

- Check if export consent is accepted.
- If not, show inline error.

---

## MP4 Export

Create `src/lib/export/exportMp4.ts`.

V1 must export an `.mp4` file.

Default video settings:

```ts
export const VIDEO_WIDTH = 1080;
export const VIDEO_HEIGHT = 1920;
export const FPS = 30;
export const TYPING_DURATION_MS = 500;
export const MESSAGE_HOLD_MS = 900;
export const IMAGE_HOLD_MS = 1200;
export const END_HOLD_MS = 1000;
```

Expected API:

```ts
export async function exportChatAsMp4(project: ChatProject): Promise<void>
```

Button label:

```text
Export MP4
```

Export behavior:

1. Check export consent.
2. Prepare all images and avatars from IndexedDB as `HTMLImageElement` or `ImageBitmap`.
3. Create a hidden canvas at 1080x1920.
4. Generate a video timeline.
5. Render frames to canvas.
6. Encode frames into MP4.
7. Download `chat-mockup-video.mp4`.

Video animation:

- Messages appear one by one.
- Show typing indicator before text messages.
- Image messages can fade/slide in.
- Emoji reactions appear shortly after the related message bubble.
- End hold shows final full chat.

No audio in V1.

---

## MP4 Export Architecture

Use two internal implementations.

### 1. Preferred: WebCodecs + MP4 Muxer

Create:

```text
src/lib/export/exportMp4WithWebCodecs.ts
```

Implementation concept:

```ts
export async function exportMp4WithWebCodecs(options: Mp4ExportOptions): Promise<Blob>
```

High-level steps:

1. Check `window.VideoEncoder` support.
2. Create canvas and 2D context.
3. Create `VideoEncoder`.
4. Configure codec.
5. Render each timeline frame to canvas.
6. Convert canvas frame to `VideoFrame`.
7. Encode frame.
8. Add encoded chunks to MP4 muxer.
9. Finalize muxer.
10. Return MP4 Blob.

Pseudo-code:

```ts
const canvas = document.createElement('canvas');
canvas.width = VIDEO_WIDTH;
canvas.height = VIDEO_HEIGHT;
const ctx = canvas.getContext('2d');

const encoder = new VideoEncoder({
  output: (chunk, meta) => {
    // add chunk to muxer
  },
  error: (error) => {
    throw error;
  },
});

encoder.configure({
  codec: 'avc1.42E01E',
  width: VIDEO_WIDTH,
  height: VIDEO_HEIGHT,
  bitrate: 4_000_000,
  framerate: FPS,
});

for (const frame of frames) {
  renderFrameToCanvas(ctx, project, frame);
  const videoFrame = new VideoFrame(canvas, {
    timestamp: frame.timestampMicroseconds,
  });
  encoder.encode(videoFrame);
  videoFrame.close();
}

await encoder.flush();
// finalize muxer and return Blob
```

### 2. Fallback: MediaRecorder + ffmpeg.wasm Conversion

Create:

```text
src/lib/export/exportMp4WithFfmpegFallback.ts
```

Use only if WebCodecs MP4 export is unavailable or fails.

Fallback steps:

1. Render animation to canvas.
2. Use `canvas.captureStream(FPS)`.
3. Record as WebM using MediaRecorder.
4. Lazy-load ffmpeg.wasm.
5. Convert WebM to MP4 in browser.
6. Return MP4 Blob.

Important fallback UX:

- Show `Preparing MP4...`.
- Show `Rendering frames...`.
- Show `Converting to MP4...`.
- Show warning if device is too slow.
- If conversion fails, show a clear error.

Do not silently export WebM when user clicked MP4.

Error copy:

```text
MP4 export could not run in this browser/device. Please try Chrome desktop, Edge desktop, or reduce the number of messages/images.
```

---

## Canvas Renderer

MP4 export should not rely on recording the DOM preview. Create a canvas renderer for video.

Create:

```text
src/lib/render/canvasRenderer.ts
src/lib/render/renderWhatsappFrame.ts
src/lib/render/renderInstagramFrame.ts
src/lib/render/renderTextBubble.ts
src/lib/render/renderImageBubble.ts
src/lib/render/renderReaction.ts
src/lib/render/renderTypingIndicator.ts
```

Why:

- MP4 output becomes more stable.
- Video dimensions are predictable.
- Text, images, and reactions are controlled.
- No browser layout capture issues.

Renderer requirements:

- Draw phone background.
- Draw header.
- Draw avatars.
- Draw visible messages up to current timeline time.
- Draw text bubbles with wrapping.
- Draw image bubbles.
- Draw reaction chips.
- Draw time/status text.
- Draw typing indicator.

Canvas text wrapping:

Create helper:

```ts
export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[]
```

Image rendering:

- Load images as `ImageBitmap` when possible.
- Preserve aspect ratio.
- Clip with rounded rectangle.
- Handle missing images gracefully.

Emoji rendering:

- Use system emoji font stack.
- Keep reaction chips simple.
- Test on Mac/Windows/Android where possible.

---

## Video Timeline

Create `src/lib/export/videoTimeline.ts`.

Expected types:

```ts
export interface VideoFramePlan {
  timeMs: number;
  timestampMicroseconds: number;
  visibleMessageCount: number;
  typingParticipantId?: string;
  reactionMessageIds: string[];
  progress: number;
}

export function createVideoTimeline(project: ChatProject): VideoFramePlan[];
```

Timeline rules:

- For each text message:
  - typing indicator for `TYPING_DURATION_MS`
  - message reveal
  - hold for `MESSAGE_HOLD_MS`
- For each image message:
  - no typing indicator required
  - image reveal
  - hold for `IMAGE_HOLD_MS`
- If message has reaction:
  - show reaction after message appears
  - keep reaction visible for rest of video
- After final message:
  - hold for `END_HOLD_MS`

Keep V1 timeline fixed. No user editing needed.

---

## MP4 Export UX

Create `VideoExportProgress.tsx`.

States:

```ts
export type VideoExportState =
  | 'idle'
  | 'checking-support'
  | 'loading-media'
  | 'rendering'
  | 'encoding'
  | 'converting'
  | 'downloading'
  | 'done'
  | 'error';
```

Progress UI should show:

- Current status
- Progress percentage
- Cancel button if possible
- Error message

Export panel copy:

```text
MP4 export may take a few seconds. For best results, use Chrome or Edge desktop for long chats with images.
```

Keep file size reasonable:

- Default resolution: 1080x1920
- Offer smaller option: 720x1280
- Default bitrate: 4 Mbps for 1080p, 2 Mbps for 720p

Add setting:

```text
Video quality: Standard 720p / High 1080p
```

Do not add 4K in V1.

---

## Example Scripts

Create `src/lib/templates/exampleScripts.ts`.

Add examples:

1. Funny friends plan
2. Office group chat
3. Customer support demo
4. Relationship skit
5. Product testimonial mockup
6. Scam awareness educational example
7. Instagram DM creator collab

Example:

```ts
export const exampleScripts = [
  {
    id: 'friends-trip',
    title: 'Friends Trip Plan',
    platform: 'whatsapp',
    script: `Raj: Goa plan confirmed?
Amit: 100% confirmed.
Neha: I already applied for leave.
Raj: Great. Nobody is cancelling this time, right?
Amit: Actually...`
  }
];
```

---

## SEO Pages

Create these pages in Astro:

1. `/`
2. `/editor`
3. `/whatsapp-chat-generator`
4. `/instagram-dm-generator`
5. `/chat-screenshot-generator`
6. `/chat-video-generator`
7. `/templates`
8. `/acceptable-use`
9. `/privacy-policy`
10. `/about`
11. `/contact`

Each generator page should include:

- Clear H1
- Short intro
- CTA to editor
- Feature list
- How it works section
- Use cases
- FAQ
- Safety disclaimer

Use safe wording.

Example H1s:

- WhatsApp Chat Mockup Generator
- Instagram DM Mockup Generator
- Chat Screenshot Generator
- Chat MP4 Video Generator

SEO title may include common search terms, but page copy should stay creator-focused.

---

## Home Page Structure

Create homepage sections:

1. Hero
2. Paste script → generate preview demo
3. WhatsApp + Instagram supported cards
4. Screenshot and MP4 export explanation
5. Image messages and emoji reactions
6. Use cases
7. Templates
8. Safety section
9. FAQ
10. CTA

Hero copy:

```text
Turn Any Chat Script Into a Screenshot or MP4 Video

Paste an AI-written conversation and create WhatsApp-style or Instagram DM-style chat mockups for reels, memes, demos, storytelling, and UI ideas.
```

CTA:

```text
Create Free Chat Mockup
```

---

## AdSense Readiness

Do not place ads inside the editor for the first release.

Add content depth first:

- Useful FAQs
- How-to pages
- Acceptable use policy
- Privacy policy
- About page
- Contact page
- Templates page

Future ad positions:

- Below hero
- Between SEO content sections
- After export completion
- Blog/template pages
- Desktop sidebar outside editor

Avoid:

- Ads near download buttons
- Ads inside phone preview
- Ads that look like buttons
- Ads blocking the editor
- Too many ads above the fold

---

## Accessibility and UX Requirements

- Fully responsive
- Works on mobile first
- Keyboard accessible form controls
- Clear labels for inputs
- Buttons must have loading states
- Export buttons must show errors clearly
- Text should be readable in dark/light mode
- Do not rely only on color for status
- Keep editor fast and clean
- Image upload controls must have clear labels
- Reaction picker must be keyboard accessible
- Export progress must be visible and understandable

---

## Performance Requirements

- Astro pages should be mostly static.
- Hydrate only the editor island.
- Do not load editor JS on static content pages unless needed.
- Lazy-load heavy export libraries.
- Lazy-load ffmpeg.wasm only when fallback MP4 conversion is needed.
- Keep default avatars small.
- Avoid large background images.
- Use CSS for phone UI, not image-heavy assets.
- Compress or reject very large uploaded images.
- Offer 720p MP4 for slow/mobile devices.

Example lazy import:

```ts
const { toPng } = await import('html-to-image');
```

Example MP4 fallback lazy import:

```ts
const { FFmpeg } = await import('@ffmpeg/ffmpeg');
```

---

## Testing Checklist

### Parser Tests

- Parses simple `Name: message` format
- Handles empty lines
- Handles messages with colon inside text
- Handles lines without colon
- Creates participants correctly
- Assigns first speaker to right side
- Assigns other speakers to left side
- Does not crash on emoji in message text

### Media Tests

- User can upload image message
- User can replace image message
- User can delete image message
- User can upload avatar
- Uploaded images persist after refresh
- Missing media shows graceful fallback
- Oversized image is rejected or compressed

### Reaction Tests

- User can add emoji reaction to text message
- User can add emoji reaction to image message
- User can remove reaction
- Reaction appears correctly in WhatsApp preview
- Reaction appears correctly in Instagram preview
- Reaction appears in PNG export
- Reaction appears in MP4 export

### Editor Tests

- User can paste script and generate chat
- User can edit message text
- User can add text message
- User can add image message
- User can delete message
- User can duplicate message
- User can move message up/down
- User can edit participant name
- User can switch platform
- User can switch theme
- State persists after refresh
- Reset clears localStorage draft

### Export Tests

- PNG exports only phone preview
- PNG works in light and dark themes
- PNG works for WhatsApp style
- PNG works for Instagram style
- PNG includes image messages
- PNG includes emoji reactions
- Export consent is required
- MP4 exports downloadable `.mp4` file
- MP4 works with at least 5 text messages
- MP4 works with image message
- MP4 includes emoji reactions
- MP4 quality setting works for 720p and 1080p
- Long scripts do not crash the page
- MP4 failure shows clear error

### Responsive Tests

- Editor usable on 375px mobile width
- Editor usable on tablet
- Desktop 3-panel layout works
- Export buttons are accessible on mobile
- Reaction picker usable on mobile
- Image upload usable on mobile

---

## Acceptance Criteria

The MVP is complete when:

1. User can open `/editor`.
2. User can paste a chat script.
3. App parses the script into participants and messages.
4. User can choose WhatsApp-style or Instagram DM-style preview.
5. User can edit messages after parsing.
6. User can add text messages.
7. User can add image messages.
8. User can add emoji reactions to messages.
9. User can change names, avatars, and sides.
10. User can switch light/dark mode.
11. User can export a PNG screenshot.
12. User can export an MP4 video.
13. User must accept fictional-use disclaimer before export.
14. Draft is saved locally and restored after refresh.
15. Uploaded local images persist after refresh.
16. Site has required SEO/support pages.
17. App deploys successfully to Cloudflare Workers.
18. No login, database, or payment code is added.

---

## Build Order for Antigravity

Follow this exact build order.

### Step 1 — Setup

- Create Astro project.
- Add React.
- Add Tailwind.
- Add TypeScript strict mode.
- Add Cloudflare deployment config.
- Create base layout and global styles.

### Step 2 — Static Pages

Create:

- Home page
- Editor page
- WhatsApp generator page
- Instagram generator page
- Screenshot generator page
- Video generator page
- Acceptable use page
- Privacy policy page
- About page
- Contact page

Use placeholder content first if needed.

### Step 3 — Core Types and Defaults

Create:

- Chat data types
- Default project state
- Default participants
- Example scripts

### Step 4 — Parser

Build and test parser.

Do not continue until parsing works.

### Step 5 — Zustand Store

Build editor store and localStorage persistence.

### Step 6 — Local Media Storage

Build IndexedDB media storage.

Implement:

- Save image
- Load image
- Delete image
- Create object URL
- Validate image file type and size

### Step 7 — Editor UI

Build:

- Script input panel
- Platform selector
- Theme toggle
- Participant editor
- Message list editor
- Image message uploader
- Reaction picker
- Export panel

### Step 8 — WhatsApp Preview

Build WhatsApp-style preview with CSS.

Must support:

- Text bubbles
- Image bubbles
- Emoji reactions
- Avatars
- Light/dark mode

### Step 9 — Instagram Preview

Build Instagram DM-style preview with CSS.

Must support:

- Text bubbles
- Image bubbles
- Emoji reactions
- Avatars
- Light/dark mode

### Step 10 — PNG Export

Add client-side PNG export.

Verify text, images, avatars, and emoji reactions export correctly.

### Step 11 — Canvas Renderer for MP4

Build canvas renderer.

Do not start MP4 encoding until the renderer can draw:

- WhatsApp frame
- Instagram frame
- Header
- Text messages
- Image messages
- Emoji reactions
- Typing indicator

### Step 12 — MP4 Export

Build MP4 export.

Order:

1. Create video timeline.
2. Render frames to canvas.
3. Try WebCodecs + MP4 muxer.
4. Add ffmpeg.wasm fallback only if needed.
5. Add progress UI.
6. Download `.mp4`.

Do not export WebM as final output when button says MP4.

### Step 13 — Polish

- Empty states
- Loading states
- Error states
- Mobile tabs
- Better spacing
- Better preview sizing
- Better export progress
- Image upload errors
- Reaction picker polish

### Step 14 — SEO Content and Safety

- Complete FAQ content
- Complete acceptable use page
- Complete privacy policy
- Add disclaimer near export
- Add safe product positioning

### Step 15 — Deploy

- Build project
- Test locally
- Deploy to Cloudflare Workers
- Verify all routes work
- Verify PNG export works after deployment
- Verify MP4 export works after deployment
- Verify image messages and reactions work after deployment

---

## Antigravity Execution Prompt

Use this prompt inside Antigravity:

```text
You are building a production-ready MVP of a free AI chat script to chat screenshot/MP4 video generator.

Use AstroJS with React islands, TypeScript, Tailwind CSS, and Cloudflare Workers/static assets deployment.

Build a tool where the user can paste a simple chat script in the format "Name: message", parse it into participants and messages, preview it as either a WhatsApp-style chat or Instagram DM-style chat, edit the messages, edit participants, switch light/dark mode, add image messages, add emoji reactions, and export the result as a PNG screenshot or MP4 video.

Do not build login, database, payments, AI generation, server-side video rendering, server-side FFmpeg, Remotion, Puppeteer, or user accounts in V1.

Use browser localStorage for draft/project metadata. Use IndexedDB for uploaded local images and avatars. Do not store large base64 images in localStorage.

MP4 export is required. Implement it client-side. Preferred path: render chat frames to a hidden canvas, encode using WebCodecs VideoEncoder, and mux into MP4. Add a lazy-loaded ffmpeg.wasm fallback only if WebCodecs MP4 export is not available or fails. The final export button must download an .mp4 file, not WebM.

Before export, require the user to accept a fictional-use disclaimer. The product must be positioned as a fictional chat mockup generator for creative, educational, storytelling, UI mockup, and demo use. Do not position it as a deception, impersonation, or fake-proof tool.

Follow the implementation.md file exactly. Build in phases. Do not skip parser, localStorage, IndexedDB media storage, image messages, emoji reactions, PNG export, MP4 export, responsive layout, SEO pages, privacy policy, acceptable use page, and Cloudflare deployment config.

After each phase, run build checks and fix TypeScript/lint errors before continuing.
```

---

## Future V2 Ideas

Add only after V1 gets traffic:

- AI chat script generator
- More platforms
- Saved projects with D1
- Uploaded media with R2
- Template library
- Public share links
- MP4 server rendering for long videos
- Audio/music support
- Captions/subtitles
- Watermark removal
- Pro plan
- Brand kits for marketers
- Bulk carousel export

---

## Final Rule

Keep V1 small.

The product should feel magical because of one thing:

> Paste script → instant realistic chat preview → edit text/images/reactions → export PNG or MP4.

Do not overbuild before validating SEO traffic and user demand.
