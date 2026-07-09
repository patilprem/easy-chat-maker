import React, { useEffect, useState } from 'react';
import { ScriptPanel } from './ScriptPanel';
import { PlatformSettings } from './PlatformSettings';
import { ExportPanel } from './ExportPanel';
import { PhonePreview } from './PhonePreview';
import { useEditorStore } from '../../lib/state/editorStore';

type Tab = 'script' | 'preview';

export const ChatEditorApp: React.FC = () => {
  const hydrateFromStorage = useEditorStore((s) => s.hydrateFromStorage);
  const [mobileTab, setMobileTab] = useState<Tab>('script');

  useEffect(() => {
    hydrateFromStorage();
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
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#00FF87] to-[#60EFFF] bg-clip-text text-transparent">
              Easy Chat Maker
            </h1>
            <p className="text-white/40 text-xs mt-1">Create realistic chat mockups</p>
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
          <h1 className="text-lg font-bold bg-gradient-to-r from-[#00FF87] to-[#60EFFF] bg-clip-text text-transparent">
            Easy Chat Maker
          </h1>
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
