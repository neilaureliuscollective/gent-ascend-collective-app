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
export function groupWorldBounds(layers: DesignLayer[]) {
  if (!layers.length) return { x: 0, y: 0, width: 1, height: 1 };
  const left = Math.min(...layers.map((layer) => layer.x));
  const top = Math.min(...layers.map((layer) => layer.y));
  const right = Math.max(...layers.map((layer) => layer.x + layer.width));
  const bottom = Math.max(...layers.map((layer) => layer.y + layer.height));
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
