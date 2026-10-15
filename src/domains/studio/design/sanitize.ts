const ALLOWED_TAGS = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'defs',
  'clippath',
  'lineargradient',
  'radialgradient',
  'stop',
  'title',
  'desc',
]);
const URL_ATTR = /^(href|xlink:href|src)$/i;
const EVENT_ATTR = /^on/i;

export const MAX_SVG_BYTES = 65536;

export function sanitizeSvg(markup: string) {
  const bytes = new TextEncoder().encode(markup).length;
  if (bytes < 12 || bytes > MAX_SVG_BYTES) throw new Error('This SVG is too large or empty.');
  if (/<!doctype|<!entity|<script|<foreignobject|<iframe|<object|<embed|<image|<use/i.test(markup))
    throw new Error('This SVG uses unsupported or unsafe elements.');
  if (/javascript:|data:text\/html|vbscript:/i.test(markup))
    throw new Error('This SVG contains an unsafe URL.');
  const wrapped = `<root>${markup}</root>`;
  const tag = /<\/?([a-zA-Z0-9:_-]+)([^>]*)\/?>/g;
  let match: RegExpExecArray | null;
  while ((match = tag.exec(wrapped))) {
    const name = match[1]!.toLowerCase();
    if (name === 'root') continue;
    if (!ALLOWED_TAGS.has(name)) throw new Error(`SVG element <${name}> is not allowed.`);
    const attrs = match[2] ?? '';
    if (EVENT_ATTR.test(attrs) || /\son[a-z]+=/i.test(attrs))
      throw new Error('SVG event handlers are not allowed.');
    const attr = /([a-zA-Z_:][\w:.-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let found: RegExpExecArray | null;
    while ((found = attr.exec(attrs))) {
      const key = found[1]!;
      const value = found[3] ?? found[4] ?? '';
      if (EVENT_ATTR.test(key)) throw new Error('SVG event handlers are not allowed.');
      if (URL_ATTR.test(key) && !value.startsWith('#') && !value.startsWith('data:image/'))
        throw new Error('External SVG asset references are not allowed.');
      if (/url\(\s*['"]?\s*https?:/i.test(value) || /url\(\s*['"]?\s*\/\//i.test(value))
        throw new Error('External SVG style references are not allowed.');
    }
  }
  if (!/<svg[\s>]/i.test(markup)) throw new Error('Choose a standalone SVG document.');
  return markup.trim();
}

export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&apos;';
  });
}
