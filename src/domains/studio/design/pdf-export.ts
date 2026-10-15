import { readFile } from 'node:fs/promises';
import {
  PDFDocument,
  clip,
  concatTransformationMatrix,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { designFont, designFontPath, type DesignFontId } from './fonts';
import { loadDesignFont, wrapText } from './measure';
import { mediaPoints, toInches, toPoints } from './units';
import type { Font } from '@pdf-lib/fontkit';
import { visibleOrder, type DesignDocument, type DesignLayer } from './document';
import { escapeXml, sanitizeSvg } from './sanitize';
import { assetPngBytes, rasterizeSvgMarkup } from './raster';
import type { AssetBytes } from './assets';

function color(hex: string) {
  const value = hex.replace('#', '');
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}

function pt(value: number, document: DesignDocument) {
  return toPoints(value, document.page.unit, document.page.ppi);
}

function withRotation(page: PDFPage, cx: number, cy: number, angle: number, draw: () => void) {
  if (!angle) {
    draw();
    return;
  }
  // Canvas/SVG positive rotation is clockwise in y-down space. PDF is y-up, so negate.
  const r = (-angle * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(cos, sin, -sin, cos, cx - cos * cx + sin * cy, cy - sin * cx - cos * cy),
  );
  draw();
  page.pushOperators(popGraphicsState());
}

function roundedRectPath(x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.min(Math.max(0, radius), w / 2, h / 2);
  if (r <= 0) return `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`;
  return `M ${x + r} ${y} H ${x + w - r} Q ${x + w} ${y} ${x + w} ${y + r} V ${y + h - r} Q ${x + w} ${y + h} ${x + w - r} ${y + h} H ${x + r} Q ${x} ${y + h} ${x} ${y + h - r} V ${y + r} Q ${x} ${y} ${x + r} ${y} Z`;
}

export async function exportPdf(document: DesignDocument, assets: AssetBytes[]) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(document.title);
  pdf.setProducer('Aethelios Studio');
  pdf.setCreator('Aethelios Studio');
  const media = mediaPoints(document.page);
  const page = pdf.addPage([media.width, media.height]);
  const safe = {
    left: pt(document.page.safe.left, document),
    right: pt(document.page.safe.right, document),
    top: pt(document.page.safe.top, document),
    bottom: pt(document.page.safe.bottom, document),
  };
  page.setMediaBox(0, 0, media.width, media.height);
  page.setBleedBox(0, 0, media.width, media.height);
  page.setTrimBox(media.left, media.bottom, media.trimWidth, media.trimHeight);
  page.setArtBox(
    media.left + safe.left,
    media.bottom + safe.bottom,
    media.trimWidth - safe.left - safe.right,
    media.trimHeight - safe.top - safe.bottom,
  );
  page.setCropBox(0, 0, media.width, media.height);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: media.width,
    height: media.height,
    color: color(document.page.background),
  });
  const fonts = new Map<DesignFontId, PDFFont>();
  for (const layer of document.layers) {
    if (layer.type !== 'text') continue;
    if (fonts.has(layer.fontId)) continue;
    const spec = designFont(layer.fontId);
    fonts.set(
      layer.fontId,
      await pdf.embedFont(await readFile(designFontPath(layer.fontId)), {
        subset: spec.file.endsWith('.ttf'),
      }),
    );
  }
  const lookup = new Map(assets.map((asset) => [`${asset.kind}:${asset.id}`, asset]));
  for (const layer of visibleOrder(document)) {
    if (layer.opacity <= 0) continue;
    if (layer.type === 'group') continue;
    await drawLayer(pdf, page, document, layer, fonts, lookup, media);
  }
  const inches = {
    width: toInches(document.page.width, document.page.unit, document.page.ppi),
    height: toInches(document.page.height, document.page.unit, document.page.ppi),
  };
  pdf.setSubject(
    `RGB export trim ${inches.width.toFixed(4)}×${inches.height.toFixed(4)} in. Bleed extends the media box outward and does not shrink trim. SVG logos are rasterized to PNG in this PDF; they are not retained as vector artwork. Variable font weights 600/700 are rasterized from the real wght instance via SVG; they are not faux-bold. Not CMYK, PDF/X or printer-certified. Dimension source: ${document.page.dimensionSource}. ${document.page.dimensionNote}`,
  );
  return pdf.save();
}

