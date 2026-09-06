import React, { useEffect, useMemo, useState } from 'react';
import { Mic, Volume2 } from 'lucide-react';
import { useEditorStore } from '../../lib/state/editorStore';
import { ttsCapability } from '../../lib/tts/capability';
import { TTS_VOICES, assignVoicesForParticipants, findVoice } from '../../lib/tts/voices';
import { speakPreview, getVoiceDiagnostics } from '../../lib/tts/previewVoice';
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

  // Browser voice lists load asynchronously — recompute once they're ready,
  // not just on mount, or this can under-report on browsers (mobile Chrome
  // especially) that fire 'voiceschanged' after an initial empty list.
  const [voiceDiag, setVoiceDiag] = useState(() => getVoiceDiagnostics());
  useEffect(() => {
    if (typeof speechSynthesis === 'undefined') return;
    const update = () => setVoiceDiag(getVoiceDiagnostics());
    update();
    speechSynthesis.addEventListener('voiceschanged', update);
    return () => speechSynthesis.removeEventListener('voiceschanged', update);
  }, []);
  const previewCantTellGendersApart = !(voiceDiag.hasDistinctMale && voiceDiag.hasDistinctFemale);

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
            Preview here uses your device's built-in voice instantly — no download. Exporting bakes in real narration for the video; the first export downloads a one-time voice model (cached after that, so later exports are instant).
          </p>

          {previewCantTellGendersApart && (
            <p className="text-[10.5px] text-amber-300/80">
              ⚠️ Your device only offers {voiceDiag.total || 'a'} built-in system voice{voiceDiag.total === 1 ? '' : 's'} to Chrome, so this preview may sound the same regardless of which voice you pick — that's a device limitation, not a bug. The exported video always uses the correct, distinct AI voice for each person.
            </p>
          )}

          {speakers.length === 0 && (
            <p className="text-[10.5px] text-white/35">Add some text messages to choose voices.</p>
          )}

          {speakers.map((p) => {
            const value = voice?.voices[p.id] ?? defaultVoices[p.id];
            const participantIndex = project.participants.findIndex((pp) => pp.id === p.id);
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
                  title="Hear this voice now"
                  onClick={() => speakPreview(`Hi, this is ${p.name}.`, participantIndex, findVoice(value).gender, voice?.speed ?? 1)}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/50 transition-colors hover:border-white/25 hover:text-white"
                >
                  <Volume2 size={13} />
                </button>
              </label>
            );
          })}
          <p className="text-white/25 text-[10px] -mt-1">
            Tap 🔊 to hear a voice instantly with your device's built-in voice — confirms a change took effect without waiting for playback.
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
