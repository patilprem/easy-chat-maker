# Reddit "I built this" Posts (crafted, non-spammy)

Ready-to-post Reddit content, each grounded in a real user pain point and
written to read as a person — not a campaign. Companion to
`REDDIT-QUORA-EXECUTION.md` (which covers Quora answers + reply templates).

**Golden rules so this never looks like spam:**
- One post every 2–3 days, max. Five posts in one week from one account = shadowban risk.
- Each post below uses a **different angle** on purpose (build-story → cool-link →
  engineering → creator-tips → AI-niche) so your post history reads like a human.
- Reply to **every** comment, ideally within the hour. Replies rank the post and
  are a second natural touchpoint.
- Skip any sub where your last post is under ~2 weeks old.
- Read each sub's self-promo rules first. Strict subs: link in a follow-up
  comment + "(disclosure: I built the tool I mentioned)".

The honest wedge (from researching what's actually out there): tons of free
WhatsApp generators exist, but they watermark/paywall **video** export or don't
do it at all — and almost none do **AI chats** (ChatGPT/Claude/Gemini). Lead
with that gap, not with a feature dump.

---

## Post 1 — r/SideProject
*Build-story + feedback ask. This sub rewards the "why I built it" narrative.*

**Title:**
> I got tired of every fake-chat generator watermarking the video export, so I built one that doesn't

**Body:**
> I needed a fake WhatsApp conversation for a product demo a few months back. Every tool I tried did one of three things: slapped a watermark across the export, hid video behind a paywall, or looked nothing like the actual app. The ones that were free and clean only did static screenshots — the second I wanted an animated "texting story" video, it was upgrade-to-pro.
>
> So I built **Easy Chat Maker**: easychatmaker.com
>
> You type the conversation like a script, and it renders a pixel-accurate chat you can export as a PNG *or* an animated video with typing bubbles. What I focused on:
> - **No watermark, no signup** — the whole thing runs in your browser, nothing gets uploaded to a server
> - **9 platforms** — WhatsApp, Instagram, Messenger, Telegram, Discord, Slack, and the AI ones (ChatGPT, Claude, Gemini) that basically no other tool does
> - **Both outputs** — screenshot for memes/demos, video for TikTok/Reels/Shorts
>
> Stack, since this sub asks: Astro + React + Tailwind, zustand for state, and the video is rendered fully client-side with mp4-muxer — no backend at all.
>
> I'd genuinely love feedback on two things: (1) is there a platform you'd want that I'm missing, and (2) does the video export feel smooth on your machine? The client-side rendering is the part I'm least sure holds up across devices.

---

## Post 2 — r/InternetIsBeautiful
*Strict sub: it wants a genuinely-cool link and a plain description, zero marketing tone. No "I built," no feature-dump.*

**Title:**
> A free site where you type a conversation and it renders a pixel-perfect chat screenshot — or an animated video — for 9 apps including ChatGPT and Claude

**Body (this sub prefers a link post + one short comment):**
> Pick a platform (WhatsApp, Instagram, Discord, Slack, Telegram, Messenger, ChatGPT, Claude, Gemini), type out a conversation, and it renders it exactly like the real app — then exports a screenshot or a video where the messages animate in one by one. No watermark, no signup, and it all runs locally in your browser so nothing you type gets uploaded anywhere.

*In the first comment, add the disclosure: "(full disclosure, I made this) — happy to answer how the in-browser video rendering works."*

---

## Post 3 — r/webdev (or r/reactjs)
*Technical angle. This crowd is allergic to marketing but loves a "how I solved X" post. The link is incidental to the engineering story — which is exactly why it won't read as spam.*

**Title:**
> Rendering MP4 video entirely client-side (no backend, no ffmpeg.wasm) — how I built a chat-story video exporter

**Body:**
> I built a tool that turns a scripted chat into an animated video — the "texting story" format, messages typing in one at a time. The interesting constraint I set myself: **no backend, nothing uploaded**. Everything, including the video encode, happens in the browser.
>
> The approach that ended up working:
> - Animate the chat in a canvas frame-by-frame (message reveal, typing indicator, auto-scroll)
> - Capture each frame and feed it to **mp4-muxer** to mux an H.264 MP4 in-memory
> - Hand the user a Blob download — the server never sees a single message
>
> I went this route instead of ffmpeg.wasm (too heavy to ship) or a server render (privacy + cost). The tradeoff is that encode speed is at the mercy of the user's machine, which is the part I'm still tuning.
>
> Live if you want to poke at it: easychatmaker.com — Astro + React + Tailwind + zustand. Happy to go deeper on the frame-capture pipeline if anyone's built something similar; curious how others handled the canvas→encoder throughput problem.

*Post this to r/webdev's "Showoff Saturday" thread if they have one — it sidesteps the self-promo rule entirely.*

---

## Post 4 — r/NewTubers / r/Tiktokhelp
*Value-first post. Answer the question the whole sub is asking, mention the tool as "what I use." Least spammy format because it earns its place before it links.*

**Title:**
> If you're making the "texting story" videos, you don't need CapCut + a TTS voice + gameplay footage — here's the faster way

**Body:**
> I kept seeing people stitch these together the hard way: write a script, run it through ElevenLabs for a voice, drop Minecraft/Subway Surfers gameplay behind it in CapCut, then auto-caption. That works, but it's a lot of steps for the *chat* format specifically — where the whole appeal is watching the conversation type itself out.
>
> For the pure texting-story look (bubbles appearing one by one, typing indicator, the little sounds), a dedicated chat-story generator skips all of that. You script both sides of the conversation and it exports a 9:16 MP4 ready for TikTok/Reels/Shorts. I use easychatmaker.com/chat-story-video-maker — it's free and doesn't watermark, which is why I switched to it.
>
> Two things that matter more than the tool, from posting a bunch of these:
> 1. **Open on the most dramatic message.** The first 1.5 seconds decide your retention. Don't start with "hey" — start with "wait, you did WHAT."
> 2. **Keep it under 45 seconds.** These live or die on completion rate.
>
> And keep the story clearly fictional — the format is fine, passing a fake off as a real conversation is where people get into trouble.

*If the sub is strict about links, drop the URL in a follow-up comment with "(disclosure: I built the tool I mentioned)."*

---

## Post 5 — r/ChatGPT / r/OpenAI (optional, high-relevance)
*The AI-chat mockup is your rarest differentiator — lean into it where the audience already cares.*

**Title:**
> Made a tool for mocking up ChatGPT/Claude/Gemini conversations for slides and tutorials (without screenshotting real chats)

**Body:**
> When I put AI conversations in a slide deck or a tutorial, screenshotting the real thing is a pain — you fight with cropping, dark mode, and private stuff in the sidebar, and if you need to tweak the wording you have to redo the whole prompt.
>
> So I made a mockup generator: you write both sides of the conversation and it renders a clean, pixel-accurate ChatGPT (or Claude, or Gemini) screenshot you can drop straight into a deck. Free, no watermark, no signup — easychatmaker.com/fake-chatgpt-conversation-generator
>
> Obvious caveat, and I'd say this in the post itself: **label it as a mockup** if there's any chance someone reads it as a real model output. It's for illustration, not for faking that an AI said something it didn't.

---

## Posting log (fill in — never double-post)

| Date | Subreddit | Post | Link placement | Status |
|---|---|---|---|---|
| | r/SideProject | "watermarking the video export" | in body | |
| | r/InternetIsBeautiful | "type a conversation → pixel-perfect" | first comment | |
| | r/webdev | "Rendering MP4 client-side" | in body / Showoff Saturday | |
| | r/NewTubers | "you don't need CapCut + TTS" | body or comment | |
| | r/ChatGPT | "mocking up ChatGPT/Claude/Gemini" | in body | |

## Suggested cadence (paced so it never reads as a campaign)

- **Week 1:** Post 1 (r/SideProject).
- **Week 2:** Post 4 (r/NewTubers) mid-week, Post 2 (r/InternetIsBeautiful) weekend.
- **Week 3:** Post 3 (r/webdev, ideally Showoff Saturday).
- **Week 4:** Post 5 (r/ChatGPT).
- Reply to every comment same-day. One post every 2–3 days, never more.
