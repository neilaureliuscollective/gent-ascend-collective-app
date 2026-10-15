import { fontSupportsWeight } from './fonts';
import { measureTextLayer } from './measure';
import { pagePixels, toInches } from './units';
import type { DesignDocument, ImageLayer, TextLayer } from './document';

export type DesignIssue = {
  code:
    | 'missing-font'
    | 'missing-asset'
    | 'text-overflow'
    | 'outside-safe'
    | 'low-resolution'
    | 'unconfirmed-size'
    | 'unsupported-prepress';
  message: string;
  layerId?: string;
};

export type AssetInfo = {
  id: string;
  kind: 'version' | 'reference';
  widthPx?: number;
  heightPx?: number;
};

export async function validateDesign(
  document: DesignDocument,
  assets: AssetInfo[],
): Promise<DesignIssue[]> {
  const issues: DesignIssue[] = [];
  if (document.page.dimensionSource === 'unconfirmed')
    issues.push({
      code: 'unconfirmed-size',
      message:
        'These dimensions are unconfirmed. Enter a printer or supplier die size before treating this as a print master.',
    });
  issues.push({
    code: 'unsupported-prepress',
    message:
      'RGB PDF and SVG exports are not CMYK, PDF/X, spot-color, foil-separation or printer-certified output. Those prepress modes are unavailable.',
  });
  const owned = new Map(assets.map((asset) => [`${asset.kind}:${asset.id}`, asset]));
  for (const layer of document.layers) {
    if (layer.type === 'text') {
      if (!fontSupportsWeight(layer.fontId, layer.fontWeight))
        issues.push({
          code: 'missing-font',
          layerId: layer.id,
          message: `${layer.fontId} does not include weight ${layer.fontWeight}. Studio will not substitute another face.`,
        });
      try {
        const measured = await measureTextLayer(layer, document.page.unit, document.page.ppi);
        if (measured.overflow)
          issues.push({
            code: 'text-overflow',
            layerId: layer.id,
            message: `“${layer.name}” overflows its text box.`,
          });
      } catch (error) {
        issues.push({
          code: 'missing-font',
          layerId: layer.id,
          message: error instanceof Error ? error.message : 'Text could not be measured.',
        });
      }
    }
    if (layer.type === 'image') {
      const asset = owned.get(`${layer.assetKind}:${layer.assetId}`);
      if (!asset)
        issues.push({
          code: 'missing-asset',
          layerId: layer.id,
          message: `Image layer “${layer.name}” references an asset that is not in this project.`,
        });
      else if (asset.widthPx && asset.heightPx) {
        const placed = pagePixels({
          width: layer.width,
          height: layer.height,
          unit: document.page.unit,
          ppi: document.page.ppi,
        });
        const cropW = Math.max(1, asset.widthPx * layer.crop.width);
        const cropH = Math.max(1, asset.heightPx * layer.crop.height);
        const effective = Math.min(cropW / placed.width, cropH / placed.height) * document.page.ppi;
        if (effective + 0.5 < document.page.ppi)
          issues.push({
            code: 'low-resolution',
            layerId: layer.id,
            message: `“${layer.name}” rasterizes at about ${Math.round(effective)} PPI at placed size; the document asks for ${document.page.ppi} PPI.`,
          });
      }
    }
    if (outsideSafe(document, layer))
      issues.push({
        code: 'outside-safe',
        layerId: layer.id,
        message: `“${layer.name}” extends outside the safe area.`,
      });
  }
  return issues;
}

function outsideSafe(document: DesignDocument, layer: { x: number; y: number; width: number; height: number }) {
  const { page } = document;
  const left = page.safe.left;
  const top = page.safe.top;
  const right = page.width - page.safe.right;
  const bottom = page.height - page.safe.bottom;
  return layer.x < left || layer.y < top || layer.x + layer.width > right || layer.y + layer.height > bottom;
}

export function blockingIssues(issues: DesignIssue[]) {
  return issues.filter((issue) => issue.code === 'missing-font' || issue.code === 'missing-asset');
}

export function imageAssetIds(document: DesignDocument): ImageLayer[] {
  return document.layers.filter((layer): layer is ImageLayer => layer.type === 'image');
}

export function textLayers(document: DesignDocument): TextLayer[] {
  return document.layers.filter((layer): layer is TextLayer => layer.type === 'text');
}

export function safeRectInches(document: DesignDocument) {
  const { page } = document;
  return {
    x: toInches(page.safe.left, page.unit, page.ppi),
    y: toInches(page.safe.top, page.unit, page.ppi),
    width: toInches(page.width - page.safe.left - page.safe.right, page.unit, page.ppi),
    height: toInches(page.height - page.safe.top - page.safe.bottom, page.unit, page.ppi),
  };
}
