import { readFile } from 'node:fs/promises';
import { designFont, designFontPath } from './fonts';
import { escapeXml, sanitizeSvg } from './sanitize';
import { loadDesignFont, wrapText, weightAdvanceScale } from './measure';
import { glyphScale, mediaInches, mediaPixels, pointsToPixels, toPixels } from './units';
import { visibleOrder, type DesignDocument, type DesignLayer } from './document';
import type { AssetBytes } from './assets';

export type SvgFontMode = 'embed' | 'outline';

function px(value: number, document: DesignDocument) {
  return toPixels(value, document.page.unit, document.page.ppi);
}

function transform(layer: DesignLayer, document: DesignDocument, offsetX = 0, offsetY = 0) {
  const x = px(layer.x, document) + offsetX;
  const y = px(layer.y, document) + offsetY;
  const w = px(layer.width, document);
  const h = px(layer.height, document);
  const rotate = layer.rotation ? `rotate(${layer.rotation} ${x + w / 2} ${y + h / 2})` : '';
  const nested = layer.rotation ? `translate(${x} ${y}) rotate(${layer.rotation} ${w / 2} ${h / 2})` : `translate(${x} ${y})`;
  return {
    x,
    y,
    w,
    h,
    attr: rotate ? ` transform="${rotate}"` : '',
    group: nested,
  };
}

export function nestedSvg(markup: string, width: number, height: number) {
  const sanitized = sanitizeSvg(markup);
  const viewBox = sanitized.match(/\bviewBox\s*=\s*"([^"]+)"/i)?.[1];
  const ratio = sanitized.match(/\bpreserveAspectRatio\s*=\s*"([^"]+)"/i)?.[1] ?? 'xMidYMid meet';
  const opening = `<svg width="${width}" height="${height}"${viewBox ? ` viewBox="${viewBox}"` : ''} preserveAspectRatio="${ratio}">`;
  return sanitized.replace(/<svg\b[^>]*>/i, opening);
}