async function embedAsset(pdf: PDFDocument, asset: AssetBytes): Promise<PDFImage> {
  if (asset.mediaType === 'image/png') return pdf.embedPng(asset.bytes);
  if (asset.mediaType === 'image/jpeg') return pdf.embedJpg(asset.bytes);
  return pdf.embedPng(await assetPngBytes(asset));
}

async function drawLayer(
  pdf: PDFDocument,
  page: PDFPage,
  document: DesignDocument,
  layer: DesignLayer,
  fonts: Map<DesignFontId, PDFFont>,
  lookup: Map<string, AssetBytes>,
  media: ReturnType<typeof mediaPoints>,
) {
  const x = media.left + pt(layer.x, document);
  const yTop = media.top + pt(layer.y, document);
  const width = pt(layer.width, document);
  const height = pt(layer.height, document);
  const y = media.height - yTop - height;
  const opacity = layer.opacity;
  const cx = x + width / 2;
  const cy = y + height / 2;
  withRotation(page, cx, cy, layer.rotation, () => {
    if (layer.type === 'rect') {
      page.drawSvgPath(roundedRectPath(x, y, width, height, pt(layer.cornerRadius, document)), {
        color: color(layer.fill),
        borderColor: layer.stroke ? color(layer.stroke) : undefined,
        borderWidth: layer.strokeWidth ? pt(layer.strokeWidth, document) : 0,
        opacity,
      });
    } else if (layer.type === 'ellipse') {
      page.drawEllipse({
        x: cx,
        y: cy,
        xScale: width / 2,
        yScale: height / 2,
        color: color(layer.fill),
        borderColor: layer.stroke ? color(layer.stroke) : undefined,
        borderWidth: layer.strokeWidth ? pt(layer.strokeWidth, document) : 0,
        opacity,
      });
    }
  });
  if (layer.type === 'image') {
    const asset = lookup.get(`${layer.assetKind}:${layer.assetId}`);
    if (!asset) throw new Error(`Missing asset for layer ${layer.name}.`);
    const image = await embedAsset(pdf, asset);
    withRotation(page, cx, cy, layer.rotation, () => {
      page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
      const fullW = width / layer.crop.width;
      const fullH = height / layer.crop.height;
      page.drawImage(image, {
        x: x - layer.crop.x * fullW,
        y: y - (1 - layer.crop.y - layer.crop.height) * fullH,
        width: fullW,
        height: fullH,
        opacity,
      });
      page.pushOperators(popGraphicsState());
    });
    return;
  }
  if (layer.type === 'svg') {
    const markup = sanitizeSvg(layer.markup);
    const png = await rasterizeSvgMarkup(markup, Math.max(1, Math.round(width * (document.page.ppi / 72))), Math.max(1, Math.round(height * (document.page.ppi / 72))));
    const image = await pdf.embedPng(png);
    withRotation(page, cx, cy, layer.rotation, () => {
      page.drawImage(image, { x, y, width, height, opacity });
    });
    return;
  }
  if (layer.type !== 'text') {
    if (layer.type === 'rect' || layer.type === 'ellipse') return;
    throw new Error(`Layer “${layer.name}” (${layer.type}) cannot be exported to PDF.`);
  }
  if (!fonts.get(layer.fontId))
    throw new Error(`Missing font: ${layer.fontId}. Studio does not substitute another typeface.`);
  const kit = await loadDesignFont(layer.fontId, layer.fontWeight);
  if (layer.fontWeight !== 400) {
    const png = await rasterizeWeightedText(layer, document, width, height);
    const image = await pdf.embedPng(png);
    withRotation(page, cx, cy, layer.rotation, () => {
      page.drawImage(image, { x, y, width, height, opacity });
    });
    return;
  }
  const wrapped = wrapText(layer, kit, width / 72);
  withRotation(page, cx, cy, layer.rotation, () => {
    wrapped.lines.forEach((line, index) => {
      const lineWidth = wrapped.widths[index] ?? 0;
      let cursor = x;
      if (layer.align === 'center') cursor = x + (width - lineWidth) / 2;
      if (layer.align === 'right') cursor = x + width - lineWidth;
      const baseline = y + height - (index + 1) * wrapped.lineAdvance + layer.fontSize * 0.2;
      drawGlyphRun(page, kit, line, {
        x: cursor,
        y: baseline,
        size: layer.fontSize,
        color: color(layer.fill),
        opacity,
        letterSpacing: layer.letterSpacing,
      });
    });
  });
}

