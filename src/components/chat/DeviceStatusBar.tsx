import React from 'react';
import type { DeviceOS, Theme } from '../../lib/parser/types';

interface Props {
  os: DeviceOS;
  theme: Theme;
  surface?: 'whatsapp' | 'instagram' | 'messenger' | 'slack' | 'telegram' | 'discord';
}

const IOSCellular: React.FC = () => (
  <svg width="18" height="12" viewBox="0 0 18 12" fill="currentColor" aria-hidden="true">
    <rect x="1" y="7" width="3" height="4" rx="1" />
    <rect x="5.5" y="5" width="3" height="6" rx="1" />
    <rect x="10" y="3" width="3" height="8" rx="1" />
    <rect x="14.5" y="1" width="3" height="10" rx="1" />
  </svg>
);

const IOSWifi: React.FC = () => (
  <svg width="17" height="12" viewBox="0 0 17 12" fill="none" aria-hidden="true">
    <path d="M1.5 4.1C5.55 1.05 11.45 1.05 15.5 4.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M4.3 7C6.75 5.25 10.25 5.25 12.7 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M7.15 9.65C7.9 9.15 9.1 9.15 9.85 9.65" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const IOSBattery: React.FC = () => (
  <svg width="25" height="12" viewBox="0 0 25 12" fill="none" aria-hidden="true">
    <rect x="1" y="1.5" width="20" height="9" rx="2.6" stroke="currentColor" strokeWidth="1.3" opacity="0.65" />
    <rect x="3" y="3.5" width="15" height="5" rx="1.4" fill="currentColor" />
    <path d="M22.2 4.4C23.1 4.7 23.7 5.25 23.7 6s-.6 1.3-1.5 1.6V4.4Z" fill="currentColor" opacity="0.65" />
  </svg>
);

const AndroidCellular: React.FC = () => (
  <svg width="17" height="13" viewBox="0 0 17 13" fill="currentColor" aria-hidden="true">
    <path d="M2 11.5h13.4c.35 0 .55-.42.31-.68L3.05 1.4c-.28-.31-.8-.11-.8.31v9.54c0 .14-.11.25-.25.25Z" opacity="0.22" />
    <path d="M5.15 11.5h10.25c.35 0 .55-.42.31-.68L5.9 3.5c-.28-.21-.75-.01-.75.35v7.65Z" />
  </svg>
);

const AndroidWifi: React.FC = () => (
  <svg width="16" height="13" viewBox="0 0 16 13" fill="none" aria-hidden="true">
    <path d="M1.4 4.25C5.35 1.2 10.65 1.2 14.6 4.25" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M4.1 7.1C6.35 5.45 9.65 5.45 11.9 7.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <circle cx="8" cy="10.4" r="1.15" fill="currentColor" />
  </svg>
);

const AndroidBattery: React.FC = () => (
  <svg width="18" height="12" viewBox="0 0 18 12" fill="none" aria-hidden="true">
    <rect x="1" y="2.4" width="14" height="7.2" rx="1.4" stroke="currentColor" strokeWidth="1.4" />
    <rect x="3" y="4.2" width="9.5" height="3.6" rx="0.8" fill="currentColor" />
    <rect x="15.9" y="4.5" width="1.2" height="3" rx="0.5" fill="currentColor" />
  </svg>
);

export const DeviceStatusBar: React.FC<Props> = ({ os, theme, surface = 'whatsapp' }) => {
  const isDark = theme === 'dark';
  const bgClass = isDark
    ? surface === 'instagram' || surface === 'messenger'
      ? 'bg-black'
      : surface === 'slack'
        ? 'bg-[#1d1c21]'
        : surface === 'discord'
          ? 'bg-[#1e1f22]'
        : surface === 'telegram'
          ? 'bg-[#182432]'
          : 'bg-[#202c33]'
    : surface === 'telegram'
      ? 'bg-[#9bc38f]'
      : surface === 'discord'
        ? 'bg-white'
      : 'bg-white';
  const textClass = isDark ? 'text-white' : 'text-[#111827]';

  if (os === 'ios') {
    return (
      <div className={`${bgClass} ${textClass} h-[31px] flex items-start justify-between px-[18px] pt-[8px] flex-shrink-0`}>
        <span className="text-[14px] leading-none font-semibold tracking-normal">9:41</span>
        <div className="flex items-center gap-[5px]">
          <IOSCellular />
          <IOSWifi />
          <IOSBattery />
        </div>
      </div>
    );
  }

  return (
    <div className={`${bgClass} ${textClass} h-[28px] flex items-start justify-between px-[18px] pt-[7px] flex-shrink-0`}>
      <span className="text-[12px] leading-none font-medium tracking-normal">9:55</span>
      <div className="flex items-center gap-[5px]">
        <AndroidCellular />
        <AndroidWifi />
        <AndroidBattery />
      </div>
    </div>
  );
};
