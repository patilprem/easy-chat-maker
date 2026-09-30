import React, { useEffect, useState } from 'react';
import { ScriptPanel } from './ScriptPanel';
import { PlatformSettings } from './PlatformSettings';
import { StorySettings } from './StorySettings';
import { ExportPanel } from './ExportPanel';
import { PhonePreview } from './PhonePreview';
import { configureEditorStore, useEditorStore, type EditorMode } from '../../lib/state/editorStore';
import { AI_PLATFORMS } from '../../lib/parser/types';
import { trackEditorOpened } from '../../lib/track';
import type { Platform } from '../../lib/parser/types';

type Tab = 'script' | 'preview';

const VALID_PLATFORMS: Platform[] = ['whatsapp', 'instagram', 'messenger', 'slack', 'telegram', 'discord', ...AI_PLATFORMS];

/**
 * `mode` picks which page this is: `/editor` (chat mockups, the default)
 * or `/story-editor` (texting stories: chrome-less bubbles over a
 * background, voiceover with per-message tones). Same layout either way;
 * the right column swaps between the platform settings and the story
 * settings, and each mode has its own saved project (see editorStore).
 */
export const ChatEditorApp: React.FC<{ mode?: EditorMode }> = ({ mode = 'chat' }) => {
  const isStoryPage = mode === 'story';
  const hydrateFromStorage = useEditorStore((s) => s.hydrateFromStorage);
  const [mobileTab, setMobileTab] = useState<Tab>('script');

  useEffect(() => {
    configureEditorStore({ mode });
    hydrateFromStorage();
    // Deep links from landing pages: /editor?platform=whatsapp or /editor?scenario=testimonial
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get('scenario');
    const requested = params.get('platform') as Platform | null;
    const isPlatformLink = !!requested && VALID_PLATFORMS.includes(requested);

    if (scenario && !isStoryPage) {
      useEditorStore.getState().loadScenario(scenario);
    } else if (isPlatformLink && !isStoryPage) {
      useEditorStore.getState().setPlatform(requested);
    }

    // Fired after the deep link is applied so `platform` is the one the user
    // actually lands on, not the stored default.
    trackEditorOpened(
      useEditorStore.getState().project.platform,
      isStoryPage ? 'story_editor' : scenario ? 'scenario' : isPlatformLink ? 'platform_link' : 'direct'
    );
  }, [hydrateFromStorage, mode, isStoryPage]);

  const brandSubtitle = isStoryPage ? 'Texting story maker · beta' : 'Create realistic chat mockups';
  const settingsColumn = (
    <>
      <PlatformSettings />
      {isStoryPage && (
        <>
          <div className="h-px bg-white/10" />
          <StorySettings />
        </>
      )}
    </>
  );

  const tabCls = (active: boolean) =>
    `flex-1 py-2 text-sm font-semibold transition-colors rounded-xl ${
      active ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
    }`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A1A] via-[#10172b] to-[#16213E] text-white">
      {/* Desktop layout: 3 columns */}
      <div className="hidden md:grid md:grid-cols-[420px_minmax(420px,1fr)_280px] min-h-screen">
        {/* Left — Script */}
        <div className="border-r border-white/5 p-5 overflow-y-auto">
          <div className="mb-6">
            <a href="/" className="group flex items-center gap-2.5" title="Back to homepage">
              <img src="/favicon-96x96.png" alt="" width={36} height={36} className="h-9 w-9 rounded-[10px] shadow-lg" />
              <span>
                <h1 className="brand-font text-xl font-bold bg-gradient-to-r from-[#00FF87] to-[#60EFFF] bg-clip-text text-transparent group-hover:brightness-110">
                  Easy Chat Maker
                </h1>
                <p className="text-white/40 text-xs mt-1 group-hover:text-white/60 transition-colors">{brandSubtitle}</p>
              </span>
            </a>
            {isStoryPage && (
              <a href="/editor" className="mt-3 inline-block text-xs font-medium text-white/45 hover:text-white/80 transition-colors">
                ← Back to the chat mockup editor
              </a>
            )}
          </div>
          <ScriptPanel />
        </div>

        {/* Center — Phone Preview */}
        <div className="flex items-center justify-center p-8 overflow-hidden">
          <PhonePreview />
        </div>

        {/* Right — Settings + Export */}
        <div className="border-l border-white/5 p-5 flex flex-col gap-6 overflow-y-auto">
          {settingsColumn}
          <ExportPanel />
        </div>
      </div>

      {/* Mobile layout: tabs */}
      <div className="md:hidden flex flex-col min-h-screen">
        {/* Title */}
        <div className="px-4 pt-5 pb-3">
          <a href="/" title="Back to homepage" className="flex items-center gap-2.5">
            <img src="/favicon-96x96.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-lg shadow-lg" />
            <h1 className="brand-font text-lg font-bold bg-gradient-to-r from-[#00FF87] to-[#60EFFF] bg-clip-text text-transparent">
              Easy Chat Maker
            </h1>
          </a>
          {isStoryPage && <p className="mt-1 text-xs text-white/40">Texting story maker · beta · <a href="/editor" className="underline hover:text-white/70">chat mockup editor</a></p>}
        </div>

        {/* Tabs — pinned to the top while the page scrolls */}
        <div className="sticky top-0 z-30 px-4 py-3 bg-[#0d1428]/90 backdrop-blur-md">
          <div className="flex bg-white/5 rounded-xl p-1 gap-1">
            <button onClick={() => setMobileTab('script')} className={tabCls(mobileTab === 'script')}>
              ✏️ Script
            </button>
            <button onClick={() => setMobileTab('preview')} className={tabCls(mobileTab === 'preview')}>
              📱 Preview
            </button>
          </div>
        </div>

        {/* Tab content */}
        <div className="px-4 pb-6">
          {mobileTab === 'script' ? (
            <div className="space-y-6">
              <ScriptPanel />
              {settingsColumn}
            </div>
          ) : (
            <div className="flex justify-center pt-2">
              <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center' }}>
                <PhonePreview />
              </div>
            </div>
          )}
        </div>

        {/* Export — pinned to the bottom on both tabs */}
        <div className="sticky bottom-0 z-30 mt-auto px-4 pt-2 pb-3 bg-[#0d1428]/90 backdrop-blur-md border-t border-white/10">
          <ExportPanel hideDivider />
        </div>
      </div>
    </div>
  );
};
