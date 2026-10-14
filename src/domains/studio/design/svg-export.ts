import { readFile } from 'node:fs/promises';
import { designFont, designFontPath } from './fonts';
import { escapeXml } from './sanitize';
import { loadDesignFont, wrapText } from './measure';
import { pagePixels, toPixels } from './units';
import { visibleOrder, type DesignDocument, type DesignLayer } from './document';
import type { AssetBytes } from './assets';

export type SvgFontMode = 'embed' | 'outline';

function px(value: number, document: DesignDocument) {
  return toPixels(value, document.page.unit, document.page.ppi);
}

function transform(layer: DesignLayer, document: DesignDocument) {
  const x = px(layer.x, document);
  const y = px(layer.y, document);
  const w = px(layer.width, document);
  const h = px(layer.height, document);
  if (!layer.rotation) return { x, y, w, h, extra: '' };
  return {
    x,
    y,
    w,
    h,
    extra: ` transform="rotate(${layer.rotation} ${x + w / 2} ${y + h / 2})"`,
  };
}

async function fontFace(id: DesignDocument['layers'][number] extends { fontId: infer F } ? F : never) {
  void id;
}

export async function exportSvg(
  document: DesignDocument,
  assets: AssetBytes[],
  fontMode: SvgFontMode = 'embed',
) {
  const { width, height } = pagePixels(document.page);
  const fonts = [
    ...new Set(
      document.layers.filter((layer) => layer.type === 'text').map((layer) => layer.fontId),
    ),
  ];
  const faces: string[] = [];
  if (fontMode === 'embed') {
    for (const id of fonts) {
      const spec = designFont(id);
      const bytes = await readFile(designFontPath(id));
      const mime = spec.file.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';
      faces.push(
        `@font-face{font-family:${JSON.stringify(spec.family)};src:url("data:${mime};base64,${Buffer.from(bytes).toString('base64')}") format("${mime === 'font/woff2' ? 'woff2' : 'truetype'}");}`,
      );
    }
  }
  const lookup = new Map(assets.map((asset) => [`${asset.kind}:${asset.id}`, asset]));
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">`,
    `<title>${escapeXml(document.title)}</title>`,
    `<desc>${escapeXml(document.page.dimensionNote || 'Aethelios Studio design')}</desc>`,
  ];
  if (faces.length)
    parts.push(`<defs><style type="text/css">${faces.join('')}</style></defs>`);
  parts.push(
    `<rect width="${width}" height="${height}" fill="${escapeXml(document.page.background)}"/>`,
  );
  for (const layer of visibleOrder(document)) {
    if (layer.opacity <= 0) continue;
    const t = transform(layer, document);
    const opacity = layer.opacity < 1 ? ` opacity="${layer.opacity}"` : '';
    if (layer.type === 'rect') {
      parts.push(
        `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="${px(layer.cornerRadius, document)}" fill="${escapeXml(layer.fill)}"${layer.stroke && layer.strokeWidth ? ` stroke="${escapeXml(layer.stroke)}" stroke-width="${px(layer.strokeWidth, document)}"` : ''}${opacity}${t.extra}/>`,
      );
    } else if (layer.type === 'ellipse') {
      parts.push(
        `<ellipse cx="${t.x + t.w / 2}" cy="${t.y + t.h / 2}" rx="${t.w / 2}" ry="${t.h / 2}" fill="${escapeXml(layer.fill)}"${layer.stroke && layer.strokeWidth ? ` stroke="${escapeXml(layer.stroke)}" stroke-width="${px(layer.strokeWidth, document)}"` : ''}${opacity}${t.extra}/>`,
      );
    } else if (layer.type === 'image') {
      const asset = lookup.get(`${layer.assetKind}:${layer.assetId}`);
      if (!asset) throw new Error(`Missing asset for layer ${layer.name}.`);
      const href = `data:${asset.mediaType};base64,${Buffer.from(asset.bytes).toString('base64')}`;
      parts.push(
        `<image x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" preserveAspectRatio="xMidYMid slice" href="${escapeXml(href)}"${opacity}${t.extra}/>`,
      );
    } else if (layer.type === 'svg') {
      parts.push(`<g transform="translate(${t.x} ${t.y})"${opacity}${t.extra}>${layer.markup}</g>`);
    } else if (layer.type === 'text') {
      const font = await loadDesignFont(layer.fontId);
      const spec = designFont(layer.fontId);
      const wrapped = wrapText(layer, font, t.w / document.page.ppi);
      if (fontMode === 'outline') {
        const scale = layer.fontSize / font.unitsPerEm;
        wrapped.lines.forEach((line, index) => {
          const run = font.layout(line);
          let cursor = t.x;
          const width = wrapped.widths[index] ?? 0;
          if (layer.align === 'center') cursor = t.x + (t.w - width) / 2;
          if (layer.align === 'right') cursor = t.x + t.w - width;
          const baseline = t.y + (index + 0.8) * wrapped.lineAdvance * (document.page.ppi / 72);
          let x = cursor;
          run.glyphs.forEach((glyph, glyphIndex) => {
            const position = run.positions[glyphIndex];
            const path = glyph.path.toSVG();
            if (path)
              parts.push(
                `<path fill="${escapeXml(layer.fill)}" transform="translate(${x} ${baseline}) scale(${scale} ${-scale})" d="${escapeXml(path)}"${opacity}/>`,
              );
            x += ((position?.xAdvance ?? glyph.advanceWidth) + layer.letterSpacing / scale) * scale;
          });
        });
      } else {
        const anchor = layer.align === 'center' ? 'middle' : layer.align === 'right' ? 'end' : 'start';
        const x =
          layer.align === 'center' ? t.x + t.w / 2 : layer.align === 'right' ? t.x + t.w : t.x;
        parts.push(`<text xml:space="preserve" x="${x}" font-family="${escapeXml(spec.family)}" font-size="${layer.fontSize * (document.page.ppi / 72)}" font-weight="${layer.fontWeight}" fill="${escapeXml(layer.fill)}" text-anchor="${anchor}"${opacity}${t.extra}>`);
        wrapped.lines.forEach((line, index) => {
          const y = t.y + (index + 0.9) * wrapped.lineAdvance * (document.page.ppi / 72);
          parts.push(`<tspan x="${x}" y="${y}">${escapeXml(line)}</tspan>`);
        });
        parts.push('</text>');
      }
    }
  }
  parts.push('</svg>');
  return new TextEncoder().encode(parts.join(''));
}

void fontFace;
