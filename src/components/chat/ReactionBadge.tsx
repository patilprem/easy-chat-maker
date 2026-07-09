import React from 'react';

interface Props {
  emoji: string;
  onRemove?: () => void;
  theme?: 'light' | 'dark';
  className?: string;
}

export const ReactionBadge: React.FC<Props> = ({ emoji, onRemove, theme = 'light', className = '' }) => {
  const isDark = theme === 'dark';
  const bgClass = isDark ? 'bg-[#222e35] text-white border-[#2d373c]' : 'bg-white text-gray-800 border-gray-150';
  const shadowClass = isDark ? 'shadow-[0_2px_5px_rgba(0,0,0,0.4)]' : 'shadow-[0_2px_4px_rgba(0,0,0,0.08)]';
  
  return (
    <button
      onClick={onRemove}
      className={`reaction-badge flex min-h-[20px] min-w-[30px] items-center justify-center gap-0.5 border rounded-full px-2 py-[2px] cursor-pointer hover:scale-110 transition-transform ${bgClass} ${shadowClass} ${className}`}
      title={onRemove ? 'Click to remove reaction' : undefined}
      style={{ fontSize: '16px', lineHeight: 1 }}
    >
      {emoji}
    </button>
  );
};