async function rasterizeWeightedText(
  layer: Extract<DesignLayer, { type: 'text' }>,
  document: DesignDocument,
  widthPt: number,
  heightPt: number,
) {
  const spec = designFont(layer.fontId);
  const bytes = await readFile(designFontPath(layer.fontId));
  const mime = spec.file.endsWith('.woff2') ? 'font/woff2' : 'font/ttf';
  const fmt = mime === 'font/woff2' ? 'woff2' : 'truetype';
  const pxW = Math.max(1, Math.round(widthPt * (document.page.ppi / 72)));
  const pxH = Math.max(1, Math.round(heightPt * (document.page.ppi / 72)));
  const fontSizePx = layer.fontSize * (document.page.ppi / 72);
  const kit = await loadDesignFont(layer.fontId, layer.fontWeight);
  const wrapped = wrapText(layer, kit, widthPt / 72);
  const anchor = layer.align === 'center' ? 'middle' : layer.align === 'right' ? 'end' : 'start';
  const x = layer.align === 'center' ? pxW / 2 : layer.align === 'right' ? pxW : 0;
  const lines = wrapped.lines
    .map((line, index) => {
      const y = (index + 0.9) * fontSizePx * layer.lineHeight;
      return `<tspan x="${x}" y="${y}">${escapeXml(line)}</tspan>`;
    })
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pxW}" height="${pxH}" viewBox="0 0 ${pxW} ${pxH}"><defs><style>@font-face{font-family:${JSON.stringify(spec.family)};src:url("data:${mime};base64,${Buffer.from(bytes).toString('base64')}") format("${fmt}");font-weight:100 900;}</style></defs><text xml:space="preserve" font-family="${escapeXml(spec.family)}" font-size="${fontSizePx}" font-weight="${layer.fontWeight}" fill="${escapeXml(layer.fill)}" text-anchor="${anchor}" letter-spacing="${layer.letterSpacing * (document.page.ppi / 72)}">${lines}</text></svg>`;
  return rasterizeSvgMarkup(svg, pxW, pxH);
}

function drawGlyphRun(
  page: PDFPage,
  font: Font,
  line: string,
  input: {
    x: number;
    y: number;
    size: number;
    color: ReturnType<typeof rgb>;
    opacity: number;
    letterSpacing: number;
  },
) {
  const scale = input.size / font.unitsPerEm;
  const run = font.layout(line);
  let cursor = input.x;
  run.glyphs.forEach((glyph, index) => {
    const path = glyph.path.toSVG();
    if (path) {
      page.pushOperators(pushGraphicsState(), concatTransformationMatrix(scale, 0, 0, scale, cursor, input.y));
      page.drawSvgPath(path, { color: input.color, opacity: input.opacity });
      page.pushOperators(popGraphicsState());
    }
    const position = run.positions[index];
    cursor += (position?.xAdvance ?? glyph.advanceWidth) * scale + input.letterSpacing;
  });
}
