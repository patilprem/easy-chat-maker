import { DurableObject } from 'cloudflare:workers';

/**
 * Export analytics: a single Durable Object keeps exact counters, the Worker
 * exposes them via two endpoints and passes every other request through to
 * the static site assets.
 *
 *   POST /api/event  {"format":"mp4","platform":"whatsapp"}  → count one export
 *   GET  /api/stats                                          → all counters as JSON
 */

const NAME_RE = /^[a-z0-9_-]{1,32}$/i;

function sanitize(value) {
  return typeof value === 'string' && NAME_RE.test(value) ? value.toLowerCase() : 'unknown';
}

export class ExportCounter extends DurableObject {
  async increment(format, platform) {
    const day = new Date().toISOString().slice(0, 10);
    const keys = ['total', `format:${format}`, `platform:${platform}`, `day:${day}`];
    for (const key of keys) {
      const current = (await this.ctx.storage.get(key)) ?? 0;
      await this.ctx.storage.put(key, current + 1);
    }
  }

  async stats() {
    const entries = await this.ctx.storage.list();
    const stats = { total: 0, byFormat: {}, byPlatform: {}, byDay: {} };
    for (const [key, value] of entries) {
      if (key === 'total') stats.total = value;
      else if (key.startsWith('format:')) stats.byFormat[key.slice(7)] = value;
      else if (key.startsWith('platform:')) stats.byPlatform[key.slice(9)] = value;
      else if (key.startsWith('day:')) stats.byDay[key.slice(4)] = value;
    }
    return stats;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/event' && request.method === 'POST') {
      let body = {};
      try {
        body = await request.json();
      } catch {
        // sendBeacon may deliver an opaque body; count it as unknown
      }
      const counter = env.EXPORT_COUNTER.get(env.EXPORT_COUNTER.idFromName('global'));
      await counter.increment(sanitize(body.format), sanitize(body.platform));
      return Response.json({ ok: true });
    }

    if (url.pathname === '/api/stats' && request.method === 'GET') {
      const counter = env.EXPORT_COUNTER.get(env.EXPORT_COUNTER.idFromName('global'));
      return Response.json(await counter.stats(), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return env.ASSETS.fetch(request);
  },
};
