import React, { useCallback } from 'react';

interface Props {
  /** Current timestamp text, e.g. "9:41 am". Blank renders the placeholder in the editor. */
  value?: string;
  /** Ghost text shown in the editor while the timestamp is blank. */
  placeholder?: string;
  editable?: boolean;
  onEdit?: (time: string) => void;
  className?: string;
}

/** contentEditable strips markup on paste but can still leave &nbsp; behind. */
function normalize(raw: string): string {
  return raw.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * The timestamp shown on a bubble / message row. Editable in the editor,
 * a plain span everywhere else so exports and video frames stay untouched.
 */
export const EditableTime: React.FC<Props> = ({
  value, placeholder = '9:41 am', editable = false, onEdit, className = '',
}) => {
  const handleBlur = useCallback((e: React.FocusEvent<HTMLSpanElement>) => {
    const next = normalize(e.currentTarget.textContent ?? '');
    if (next !== (value ?? '')) onEdit?.(next);
  }, [value, onEdit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.currentTarget.textContent = value ?? '';
      e.currentTarget.blur();
    }
  }, [value]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  }, []);

  if (!editable) {
    return <span className={className}>{value}</span>;
  }

  return (
    <span
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      title="Click to edit the time"
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      // Keep clicks from reaching the bubble's own handlers/menus.
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className={`editable-time ${className}`}
    >
      {value}
    </span>
  );
};
