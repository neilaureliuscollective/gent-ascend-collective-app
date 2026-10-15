import {
  cloneDocument,
  layerById,
  parseDesignDocument,
  type DesignDocument,
  type DesignLayer,
} from './document';

/**
 * World-canonical geometry: every drawable layer stores page-space x/y/width/height/rotation.
 * Group records store the axis-aligned bounds of their members. Group rotation and scale are
 * baked into children after a transform so canvas, JSON and exporters agree without a second
 * coordinate system.
 */
/** Document stores unrotated top-left. Rotation and Fabric origin are the box centre. */
export function layerCenter(layer: { x: number; y: number; width: number; height: number }) {
  return { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 };
}

export function fabricBoxFromLayer(
  layer: { x: number; y: number; width: number; height: number; rotation: number },
  px: (value: number) => number,
  bleedX: number,
  bleedY: number,
) {
  return {
    originX: 'center' as const,
    originY: 'center' as const,
    left: bleedX + px(layer.x) + px(layer.width) / 2,
    top: bleedY + px(layer.y) + px(layer.height) / 2,
    angle: layer.rotation,
  };
}

export function layerBoxFromFabricCenter(
  center: { x: number; y: number },
  widthPx: number,
  heightPx: number,
  angle: number,
  bleedX: number,
  bleedY: number,
  fromPx: (value: number) => number,
  snap: (value: number) => number,
) {
  return {
    x: snap(fromPx(center.x - widthPx / 2 - bleedX)),
    y: snap(fromPx(center.y - heightPx / 2 - bleedY)),
    width: snap(fromPx(widthPx)),
    height: snap(fromPx(heightPx)),
    rotation: angle,
  };
}

/** Axis-aligned bounds of a layer after its stored rotation about the box centre. */
export function layerWorldCorners(layer: DesignLayer) {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const rad = ((layer.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const points = [
    [layer.x, layer.y],
    [layer.x + layer.width, layer.y],
    [layer.x + layer.width, layer.y + layer.height],
    [layer.x, layer.y + layer.height],
  ] as const;
  return points.map(([px, py]) => {
    const dx = px - cx;
    const dy = py - cy;
    return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
  });
}

export function groupWorldBounds(layers: DesignLayer[]) {
  if (!layers.length) return { x: 0, y: 0, width: 1, height: 1 };
  const corners = layers.flatMap(layerWorldCorners);
  const left = Math.min(...corners.map((point) => point.x));
  const top = Math.min(...corners.map((point) => point.y));
  const right = Math.max(...corners.map((point) => point.x));
  const bottom = Math.max(...corners.map((point) => point.y));
  return {
    x: left,
    y: top,
    width: Math.max(0.01, right - left),
    height: Math.max(0.01, bottom - top),
  };
}

export function groupedMembers(document: DesignDocument, groupId: string) {
  return document.layers.filter((layer) => layer.parentId === groupId);
}

export function bakeGroupWorld(document: DesignDocument, groupId: string): DesignDocument {
  const next = cloneDocument(document);
  const group = layerById(next, groupId);
  if (group.type !== 'group') return next;
  Object.assign(group, { ...groupWorldBounds(groupedMembers(next, groupId)), rotation: 0 });
  return parseDesignDocument(next);
}

export function createGroupLayer(
  document: DesignDocument,
  ids: string[],
  id: string,
): Extract<DesignLayer, { type: 'group' }> {
  const members = ids.map((layerId) => layerById(document, layerId));
  return {
    id,
    type: 'group',
    name: 'Group',
    parentId: null,
    visible: true,
    locked: false,
    opacity: 1,
    rotation: 0,
    ...groupWorldBounds(members),
  };
}

export function applyLayerPatches(
  document: DesignDocument,
  patches: Record<string, Partial<DesignLayer>>,
): DesignDocument {
  const next = cloneDocument(document);
  const groupIds = new Set<string>();
  for (const [id, patch] of Object.entries(patches)) {
    const layer = next.layers.find((item) => item.id === id);
    if (!layer || layer.locked) continue;
    Object.assign(layer, patch, { id: layer.id, type: layer.type });
    if (layer.type === 'group') groupIds.add(layer.id);
    if (layer.parentId) groupIds.add(layer.parentId);
  }
  for (const groupId of groupIds) {
    const group = next.layers.find((item) => item.id === groupId);
    if (!group || group.type !== 'group') continue;
    Object.assign(group, { ...groupWorldBounds(groupedMembers(next, groupId)), rotation: 0 });
  }
  return parseDesignDocument(next);
}
