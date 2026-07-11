import React, { useEffect, useState } from 'react';
import { ScriptPanel } from './ScriptPanel';
import { PlatformSettings } from './PlatformSettings';
import { ExportPanel } from './ExportPanel';
import { PhonePreview } from './PhonePreview';
import { useEditorStore } from '../../lib/state/editorStore';
import { AI_PLATFORMS } from '../../lib/parser/types';
import type { Platform } from '../../lib/parser/types';

type Tab = 'script' | 'preview';

const VALID_PLATFORMS: Platform[] = ['whatsapp', 'instagram', 'messenger', 'slack', 'telegram', 'discord', ...AI_PLATFORMS];

export const ChatEditorApp: React.FC = () => {
  const hydrateFromStorage = useEditorStore((s) => s.hydrateFromStorage);
  const [mobileTab, setMobileTab] = useState<Tab>('script');

  useEffect(() => {
    hydrateFromStorage();
    // Deep links from landing pages: /editor?platform=whatsapp or /editor?scenario=testimonial
    const params = new URLSearchParams(window.location.search);
    const scenario = params.get('scenario');
    if (scenario) {
      useEditorStore.getState().loadScenario(scenario);
      return;
    }
    const requested = params.get('platform') as Platform | null;
    if (requested && VALID_PLATFORMS.includes(requested)) {
      useEditorStore.getState().setPlatform(requested);
    }
  }, [hydrateFromStorage]);

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
                <h1 className="text-xl font-bold bg-gradient-to-r from-[#00FF87] to-[#60EFFF] bg-clip-text text-transparent group-hover:brightness-110">
                  Easy Chat Maker
                </h1>
                <p className="text-white/40 text-xs mt-1 group-hover:text-white/60 transition-colors">Create realistic chat mockups</p>
              </span>
            </a>
          </div>
          <ScriptPanel />
        </div>

        {/* Center — Phone Preview */}
        <div className="flex items-center justify-center p-8 overflow-hidden">
          <PhonePreview />
        </div>

        {/* Right — Settings + Export */}
        <div className="border-l border-white/5 p-5 flex flex-col gap-6 overflow-y-auto">
          <PlatformSettings />
          <ExportPanel />
        </div>
      </div>

      {/* Mobile layout: tabs */}
      <div className="md:hidden flex flex-col min-h-screen">
        {/* Title */}
        <div className="px-4 pt-5 pb-3">
          <a href="/" title="Back to homepage" className="flex items-center gap-2.5">
            <img src="/favicon-96x96.png" alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-lg shadow-lg" />
            <h1 className="text-lg font-bold bg-gradient-to-r from-[#00FF87] to-[#60EFFF] bg-clip-text text-transparent">
              Easy Chat Maker
            </h1>
          </a>
        </div>

        {/* Tabs */}
        <div className="px-4 pb-3">
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
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {mobileTab === 'script' ? (
            <div className="space-y-6">
              <ScriptPanel />
              <PlatformSettings />
              <ExportPanel />
            </div>
          ) : (
            <div className="flex justify-center pt-2">
              <div style={{ transform: 'scale(0.72)', transformOrigin: 'top center' }}>
                <PhonePreview />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
