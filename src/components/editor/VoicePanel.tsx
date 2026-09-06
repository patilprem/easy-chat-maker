import React, { useMemo, useState } from 'react';
import { Loader2, Mic, Volume2 } from 'lucide-react';
import { useEditorStore } from '../../lib/state/editorStore';
import { ttsCapability } from '../../lib/tts/capability';
import { TTS_VOICES, assignVoicesForParticipants } from '../../lib/tts/voices';
import { speak } from '../../lib/tts/kokoro';
import { playClip } from '../../lib/tts/clipPlayback';
import type { ChatProject } from '../../lib/parser/types';

interface Props {
  project: ChatProject;
}

/**
 * Story-mode AI voiceover settings. Kokoro-82M runs entirely in the
 * browser (see lib/tts/kokoro.ts) — no server, no per-export cost — but its
 * ~86MB model download and ~340MB working set make it a desktop-first
 * feature, so this panel leads with a capability check rather than letting
 * a low-memory device discover the failure mid-export.
 */
export const VoicePanel: React.FC<Props> = ({ project }) => {
  const { setStoryVoiceEnabled, setParticipantVoice, setStoryVoiceSpeed } = useEditorStore();
  const voice = project.story?.voice;
  const enabled = voice?.enabled ?? false;
  const cap = useMemo(() => ttsCapability(voice?.preferWebGpu), [voice?.preferWebGpu]);

  const speakers = useMemo(
    () => project.participants.filter((p) => project.messages.some((m) => m.kind === 'text' && m.participantId === p.id)),
    [project.participants, project.messages],
  );
  // Assigned once across every speaker so nobody silently shares a voice
  // with someone else in the same chat (see assignVoicesForParticipants).
  const defaultVoices = useMemo(() => assignVoicesForParticipants(speakers), [speakers]);

  // Generates the SAME Kokoro clip the export would produce for this voice
  // and plays it back — so "test" answers "is this really what will be in
  // my video?" instead of approximating it with the device's own TTS.
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testPct, setTestPct] = useState<number | null>(null);
  const handleTest = async (name: string, participantId: string, voiceId: string) => {
    if (testingId) return;
    setTestingId(participantId);
    setTestPct(null);
    try {
      const clip = await speak(cap.device, `Hi, this is ${name}.`, voiceId, voice?.speed ?? 1, (p) => {
        if (p.status === 'downloading') setTestPct(p.pct);
      });
      await playClip(clip);
    } catch (err) {
      console.error('Voice test failed', err);
    } finally {
      setTestingId(null);
      setTestPct(null);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          disabled={!cap.ok}
          onChange={(e) => setStoryVoiceEnabled(e.target.checked)}
          className="h-3.5 w-3.5 flex-shrink-0 rounded accent-[#00FF87] disabled:opacity-40"
        />
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-white/80">
          <Mic size={12} className="text-[#60EFFF]" />
          AI voiceover (free)
        </span>
      </label>

      {!cap.ok && (
        <p className="text-[10.5px] text-white/35">{cap.reason}</p>
      )}

      {cap.ok && enabled && (
        <div className="space-y-3 pt-1">
          <p className="text-[10px] text-white/30">
            Preview and 🔊 test both generate the exact same AI audio that gets baked into the exported video — not an approximation. The first time (per device) downloads a one-time voice model; every clip is cached after that, so repeats are instant.
          </p>

          {speakers.length === 0 && (
            <p className="text-[10.5px] text-white/35">Add some text messages to choose voices.</p>
          )}

          {speakers.map((p) => {
            const value = voice?.voices[p.id] ?? defaultVoices[p.id];
            const isTesting = testingId === p.id;
            return (
              <label key={p.id} className="flex items-center gap-2">
                <span className="w-16 flex-shrink-0 truncate text-[11px] text-white/50">{p.name}</span>
                <select
                  value={value}
                  onChange={(e) => setParticipantVoice(p.id, e.target.value)}
                  className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-white/85"
                >
                  <optgroup label="American">
                    {TTS_VOICES.filter((v) => v.accent === 'US').map((v) => (
                      <option key={v.id} value={v.id}>{v.label} ({v.gender})</option>
                    ))}
                  </optgroup>
                  <optgroup label="British">
                    {TTS_VOICES.filter((v) => v.accent === 'UK').map((v) => (
                      <option key={v.id} value={v.id}>{v.label} ({v.gender})</option>
                    ))}
                  </optgroup>
                </select>
                <button
                  type="button"
                  title="Generate and hear the exact exported voice"
                  disabled={testingId !== null}
                  onClick={() => handleTest(p.name, p.id, value)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:border-white/25 hover:text-white disabled:opacity-40"
                >
                  {isTesting ? (
                    testPct !== null
                      ? <span className="text-[8.5px] tabular-nums leading-none">{testPct}%</span>
                      : <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Volume2 size={13} />
                  )}
                </button>
              </label>
            );
          })}
          <p className="text-white/25 text-[10px] -mt-1">
            Tap 🔊 to generate that line for real and hear it — confirms a voice change took effect with the actual export audio, not a guess.
          </p>

          <label className="flex items-center gap-2">
            <span className="text-white/45 text-[11px] whitespace-nowrap">Speed</span>
            <input
              type="range"
              min={0.8}
              max={1.3}
              step={0.05}
              value={voice?.speed ?? 1}
              onChange={(e) => setStoryVoiceSpeed(Number(e.target.value))}
              className="h-1 flex-1 accent-[#60EFFF]"
            />
            <span className="w-8 flex-shrink-0 text-right text-[10.5px] tabular-nums text-white/40">
              {(voice?.speed ?? 1).toFixed(2)}x
            </span>
          </label>
        </div>
      )}
    </div>
  );
};
