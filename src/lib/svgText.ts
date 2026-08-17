/**
 * Helpers for putting user-typed names into the inline SVG avatars.
 *
 * Real chat names are full of decorative Unicode — "⑅ ♡ 𝑁𝑦𝑎𝑛 ♡ ⑅", emoji,
 * styled letters — and three separate things break on those:
 *   - `btoa` throws on any code point above U+00FF, killing the whole parse;
 *   - `name[0]` slices a surrogate pair in half, producing a broken glyph;
 *   - an unescaped `&` or `<` in a name makes the SVG invalid XML.
 * Everything that builds an avatar data URI should go through here.
 */

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

export function escapeXml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => XML_ESCAPES[c]);
}

/**
 * First letter of up to two words, code-point safe.
 *
 * The name is NFKD-normalized first so styled letters fall back to plain ones
 * (𝑁𝑦𝑎𝑛 → Nyan), and words that don't start with a letter or digit are skipped
 * so decorations like ♡ or ⑅ don't get picked as the initials. If a name is
 * nothing but symbols there is no better option, so its first code point is
 * used as-is.
 */
export function initialsFrom(name: string): string {
  const words = name
    .normalize('NFKD')
    .split(/\s+/)
    .filter((w) => /^[\p{L}\p{N}]/u.test(w));

  const source = words.length > 0 ? words : [name.trim()];

  return source
    .slice(0, 2)
    .map((w) => [...w][0]?.toUpperCase() ?? '')
    .join('');
}

/**
 * `btoa` only accepts Latin-1, so encode the markup's UTF-8 bytes before
 * base64-ing it. Base64 (rather than a URL-encoded payload) keeps the data URI
 * byte-for-byte the shape the export pipeline already handles.
 */
export function svgDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