export async function exportSvg(
  document: DesignDocument,
  assets: AssetBytes[],
  fontMode: SvgFontMode = 'embed',
) {
  const { width, height, offsetX, offsetY } = mediaPixels(document.page);
  const inches = mediaInches(document.page);
  const fonts = [
    ...new Set(document.layers.filter((layer) => layer.type === 'text').map((layer) => layer.fontId)),
  ];
  const faces: string[] = [];
  if (fontMode === 'embed') {
    for (const id of fonts) {
      const spec = designFont(id);
      const bytes = await readFile(designFontPath(id));
      const mime = spec.file.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';
      faces.push(
        `@font-face{font-family:${JSON.stringify(spec.family)};src:url("data:${mime};base64,${Buffer.from(bytes).toString('base64')}") format("${mime === 'font/woff2' ? 'woff2' : 'truetype'}");font-weight:100 900;}`,
      );
    }
  }
  const lookup = new Map(assets.map((asset) => [`${asset.kind}:${asset.id}`, asset]));
  const parts: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" width="${inches.width}in" height="${inches.height}in" viewBox="0 0 ${width} ${height}" role="img">`,
    `<title>${escapeXml(document.title)}</title>`,
    `<desc>${escapeXml(document.page.dimensionNote || 'Aethelios Studio design. RGB vector. Not CMYK or PDF/X.')}</desc>`,
  ];
  if (faces.length) parts.push(`<defs><style type="text/css">${faces.join('')}</style></defs>`);
  parts.push(`<rect width="${width}" height="${height}" fill="${escapeXml(document.page.background)}"/>`);
  let clip = 0;
  for (const layer of visibleOrder(document)) {
    if (layer.opacity <= 0 || layer.type === 'group') continue;
    const t = transform(layer, document, offsetX, offsetY);
    const opacity = layer.opacity < 1 ? ` opacity="${layer.opacity}"` : '';
    if (layer.type === 'rect') {
      parts.push(
        `<rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}" rx="${px(layer.cornerRadius, document)}" fill="${escapeXml(layer.fill)}"${layer.stroke && layer.strokeWidth ? ` stroke="${escapeXml(layer.stroke)}" stroke-width="${px(layer.strokeWidth, document)}"` : ''}${opacity}${t.attr}/>`,
      );
    } else if (layer.type === 'ellipse') {
      parts.push(
        `<ellipse cx="${t.x + t.w / 2}" cy="${t.y + t.h / 2}" rx="${t.w / 2}" ry="${t.h / 2}" fill="${escapeXml(layer.fill)}"${layer.stroke && layer.strokeWidth ? ` stroke="${escapeXml(layer.stroke)}" stroke-width="${px(layer.strokeWidth, document)}"` : ''}${opacity}${t.attr}/>`,
      );
    } else if (layer.type === 'image') {
      const asset = lookup.get(`${layer.assetKind}:${layer.assetId}`);
      if (!asset) throw new Error(`Missing asset for layer ${layer.name}.`);
      const href = `data:${asset.mediaType};base64,${Buffer.from(asset.bytes).toString('base64')}`;
      const id = `crop-${clip++}`;
      const fullW = t.w / layer.crop.width;
      const fullH = t.h / layer.crop.height;
      const imgX = t.x - layer.crop.x * fullW;
      const imgY = t.y - layer.crop.y * fullH;
      parts.push(`<clipPath id="${id}"><rect x="${t.x}" y="${t.y}" width="${t.w}" height="${t.h}"/></clipPath>`);
      parts.push(
        `<g${t.attr}${opacity}><image x="${imgX}" y="${imgY}" width="${fullW}" height="${fullH}" preserveAspectRatio="none" href="${escapeXml(href)}" clip-path="url(#${id})"/></g>`,
      );
    } else if (layer.type === 'svg') {
      parts.push(
        `<g transform="${t.group}"${opacity}>${nestedSvg(layer.markup, t.w, t.h)}</g>`,
      );
    } else if (layer.type === 'text') {
      const font = await loadDesignFont(layer.fontId, layer.fontWeight);
      const spec = designFont(layer.fontId);
      const wrapped = wrapText(
        layer,
        font,
        t.w / document.page.ppi,
        await weightAdvanceScale(layer.fontId, layer.fontWeight),
      );
      const ppi = document.page.ppi;
      if (fontMode === 'outline') {
        if (layer.fontWeight !== 400)
          throw new Error(
            `Outline SVG cannot instantiate WOFF2 ${layer.fontId} weight ${layer.fontWeight}. Export embed SVG or PNG, which apply the real variable weight. Studio will not simulate bold.`,
          );
        const scale = glyphScale(layer.fontSize, ppi, font.unitsPerEm);
        const tracking = pointsToPixels(layer.letterSpacing, ppi);
        if (t.attr) parts.push(`<g${t.attr}${opacity}>`);
        wrapped.lines.forEach((line, index) => {
          const run = font.layout(line);
          const widthPx = pointsToPixels(wrapped.widths[index] ?? 0, ppi);
          let cursor = t.x;
          if (layer.align === 'center') cursor = t.x + (t.w - widthPx) / 2;
          if (layer.align === 'right') cursor = t.x + t.w - widthPx;
          const baseline = t.y + (index + 0.8) * pointsToPixels(wrapped.lineAdvance, ppi);
          let x = cursor;
          run.glyphs.forEach((glyph, glyphIndex) => {
            const position = run.positions[glyphIndex];
            const path = glyph.path.toSVG();
            if (path)
              parts.push(
                `<path fill="${escapeXml(layer.fill)}" transform="translate(${x} ${baseline}) scale(${scale} ${-scale})" d="${escapeXml(path)}"${opacity}/>`,
              );
            x += (position?.xAdvance ?? glyph.advanceWidth) * scale + tracking;
          });
        });
        if (t.attr) parts.push('</g>');
      } else {
        const anchor = layer.align === 'center' ? 'middle' : layer.align === 'right' ? 'end' : 'start';
        const x = layer.align === 'center' ? t.x + t.w / 2 : layer.align === 'right' ? t.x + t.w : t.x;
        parts.push(
          `<text xml:space="preserve" x="${x}" font-family="${escapeXml(spec.family)}" font-size="${layer.fontSize * (document.page.ppi / 72)}" font-weight="${layer.fontWeight}" letter-spacing="${pointsToPixels(layer.letterSpacing, ppi)}" fill="${escapeXml(layer.fill)}" text-anchor="${anchor}"${opacity}${t.attr}>`,
        );
        wrapped.lines.forEach((line, index) => {
          const y = t.y + (index + 0.9) * pointsToPixels(wrapped.lineAdvance, ppi);
          parts.push(`<tspan x="${x}" y="${y}">${escapeXml(line)}</tspan>`);
        });
        parts.push('</text>');
      }
    }
  }
  parts.push('</svg>');
  return new TextEncoder().encode(parts.join(''));
}
