import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Clipboard, PenLine } from 'lucide-react';
import { useEditorStore } from '../../lib/state/editorStore';

const PREMADE_SCRIPTS = [
  {
    id: 'deadline-rescue',
    title: 'Deadline Rescue',
    subtext: 'Private chat',
    self: 'Nora',
    script: `Date: Today
Maya: Are you still awake?
Nora: Barely. The client deck is fighting back.
Maya: Send me the messy version. I can clean slides 4 and 5.
Reaction: 🙌
Nora: You are saving my entire week.
Maya: Coffee tomorrow. You owe me.
Nora: Deal. Large one ☕`,
  },
  {
    id: 'launch-room',
    title: 'Launch Room',
    subtext: 'Group chat',
    self: 'Aisha',
    script: `System: Aisha created group "Launch Room 🚀"
System: Aisha added Mateo, Priya, Kenji
Date: Monday
Aisha: Morning team, quick launch check-in before everyone disappears into meetings.
Mateo: Landing page is ready. I just need final hero copy.
Priya: I can send that in 20 minutes. Keeping it short and clear.
Reaction: 🔥
Kenji: Payment test passed in Japan and Germany. No weird currency issue this time.
Aisha: Perfect. Mateo, can you plug Priya's copy once it lands?
Mateo: Yes. Also added the mobile screenshots.
Priya: Nice. Can we announce at 3 pm UTC so it works for most regions?
Kenji: Works for me. That is midnight here, but I will survive 😄
Aisha: You are a legend. I will schedule the post for 3 pm UTC.
Reaction: 🙌
System: Aisha added Lina
Lina: Just joined. Do you need social captions?
Aisha: Yes please. Two lines, friendly tone, no buzzwords.
Lina: My favorite kind of brief. Sending options now ✨
Mateo: This launch is starting to look real.`,
  },
];

const RESERVED_SCRIPT_SPEAKERS = new Set(['system', 'date', 'day', 'reaction', 'react']);

const PROMPT_TEMPLATE = `Create a realistic chat script for Easy Chat Maker.

Return only script lines in this exact format:
Name: message
System: event text
Date: Today
Reaction: emoji

Rules:
- Use real character names, never "You:".
- Put exactly one speaker name before each colon.
- Use "System:" for group created, added person, or changed photo events.
- Use "Date:" for day/date chips.
- Use "Reaction:" immediately after the message it reacts to.
- Keep messages natural, short, and varied.
- Do not use markdown, bullets, scene notes, or explanations.

Conversation idea:
[Describe the private or group chat you want here]

Preferred sender / my character:
[Write one character name here]`;

function getScriptCharacters(script: string): string[] {
  const seen = new Set<string>();
  const characters: string[] = [];

  for (const rawLine of script.split('\n')) {
    const line = rawLine.trim();
    const colonIdx = line.indexOf(':');
    if (colonIdx <= 0) continue;

    const speaker = line.slice(0, colonIdx).trim();
    if (RESERVED_SCRIPT_SPEAKERS.has(speaker.toLowerCase())) continue;
    if (!speaker || seen.has(speaker)) continue;
    seen.add(speaker);
    characters.push(speaker);
  }

  return characters;
}

export const ScriptPanel: React.FC = () => {
  const {
    scriptInput, setScriptInput, parseAndLoad,
    warnings,
  } = useEditorStore();

  const [localScript, setLocalScript] = useState(scriptInput);
  const characters = useMemo(() => getScriptCharacters(localScript), [localScript]);
  const [selfSpeaker, setSelfSpeaker] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    if (characters.length === 0) {
      setSelfSpeaker('');
      return;
    }

    setSelfSpeaker((current) => (
      current && characters.includes(current) ? current : characters[0]
    ));
  }, [characters]);

  const updateScript = (script: string, self = '') => {
    setLocalScript(script);
    setScriptInput(script);
    setSelfSpeaker(self || (getScriptCharacters(script)[0] ?? ''));
  };

  const handleGenerate = () => {
    setScriptInput(localScript);
    parseAndLoad(localScript, selfSpeaker);
  };

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT_TEMPLATE);
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 1400);
    } catch {
      setCopiedPrompt(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PenLine size={16} className="text-[#60EFFF]" />
          <span className="text-white font-semibold text-sm">Script</span>
        </div>
        <button
          onClick={handleCopyPrompt}
          className="flex items-center gap-1.5 rounded-lg border border-[#60EFFF]/25 bg-[#60EFFF]/10 px-2.5 py-1.5 text-xs font-semibold text-[#60EFFF] hover:bg-[#60EFFF]/15 transition-colors"
        >
          {copiedPrompt ? <Check size={13} /> : <Clipboard size={13} />}
          {copiedPrompt ? 'Copied' : 'Copy Prompt Template'}
        </button>
      </div>

      <textarea
        value={localScript}
        onChange={(e) => updateScript(e.target.value, selfSpeaker)}
        placeholder={`Paste your script here...\n\nFormat:\nAlex: Are we still meeting today?\nMaya: Yes, 3 pm works for me`}
        className="w-full h-56 md:h-[34vh] md:max-h-[310px] bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-white/30 resize-none outline-none focus:border-[#00FF87]/70 transition-colors font-mono"
      />

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-medium">Your character</label>
        <div className="relative">
          <select
            value={selfSpeaker}
            onChange={(e) => setSelfSpeaker(e.target.value)}
            disabled={characters.length === 0}
            className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg pl-3 pr-11 py-1.5 text-white text-sm outline-none focus:border-[#00FF87]/70 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {characters.length === 0 ? (
              <option value="" className="bg-gray-900 text-white">Add script characters first</option>
            ) : (
              characters.map((name) => (
                <option key={name} value={name} className="bg-gray-900 text-white">
                  {name}
                </option>
              ))
            )}
          </select>
          <ChevronDown
            size={15}
            strokeWidth={2.2}
            className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#60EFFF]/70"
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={!localScript.trim() || characters.length === 0}
        className="w-full py-2 rounded-xl bg-gradient-to-r from-[#00FF87] to-[#60EFFF] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-[#061116] text-sm font-semibold transition-all"
      >
        Generate Chat
      </button>

      <div className="space-y-2">
        <div>
          <h3 className="text-white font-semibold text-sm">Premade Scripts</h3>
          <p className="text-white/40 text-xs mt-0.5">Pick one, then edit the script above.</p>
        </div>

        <div className="grid gap-2">
          {PREMADE_SCRIPTS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => updateScript(preset.script, preset.self)}
              className="text-left rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-3 py-2 transition-colors"
            >
              <div className="text-white text-sm font-semibold">{preset.title}</div>
              <div className="text-white/45 text-xs mt-0.5">{preset.subtext}</div>
            </button>
          ))}
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-2 text-yellow-300 text-xs space-y-0.5">
          {warnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}
    </div>
  );
};
