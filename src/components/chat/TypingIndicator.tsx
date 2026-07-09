import React from 'react';

export const TypingIndicator: React.FC = () => (
  <div className="flex items-center gap-0.5 px-2.5 py-2">
    {[0, 1, 2].map((i) => (
      <span
        key={i}
        className="typing-dot w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-500"
        style={{ '--typing-dot-delay': `${i * 0.22}s` } as React.CSSProperties}
      />
    ))}
  </div>
);
