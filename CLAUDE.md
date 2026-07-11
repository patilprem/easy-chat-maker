# Easy Chat Maker — project notes for Claude

## Workflow rules (user preference — keep it simple)

- The user runs the app on Windows by double-clicking `Run App.bat`, which does
  `git checkout main && git pull origin main` and then `npm run dev`.
- Because of that, **finished work must always end up on `main`**: after the
  user approves a change, merge the working branch into `main` (fast-forward
  when possible) and push, so `Run App.bat` picks it up with no extra steps.
- Never ask the user to edit `Run App.bat`, switch branches, or run git
  commands manually — they want the simple approach: pull `main`, double-click,
  done.
- `Send Photos.bat` is also part of the user's local workflow; don't break or
  rename either .bat file.

## Environment quirks

- In the remote/cloud container, install dependencies with
  `npm install --ignore-scripts` — the `ffmpeg-static` postinstall download is
  blocked by the proxy (403). ffmpeg is only needed for local video export on
  the user's machine, not for the dev server.
- Start the dev server with `npm run dev` (Astro, port 4321). The Astro config
  already binds all interfaces and allows forwarded hosts.
- Set the git identity before committing:
  `git config user.email noreply@anthropic.com && git config user.name Claude`.

## Deployment (live site)

- Production site: **https://easychatmaker.com** (+ www), served by a
  Cloudflare **Worker** with static assets (`wrangler.jsonc` points at
  `dist/`). Preview URL: easy-chat-maker.silverhexagon-co.workers.dev.
- Deploys automatically on every push to `main` (Cloudflare Workers Builds,
  GitHub integration; build `npm run build`, deploy `npx wrangler deploy`).
  So pushing to `main` updates BOTH the user's local Run App.bat workflow and
  the live website.
- Domain registered at GoDaddy; DNS + nameservers on Cloudflare (free plan).
- Note: this remote container's network policy blocks requests to
  workers.dev / easychatmaker.com, so live-site checks must be done by the
  user in their browser.

## Project shape

- Astro 4 + React + Tailwind. Landing page: `src/pages/index.astro` (folds:
  hero, how-it-works, use-cases, platforms, why, faq — header anchor links
  scroll to them). Editor app: `src/pages/editor.astro` →
  `src/components/editor/ChatEditorApp.tsx`.
