import { DurableObject } from 'cloudflare:workers';

/**
 * Export analytics: a single Durable Object keeps exact counters, the Worker
 * exposes them via two endpoints and passes every other request through to
 * the static site assets.
 *
 *   POST /api/event  {"format":"mp4","platform":"whatsapp"}  → count one export
 *   GET  /api/stats                                          → all counters as JSON
 *   GET  /stats                                              → dashboard page
 *
 * When the STATS_KEY secret is set, /stats and /api/stats are private:
 * requests need ?key=<STATS_KEY> once (a cookie remembers it) and anything
 * unauthorized sees the regular 404 page, as if the page didn't exist.
 * /api/event stays open — it only increments counters.
 */

const NAME_RE = /^[a-z0-9_-]{1,32}$/i;
const KEY_COOKIE = 'ecm_stats_key';

function sanitize(value) {
  return typeof value === 'string' && NAME_RE.test(value) ? value.toLowerCase() : 'unknown';
}

function isAuthorized(request, env) {
  if (!env.STATS_KEY) return true; // secret not configured yet — stays open until it is
  const url = new URL(request.url);
  if (url.searchParams.get('key') === env.STATS_KEY) return true;
  const cookies = request.headers.get('Cookie') ?? '';
  const match = cookies.match(new RegExp(`(?:^|;\\s*)${KEY_COOKIE}=([^;]+)`));
  return !!match && decodeURIComponent(match[1]) === env.STATS_KEY;
}

function notFound(request, env, url) {
  // Serve the site's regular 404 so the page is indistinguishable from
  // one that doesn't exist.
  return env.ASSETS.fetch(new Request(new URL('/__no_such_page__', url), request));
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
      if (!isAuthorized(request, env)) return notFound(request, env, url);
      const counter = env.EXPORT_COUNTER.get(env.EXPORT_COUNTER.idFromName('global'));
      return Response.json(await counter.stats(), {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    if (url.pathname === '/stats' || url.pathname === '/stats/') {
      if (!isAuthorized(request, env)) return notFound(request, env, url);
      const assetResponse = await env.ASSETS.fetch(request);
      if (env.STATS_KEY && url.searchParams.get('key') === env.STATS_KEY) {
        // Remember the key so subsequent visits and the page's /api/stats
        // fetch work without it in the URL.
        const response = new Response(assetResponse.body, assetResponse);
        response.headers.append(
          'Set-Cookie',
          `${KEY_COOKIE}=${encodeURIComponent(env.STATS_KEY)}; Path=/; Max-Age=2592000; Secure; HttpOnly; SameSite=Lax`
        );
        return response;
      }
      return assetResponse;
    }

    return env.ASSETS.fetch(request);
  },
};
