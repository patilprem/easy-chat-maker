/**
 * Fire-and-forget export counter. Best-effort only — tracking must never
 * affect the export flow, and it silently does nothing in local dev where
 * the Worker endpoint doesn't exist.
 */
export function trackExport(format: 'png' | 'mp4', platform: string): void {
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
