import { SaxesParser } from 'saxes';

const ALLOWED_TAGS = new Set(['svg','g','path','rect','circle','ellipse','line','polyline','polygon','text','tspan','defs','clipPath','linearGradient','radialGradient','stop','title','desc']);
const ATTRS = new Set('xmlns viewBox width height preserveAspectRatio id x y x1 y1 x2 y2 cx cy r rx ry d points fill stroke stroke-width opacity fill-opacity stroke-opacity fill-rule clip-rule clip-path transform gradientTransform gradientUnits offset stop-color stop-opacity font-size font-family font-weight text-anchor dx dy'.split(' '));
export const MAX_SVG_BYTES = 65536;
export type SvgNode = { name: string; attrs: Record<string,string>; children: SvgNode[]; text: string };
export function parseSafeSvg(markup: string): SvgNode {
  const bytes = new TextEncoder().encode(markup).length;
  if (bytes < 12 || bytes > MAX_SVG_BYTES) throw new Error('This SVG is too large or empty.');
  const parser = new SaxesParser({ xmlns: false });
  const stack: SvgNode[] = [];
  let root: SvgNode | undefined;
  let count = 0;
  parser.on('doctype', () => { throw new Error('SVG doctypes and entities are unsafe.'); });
  parser.on('processinginstruction', () => { throw new Error('SVG processing instructions are unsafe.'); });
  parser.on('opentag', tag => {
    if (!ALLOWED_TAGS.has(tag.name)) throw new Error(`Unsupported or unsafe SVG element: ${tag.name}.`);
    if (++count > 2000 || stack.length > 32) throw new Error('SVG is too complex.');
    if (stack.length === 0 && tag.name !== 'svg') throw new Error('Choose a standalone SVG document.');
    if (stack.length > 0 && tag.name === 'svg') throw new Error('Nested SVG documents are not supported.');
    const attrs: Record<string,string> = {};
    for (const [key, raw] of Object.entries(tag.attributes)) {
      const value = String(raw);
      if (/^on/i.test(key)) throw new Error('SVG event handlers are not allowed.');
      if (/href|src/i.test(key)) throw new Error('External SVG asset references are not allowed.');
      if (!ATTRS.has(key)) throw new Error(`Unsupported SVG attribute ${key}; expand styles into presentation attributes.`);
      if (key === 'xmlns' && value !== 'http://www.w3.org/2000/svg') throw new Error('Unsupported SVG namespace.');
      if (key !== 'xmlns' && /[\\]|https?:|data:|javascript:|@|\/\*/i.test(value)) throw new Error('External or encoded SVG references are not allowed.');
      if (/url\s*\(/i.test(value) && !/^url\(#[A-Za-z_][\w.-]*\)$/.test(value)) throw new Error('External SVG style references are not allowed.');
      attrs[key] = value;
    }
    const node: SvgNode = { name: tag.name, attrs, children: [], text: '' };
    if (stack.length) stack[stack.length-1]!.children.push(node); else root = node;
    stack.push(node);
  });
  parser.on('text', text => { if (stack.length) stack[stack.length-1]!.text += text; });
  parser.on('closetag', () => { stack.pop(); });
  parser.write(markup).close();
  if (!root) throw new Error('Choose a standalone SVG document.');
  return root;
}
export function sanitizeSvg(markup: string) {
  const root = parseSafeSvg(markup);
  const serialize = (node: SvgNode): string => `<${node.name}${Object.entries(node.attrs).map(([key,value])=>` ${key}="${escapeXml(value)}"`).join('')}>${escapeXml(node.text)}${node.children.map(serialize).join('')}</${node.name}>`;
  return serialize(root);
}
export function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;' })[char]!);
}
