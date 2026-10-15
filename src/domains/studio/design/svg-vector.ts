import {
  clip,
  endPath,
  rectangle,
  concatTransformationMatrix,
  popGraphicsState,
  pushGraphicsState,
  rgb,
  type PDFPage,
} from 'pdf-lib';
import { parseSafeSvg, type SvgNode } from './sanitize';

const tags = new Set([
  'svg',
  'g',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'title',
  'desc',
]);
const supported = new Set(
  'xmlns viewBox width height preserveAspectRatio id x y x1 y1 x2 y2 cx cy r rx ry d points fill stroke stroke-width opacity fill-opacity stroke-opacity transform'.split(
    ' ',
  ),
);
export function vectorSvg(markup: string) {
  const root = parseSafeSvg(markup);
  const visit = (n: SvgNode) => {
    if (!tags.has(n.name))
      throw new Error(
        `Vector PDF does not support SVG ${n.name}. Outline text and expand gradients/clips before importing.`,
      );
    for (const [key, value] of Object.entries(n.attrs)) {
      if (!supported.has(key))
        throw new Error(
          `Vector PDF does not support SVG ${key}. Expand the artwork before importing.`,
        );
      if (
        ['fill', 'stroke'].includes(key) &&
        !/^(#[\da-f]{6}|#[\da-f]{3}|none|black|white)$/i.test(value)
      )
        throw new Error('Vector SVG needs solid hex colors.');
    }
    if (n.attrs.transform) transforms(n.attrs.transform);
    n.children.forEach(visit);
  };
  visit(root);
  const vb = (root.attrs.viewBox ?? '').trim().split(/[ ,]+/).map(Number);
  if (vb.length !== 4 || vb.some((x) => !Number.isFinite(x)) || vb[2]! <= 0 || vb[3]! <= 0)
    throw new Error('Vector SVG needs a finite positive viewBox.');
  if (root.attrs.preserveAspectRatio && root.attrs.preserveAspectRatio !== 'xMidYMid meet')
    throw new Error('Vector SVG currently supports xMidYMid meet only.');
  return { root, vb };
}
function transforms(value: string): [number, number, number, number, number, number][] {
  const result: [number, number, number, number, number, number][] = [];
  let rest = value.trim();
  while (rest) {
    const match = /^(matrix|translate|scale|rotate)\s*\(([^)]+)\)\s*,?\s*/.exec(rest);
    if (!match) throw new Error('Unsupported SVG transform.');
    const v = match[2]!.trim().split(/[ ,]+/).map(Number);
    if (v.some((x) => !Number.isFinite(x) || Math.abs(x) > 1e6))
      throw new Error('Invalid SVG transform.');
    const [a = 0, b = a, c = 0] = v;
    if (match[1] === 'matrix' && v.length === 6)
      result.push(v as [number, number, number, number, number, number]);
    else if (match[1] === 'translate' && v.length <= 2) result.push([1, 0, 0, 1, a, v[1] ?? 0]);
    else if (match[1] === 'scale' && v.length <= 2) result.push([a, 0, 0, b, 0, 0]);
    else if (match[1] === 'rotate' && (v.length === 1 || v.length === 3)) {
      const angle = (a * Math.PI) / 180,
        co = Math.cos(angle),
        si = Math.sin(angle),
        cx = v[1] ?? 0;
      result.push([co, si, -si, co, cx - co * cx + si * c, c - si * cx - co * c]);
    } else throw new Error('Invalid SVG transform arguments.');
    rest = rest.slice(match[0].length);
  }
  return result;
}
function color(value: string) {
  let hex = value === 'black' ? '#000000' : value === 'white' ? '#FFFFFF' : value;
  if (hex.length === 4)
    hex =
      '#' +
      hex
        .slice(1)
        .split('')
        .map((x) => x + x)
        .join('');
  return rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  );
}
export function drawVectorSvg(
  page: PDFPage,
  markup: string,
  box: { x: number; y: number; width: number; height: number; opacity: number },
) {
  const { root, vb } = vectorSvg(markup);
  const scale = Math.min(box.width / vb[2]!, box.height / vb[3]!);
  page.pushOperators(
    pushGraphicsState(),
    rectangle(box.x, box.y, box.width, box.height),
    clip(),
    endPath(),
    concatTransformationMatrix(
      scale,
      0,
      0,
      -scale,
      box.x + (box.width - vb[2]! * scale) / 2 - vb[0]! * scale,
      box.y + box.height - (box.height - vb[3]! * scale) / 2 + vb[1]! * scale,
    ),
  );
  function draw(node: SvgNode, inherited: Record<string, string>, opacity: number) {
    const attrs = { ...inherited, ...node.attrs };
    const n = (key: string, fallback = 0) => {
      const value = Number(attrs[key] ?? fallback);
      if (!Number.isFinite(value) || Math.abs(value) > 1e6)
        throw new Error('Invalid SVG geometry.');
      return value;
    };
    const alpha = opacity * Number(node.attrs.opacity ?? 1);
    page.pushOperators(pushGraphicsState());
    for (const matrix of transforms(node.attrs.transform ?? ''))
      page.pushOperators(concatTransformationMatrix(...matrix));
    const options = {
      color: attrs.fill === 'none' ? undefined : color(attrs.fill ?? '#000000'),
      borderColor: !attrs.stroke || attrs.stroke === 'none' ? undefined : color(attrs.stroke),
      borderWidth: !attrs.stroke || attrs.stroke === 'none' ? 0 : n('stroke-width', 1),
      opacity: alpha * Number(attrs['fill-opacity'] ?? 1),
      borderOpacity: alpha * Number(attrs['stroke-opacity'] ?? 1),
    };
    let path = node.attrs.d;
    if (node.name === 'polygon' || node.name === 'polyline')
      path = 'M ' + (node.attrs.points ?? '') + (node.name === 'polygon' ? ' Z' : '');
    if (node.name === 'line') path = `M ${n('x1')} ${n('y1')} L ${n('x2')} ${n('y2')}`;
    if (['path', 'polygon', 'polyline', 'line'].includes(node.name)) {
      if (!path || path.length > 50000) throw new Error('SVG path is empty or too large.');
      page.pushOperators(concatTransformationMatrix(1, 0, 0, -1, 0, 0));
      page.drawSvgPath(path, { ...options, x: 0, y: 0 });
      page.pushOperators(concatTransformationMatrix(1, 0, 0, -1, 0, 0));
    } else if (node.name === 'rect') {
      if (n('rx') || n('ry')) throw new Error('Expand rounded SVG rectangles into paths.');
      page.drawRectangle({
        ...options,
        x: n('x'),
        y: n('y'),
        width: n('width'),
        height: n('height'),
      });
    } else if (node.name === 'circle' || node.name === 'ellipse')
      page.drawEllipse({
        ...options,
        x: n('cx'),
        y: n('cy'),
        xScale: n(node.name === 'circle' ? 'r' : 'rx'),
        yScale: n(node.name === 'circle' ? 'r' : 'ry'),
      });
    const style = Object.fromEntries(
      Object.entries(attrs).filter(([key]) =>
        ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity'].includes(key),
      ),
    );
    node.children.forEach((child) => draw(child, style, alpha));
    page.pushOperators(popGraphicsState());
  }
  draw(root, {}, box.opacity);
  page.pushOperators(popGraphicsState());
}
