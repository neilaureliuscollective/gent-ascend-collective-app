import { readFile } from 'node:fs/promises';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { designFont, designFontPath, type DesignFontId } from './fonts';
import { loadDesignFont, wrapText } from './measure';
import { pagePoints, toPoints } from './units';
import { visibleOrder, type DesignDocument, type DesignLayer } from './document';
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

export async function exportPdf(document: DesignDocument, assets: AssetBytes[]) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(document.title);
  pdf.setProducer('Aethelios Studio');
  pdf.setCreator('Aethelios Studio');
  const size = pagePoints(document.page);
  const page = pdf.addPage([size.width, size.height]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: size.width,
    height: size.height,
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
    await drawLayer(pdf, page, document, layer, fonts, lookup, size.height);
  }
  pdf.setSubject(
    `RGB vector export. Not CMYK, PDF/X or printer-certified. Dimension source: ${document.page.dimensionSource}. ${document.page.dimensionNote}`,
  );
  return pdf.save();
}

async function drawLayer(
  pdf: PDFDocument,
  page: PDFPage,
  document: DesignDocument,
  layer: DesignLayer,
  fonts: Map<DesignFontId, PDFFont>,
  lookup: Map<string, AssetBytes>,
  pageHeight: number,
) {
  const x = pt(layer.x, document);
  const yTop = pt(layer.y, document);
  const width = pt(layer.width, document);
  const height = pt(layer.height, document);
  const y = pageHeight - yTop - height;
  const opacity = layer.opacity;
  if (layer.type === 'rect') {
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: color(layer.fill),
      borderColor: layer.stroke ? color(layer.stroke) : undefined,
      borderWidth: layer.strokeWidth ? pt(layer.strokeWidth, document) : 0,
      opacity,
    });
    return;
  }
  if (layer.type === 'ellipse') {
    page.drawEllipse({
      x: x + width / 2,
      y: y + height / 2,
      xScale: width / 2,
      yScale: height / 2,
      color: color(layer.fill),
      borderColor: layer.stroke ? color(layer.stroke) : undefined,
      borderWidth: layer.strokeWidth ? pt(layer.strokeWidth, document) : 0,
      opacity,
    });
    return;
  }
  if (layer.type === 'image') {
    const asset = lookup.get(`${layer.assetKind}:${layer.assetId}`);
    if (!asset) throw new Error(`Missing asset for layer ${layer.name}.`);
    const image =
      asset.mediaType === 'image/png' ? await pdf.embedPng(asset.bytes) : await pdf.embedJpg(asset.bytes);
    page.drawImage(image, { x, y, width, height, opacity });
    return;
  }
  if (layer.type !== 'text') return;
  const font = fonts.get(layer.fontId);
  if (!font) throw new Error(`Missing font: ${layer.fontId}. Studio does not substitute another typeface.`);
  const kit = await loadDesignFont(layer.fontId);
  const wrapped = wrapText(layer, kit, width / 72);
  wrapped.lines.forEach((line, index) => {
    const lineWidth = font.widthOfTextAtSize(line, layer.fontSize);
    let cursor = x;
    if (layer.align === 'center') cursor = x + (width - lineWidth) / 2;
    if (layer.align === 'right') cursor = x + width - lineWidth;
    const baseline = y + height - (index + 1) * wrapped.lineAdvance + layer.fontSize * 0.2;
    page.drawText(line, {
      x: cursor,
      y: baseline,
      size: layer.fontSize,
      font,
      color: color(layer.fill),
      opacity,
    });
  });
}
