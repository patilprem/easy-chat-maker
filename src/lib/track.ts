/**
 * Editor funnel analytics.
 *
 * Two sinks, deliberately:
 *
 *  - GA4 (`gtag`) gets every funnel step, so exports can finally be segmented
 *    by the dimensions only GA4 knows — channel, country, device, landing page.
 *    The tag is only injected in production builds (see Layout.astro), so on a
 *    local `npm run dev` session every GA4 call is a silent no-op.
 *
 *  - The Worker's Durable Object counter (`/api/event`) keeps the exact export
 *    totals behind /stats. Only *completed* exports go there and the payload
 *    shape is unchanged, so those counters stay comparable with their own
 *    history — and they keep working for the visitors whose ad-blocker eats
 *    GA4 entirely.
 *
 * Tracking must never affect the editor: every call is wrapped and all
 * failures are swallowed.
 */

export type ExportFormat = 'png' | 'mp4';

type EventParams = Record<string, string | number | undefined>;

declare global {
  interface Window {
    gtag?: (command: 'event', name: string, params?: EventParams) => void;
  }
}

function ga(event: string, params: EventParams = {}): void {
  try {
    window.gtag?.('event', event, params);
  } catch {
    // never let tracking break the app
  }
}

/** Count one export in the Durable Object behind /stats. */
function countExportOnWorker(format: ExportFormat, platform: string): void {
  try {
    const payload = JSON.stringify({ format, platform });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/event', new Blob([payload], { type: 'application/json' }));
    } else {
      fetch('/api/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {
    // never let tracking break the app
  }
}

/**
 * Step 1 — the editor loaded. `entry` distinguishes a plain /editor visit from
 * one deep-linked by a landing page, which is how we find out whether the
 * platform pages send people who go on to actually export.
 */
export function trackEditorOpened(platform: string, entry: 'direct' | 'scenario' | 'platform_link'): void {
  ga('editor_opened', { platform, entry });
}

/** Step 1b — a preset or a landing-page scenario populated the editor. */
export function trackTemplateLoaded(kind: 'preset' | 'scenario', templateId: string, platform: string): void {
  ga('template_loaded', { kind, template_id: templateId, platform });
}

/** Step 2 — a script was parsed into an actual chat. The core "did they build something" step. */
export function trackChatGenerated(platform: string, messageCount: number): void {
  ga('chat_generated', { platform, message_count: messageCount });
}

/**
 * Step 3 — the fiction-consent checkbox was ticked. Both export buttons stay
 * `disabled` until it is, so a visitor who never ticks it can never export and
 * never produces a click to measure. Tracking the tick itself is the only way
 * to see that drop-off.
 */
export function trackConsentAccepted(platform: string): void {
  ga('consent_accepted', { platform });
}

/**
 * `variant` carries which flavour of the export ran: the scope for PNG
 * ('preview' | 'full'), and which of the three renderers actually produced the
 * file for MP4 ('recorder' | 'composite' | 'frames').
 */

/** Step 4 — an export was requested. Paired with completed/failed to expose the real success rate. */
export function trackExportStarted(format: ExportFormat, platform: string, variant?: string): void {
  ga('export_started', { format, platform, variant });
}

/** Step 5 — the file reached the user. Mark this as a key event in GA4. */
export function trackExportCompleted(format: ExportFormat, platform: string, variant?: string): void {
  ga('export_completed', { format, platform, variant });
  countExportOnWorker(format, platform);
}

/**
 * Step 5 (failure) — the export threw. Worth its own event: the MP4 path falls
 * back through three renderers, so a silent failure rate here would otherwise
 * be invisible.
 */
export function trackExportFailed(format: ExportFormat, platform: string, reason: string): void {
  // GA4 truncates param values at 100 chars; do it here so the value we send
  // is the value we see in reports.
  ga('export_failed', { format, platform, reason: reason.slice(0, 100) });
}
