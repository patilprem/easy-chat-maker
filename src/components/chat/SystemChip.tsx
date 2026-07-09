import React from 'react';

interface Props {
  text: string;
  variant?: 'system' | 'date';
  theme?: 'light' | 'dark';
  onEdit?: (text: string) => void;
  editable?: boolean;
}

export const SystemChip: React.FC<Props> = ({ text, variant = 'system', theme = 'light', onEdit, editable = false }) => {
  const handleBlur = (e: React.FocusEvent<HTMLSpanElement>) => {
    onEdit?.(e.currentTarget.textContent ?? text);
  };
  const isDark = theme === 'dark';
  const chipClass = isDark
    ? 'bg-[#182229]/95 border-[#2a3942] text-[#d1d7db]'
    : variant === 'date'
      ? 'bg-white/95 border-gray-200/80 text-[#54656f]'
      : 'bg-white/85 border-gray-200/70 text-[#667781]';

  return (
    <div className="flex justify-center my-2 px-4">
      <span
        contentEditable={editable}
        suppressContentEditableWarning
        onBlur={handleBlur}
        onPaste={(e) => {
          e.preventDefault();
          const plain = e.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, plain);
        }}
        className={`text-[11px] px-3 py-1 rounded-md select-none shadow-[0_1px_2px_rgba(0,0,0,0.12)] border ${chipClass} ${editable ? 'cursor-text outline-none focus:ring-1 focus:ring-[#60EFFF]/40' : ''}`}
      >
        {text}
      </span>
    </div>
  );
};
