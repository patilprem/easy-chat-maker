import React from 'react';
import { Bot, Moon, RotateCcw, Settings2, Sun } from 'lucide-react';
import { useEditorStore } from '../../lib/state/editorStore';
import type { Platform } from '../../lib/parser/types';

const WaIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.553 4.116 1.523 5.847L.057 23.054a.5.5 0 0 0 .61.637l5.39-1.41A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.85 0-3.59-.5-5.09-1.373l-.365-.216-3.791.994.997-3.69-.23-.38A9.957 9.957 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
  </svg>
);

const InstagramIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
    <rect
      x="3"
      y="3"
      width="18"
      height="18"
      rx="5"
      stroke="currentColor"
      strokeWidth="2.2"
    />
    <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2.2" />
    <circle cx="17.25" cy="6.75" r="1.25" fill="currentColor" />
  </svg>
);

const MessengerIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M12 2C6.35 2 2 6.13 2 11.7c0 2.9 1.19 5.4 3.12 7.11v3.01c0 .43.5.67.84.41l2.67-2.03c1.04.29 2.17.44 3.37.44 5.65 0 10-4.13 10-9.7S17.65 2 12 2Zm1.03 12.83-2.55-2.72-4.98 2.72 5.48-5.82 2.61 2.72 4.91-2.72-5.47 5.82Z" />
  </svg>
);

const SlackIcon: React.FC = () => (
  <svg viewBox="0 0 28 28" width="18" height="18" aria-hidden="true">
    <path d="M9.05 14.9a2.15 2.15 0 1 1-2.15-2.15h2.15v2.15Z" fill="currentColor" />
    <path d="M10.1 14.9a2.15 2.15 0 0 1 4.3 0v5.35a2.15 2.15 0 1 1-4.3 0V14.9Z" fill="currentColor" />
    <path d="M13.1 9.05a2.15 2.15 0 1 1 2.15-2.15v2.15H13.1Z" fill="currentColor" />
    <path d="M13.1 10.1a2.15 2.15 0 0 1 0 4.3H7.75a2.15 2.15 0 1 1 0-4.3h5.35Z" fill="currentColor" />
    <path d="M18.95 13.1a2.15 2.15 0 1 1 2.15 2.15h-2.15V13.1Z" fill="currentColor" />
    <path d="M17.9 13.1a2.15 2.15 0 0 1-4.3 0V7.75a2.15 2.15 0 1 1 4.3 0v5.35Z" fill="currentColor" />
    <path d="M14.9 18.95a2.15 2.15 0 1 1-2.15 2.15v-2.15h2.15Z" fill="currentColor" />
    <path d="M14.9 17.9a2.15 2.15 0 0 1 0-4.3h5.35a2.15 2.15 0 1 1 0 4.3H14.9Z" fill="currentColor" />
  </svg>
);

const TelegramIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M21.82 4.07 18.64 19.1c-.24 1.06-.86 1.32-1.74.82l-4.83-3.56-2.33 2.24c-.26.26-.47.47-.97.47l.35-4.91 8.94-8.08c.39-.35-.08-.54-.6-.19L6.41 12.85l-4.76-1.49c-1.03-.32-1.05-1.03.22-1.53L20.5 2.65c.86-.32 1.61.19 1.32 1.42Z" />
  </svg>
);

const DiscordIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M19.55 5.03A17.18 17.18 0 0 0 15.24 3.7a.07.07 0 0 0-.08.04c-.18.32-.39.74-.53 1.07a15.9 15.9 0 0 0-4.8 0 10.7 10.7 0 0 0-.54-1.07.08.08 0 0 0-.08-.04c-1.5.25-2.95.7-4.31 1.33a.06.06 0 0 0-.03.03C2.13 9.15 1.39 13.14 1.76 17.08c0 .02.01.04.03.05a17.3 17.3 0 0 0 5.29 2.67.08.08 0 0 0 .09-.03c.41-.56.77-1.15 1.08-1.78a.08.08 0 0 0-.04-.1 11.4 11.4 0 0 1-1.66-.79.08.08 0 0 1-.01-.13l.33-.25a.08.08 0 0 1 .08-.01c3.46 1.58 7.19 1.58 10.61 0a.08.08 0 0 1 .08.01l.34.25a.08.08 0 0 1-.01.13c-.53.31-1.08.57-1.66.79a.08.08 0 0 0-.04.11c.32.62.68 1.21 1.08 1.77a.08.08 0 0 0 .09.03 17.25 17.25 0 0 0 5.3-2.67.08.08 0 0 0 .03-.05c.45-4.56-.75-8.51-3.19-12.02a.06.06 0 0 0-.03-.03ZM8.57 14.68c-1.04 0-1.9-.96-1.9-2.14s.84-2.14 1.9-2.14c1.06 0 1.92.97 1.9 2.14 0 1.18-.84 2.14-1.9 2.14Zm6.86 0c-1.04 0-1.9-.96-1.9-2.14s.84-2.14 1.9-2.14c1.06 0 1.92.97 1.9 2.14 0 1.18-.84 2.14-1.9 2.14Z" />
  </svg>
);

const ChatGPTIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A6.07 6.07 0 0 0 4.98 4.18a5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .75 7.1 5.98 5.98 0 0 0 .51 4.91 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.06 6.06 0 0 0 5.77-4.21 5.99 5.99 0 0 0 4-2.9 6.06 6.06 0 0 0-.75-7.07zM13.26 22.43c-1.04 0-1.86-.32-2.57-.9l.13-.07 4.27-2.47a.7.7 0 0 0 .35-.6v-6.03l1.8 1.05a.06.06 0 0 1 .04.05v4.99a4.5 4.5 0 0 1-4.02 3.98zm-9.67-4.13a4.47 4.47 0 0 1-.54-3.01l.13.08 4.27 2.46a.7.7 0 0 0 .7 0l5.21-3v2.08a.07.07 0 0 1-.03.06L9.02 19.4a4.5 4.5 0 0 1-5.43-1.1zM2.34 8.44a4.48 4.48 0 0 1 2.37-1.97v5.08a.69.69 0 0 0 .35.6l5.19 3-1.8 1.04a.07.07 0 0 1-.07 0l-4.32-2.49a4.5 4.5 0 0 1-1.72-5.26zm14.82 3.44-5.21-3.02 1.8-1.04a.07.07 0 0 1 .06 0l4.32 2.5a4.49 4.49 0 0 1-.65 8.1v-5.08a.7.7 0 0 0-.32-.46zm1.8-2.71-.13-.08-4.27-2.48a.7.7 0 0 0-.7 0l-5.21 3.01V7.55a.06.06 0 0 1 .03-.06l4.32-2.49a4.5 4.5 0 0 1 6.68 4.66zM8.05 12.86l-1.8-1.04a.06.06 0 0 1-.04-.05V6.78a4.5 4.5 0 0 1 7.37-3.45l-.13.07-4.27 2.47a.7.7 0 0 0-.35.6zm.98-2.11 2.32-1.34 2.33 1.34v2.68l-2.32 1.34-2.33-1.34z" />
  </svg>
);

const ClaudeIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M11.16 2.06c.24-.05.5-.06.74-.01.24.05.42.24.5.47l.86 5.4c.03.2.3.24.4.06l2.71-4.74a.9.9 0 0 1 1.24-.32c.4.23.55.72.36 1.14l-2.28 5.02c-.08.18.11.36.28.27l4.9-2.53a.9.9 0 0 1 1.2.42c.2.42.05.92-.35 1.15l-4.7 2.87c-.17.1-.1.36.1.37l5.46.34c.47.03.83.42.83.89s-.36.86-.83.89l-5.45.34c-.2.01-.27.27-.1.37l4.69 2.86c.4.24.55.74.35 1.16a.9.9 0 0 1-1.2.42l-4.9-2.54c-.17-.09-.36.1-.28.28l2.28 5.02a.9.9 0 0 1-.36 1.14.9.9 0 0 1-1.24-.32l-2.7-4.74c-.1-.18-.38-.13-.41.07l-.86 5.39a.87.87 0 0 1-.87.74.87.87 0 0 1-.87-.74l-.86-5.4c-.03-.2-.3-.24-.4-.06l-2.71 4.74a.9.9 0 0 1-1.24.32.9.9 0 0 1-.36-1.14l2.28-5.02c.08-.18-.11-.37-.28-.28l-4.9 2.54a.9.9 0 0 1-1.2-.42.92.92 0 0 1 .35-1.16l4.69-2.86c.17-.1.1-.36-.1-.37l-5.45-.34a.89.89 0 0 1-.83-.89c0-.47.36-.86.83-.89l5.45-.34c.2-.01.28-.27.1-.37L3.35 8.39a.92.92 0 0 1-.35-1.15.9.9 0 0 1 1.2-.42l4.9 2.53c.17.09.36-.09.28-.27L7.1 4.06a.9.9 0 0 1 .36-1.14.9.9 0 0 1 1.24.32l2.7 4.74c.11.18.38.14.41-.06l.86-5.4a.87.87 0 0 1 .5-.46z" />
  </svg>
);

const GeminiIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
    <path d="M12 24A14.3 14.3 0 0 0 0 12 14.3 14.3 0 0 0 12 0a14.3 14.3 0 0 0 12 12 14.3 14.3 0 0 0-12 12z" />
  </svg>
);

const AppleLogoIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
    <path d="M16.65 12.64c-.03-2.52 2.05-3.75 2.14-3.81-1.18-1.72-3-1.96-3.64-1.98-1.53-.16-3.02.91-3.8.91-.8 0-2.01-.89-3.31-.86-1.68.03-3.25 1-4.11 2.54-1.78 3.08-.45 7.6 1.25 10.09.85 1.22 1.84 2.58 3.13 2.53 1.27-.05 1.74-.81 3.27-.81 1.52 0 1.96.81 3.29.78 1.36-.02 2.22-1.22 3.04-2.45.98-1.4 1.37-2.78 1.39-2.85-.03-.01-2.62-1.01-2.65-4.09ZM14.16 5.23c.69-.86 1.16-2.03 1.03-3.22-.99.04-2.23.69-2.95 1.52-.64.73-1.22 1.95-1.07 3.1 1.12.08 2.27-.56 2.99-1.4Z" />
  </svg>
);

export const PlatformSettings: React.FC = () => {
  const { project, setPlatform, setTheme, setDeviceOS, reset } = useEditorStore();

  const platforms: Array<{
    id: Platform;
    name: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'whatsapp',
      name: 'WhatsApp',
      icon: <WaIcon />,
    },
    {
      id: 'instagram',
      name: 'Instagram',
      icon: <InstagramIcon />,
    },
    {
      id: 'messenger',
      name: 'Messenger',
      icon: <MessengerIcon />,
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: <SlackIcon />,
    },
    {
      id: 'telegram',
      name: 'Telegram',
      icon: <TelegramIcon />,
    },
    {
      id: 'discord',
      name: 'Discord',
      icon: <DiscordIcon />,
    },
    {
      id: 'chatgpt',
      name: 'ChatGPT',
      icon: <ChatGPTIcon />,
    },
    {
      id: 'claude',
      name: 'Claude',
      icon: <ClaudeIcon />,
    },
    {
      id: 'gemini',
      name: 'Gemini',
      icon: <GeminiIcon />,
    },
  ];

  const segBtn = (active: boolean) =>
    `flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
      active
        ? 'bg-gradient-to-r from-[#00FF87] to-[#60EFFF] text-[#061116] shadow-sm'
        : 'text-white/55 hover:text-white/85'
    }`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Settings2 size={16} className="text-[#60EFFF]" />
        <span className="text-white font-semibold text-sm">Settings</span>
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-medium">Platform</label>
        <div className="grid grid-cols-2 gap-2">
          {platforms.map((platform) => {
            const active = project.platform === platform.id;
            return (
              <button
                key={platform.id}
                onClick={() => setPlatform(platform.id)}
                className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition-all ${
                  active
                    ? 'border-[#60EFFF]/70 bg-gradient-to-r from-[#00FF87]/18 to-[#60EFFF]/18 shadow-[0_0_0_1px_rgba(96,239,255,0.18)]'
                    : 'border-white/10 bg-white/[0.04] hover:border-white/20 hover:bg-white/[0.07]'
                }`}
              >
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${
                  active
                    ? 'bg-gradient-to-r from-[#00FF87] to-[#60EFFF] text-[#061116]'
                    : 'bg-white/8 text-white/65'
                }`}>
                  {platform.icon}
                </span>
                <span className={`min-w-0 flex-1 truncate text-[13px] font-semibold ${active ? 'text-white' : 'text-white/75'}`}>
                  {platform.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-medium">Theme</label>
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTheme('light')}
            className={segBtn(project.theme === 'light')}
          >
            <Sun size={14} strokeWidth={2.5} />
            Light
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={segBtn(project.theme === 'dark')}
          >
            <Moon size={14} strokeWidth={2.5} />
            Dark
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-white/50 text-xs font-medium">Device</label>
        <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 gap-1">
          <button
            onClick={() => setDeviceOS('ios')}
            className={segBtn(project.deviceOS === 'ios')}
          >
            <AppleLogoIcon />
            iOS
          </button>
          <button
            onClick={() => setDeviceOS('android')}
            className={segBtn(project.deviceOS === 'android')}
          >
            <Bot size={14} strokeWidth={2.5} />
            Android
          </button>
        </div>
      </div>

      <button
        onClick={() => {
          if (confirm('Reset everything to default? This cannot be undone.')) reset();
        }}
        className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 text-xs font-medium transition-colors"
      >
        <RotateCcw size={12} />
        Reset to default
      </button>
    </div>
  );
};
