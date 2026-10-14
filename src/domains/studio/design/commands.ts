import {
  cloneDocument,
  layerById,
  parseDesignDocument,
  type DesignDocument,
  type DesignLayer,
} from './document';

export type DesignCommand =
  | { type: 'replace'; document: DesignDocument }
  | { type: 'add'; layer: DesignLayer; index?: number }
  | { type: 'remove'; id: string }
  | { type: 'update'; id: string; patch: Partial<DesignLayer> }
  | { type: 'reorder'; ids: string[] }
  | { type: 'group'; ids: string[]; group: Extract<DesignLayer, { type: 'group' }> }
  | { type: 'ungroup'; groupId: string };

export type DesignHistory = { past: DesignDocument[]; future: DesignDocument[] };
const LIMIT = 50;

export function emptyHistory(): DesignHistory {
  return { past: [], future: [] };
}

function applyCommand(document: DesignDocument, command: DesignCommand): DesignDocument {
  const next = cloneDocument(document);
  if (command.type === 'replace') return cloneDocument(command.document);
  if (command.type === 'add') {
    const at = command.index ?? next.layers.length;
    next.layers.splice(at, 0, command.layer);
    return parseDesignDocument(next);
  }
  if (command.type === 'remove') {
    const remove = new Set(
      next.layers
        .filter((layer) => layer.id === command.id || layer.parentId === command.id)
        .map((layer) => layer.id),
    );
    next.layers = next.layers.filter((layer) => !remove.has(layer.id));
    return parseDesignDocument(next);
  }
  if (command.type === 'update') {
    const layer = layerById(next, command.id);
    Object.assign(layer, command.patch, { id: layer.id, type: layer.type });
    return parseDesignDocument(next);
  }
  if (command.type === 'reorder') {
    if (new Set(command.ids).size !== next.layers.length)
      throw new Error('Reorder must include every layer.');
    next.layers = command.ids.map((id) => layerById(next, id));
    return parseDesignDocument(next);
  }
  if (command.type === 'group') {
    for (const id of command.ids) layerById(next, id).parentId = command.group.id;
    next.layers.push(command.group);
    return parseDesignDocument(next);
  }
  for (const layer of next.layers) if (layer.parentId === command.groupId) layer.parentId = null;
  next.layers = next.layers.filter((layer) => layer.id !== command.groupId);
  return parseDesignDocument(next);
}

export function commitDesign(
  document: DesignDocument,
  history: DesignHistory,
  command: DesignCommand,
) {
  const next = applyCommand(document, command);
  return {
    document: next,
    history: {
      past: [...history.past, cloneDocument(document)].slice(-LIMIT),
      future: [],
    },
  };
}

export function undoDesign(document: DesignDocument, history: DesignHistory) {
  const previous = history.past.at(-1);
  if (!previous) return { document, history };
  return {
    document: cloneDocument(previous),
    history: {
      past: history.past.slice(0, -1),
      future: [cloneDocument(document), ...history.future].slice(0, LIMIT),
    },
  };
}

export function redoDesign(document: DesignDocument, history: DesignHistory) {
  const following = history.future[0];
  if (!following) return { document, history };
  return {
    document: cloneDocument(following),
    history: {
      past: [...history.past, cloneDocument(document)].slice(-LIMIT),
      future: history.future.slice(1),
    },
  };
}

export function alignLayers(
  document: DesignDocument,
  ids: string[],
  edge: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
) {
  const layers = ids.map((id) => layerById(document, id));
  if (layers.some((layer) => layer.locked)) throw new Error('Unlock layers before aligning them.');
  const minX = Math.min(...layers.map((layer) => layer.x));
  const maxX = Math.max(...layers.map((layer) => layer.x + layer.width));
  const minY = Math.min(...layers.map((layer) => layer.y));
  const maxY = Math.max(...layers.map((layer) => layer.y + layer.height));
  const midX = (minX + maxX) / 2;
  const midY = (minY + maxY) / 2;
  const next = cloneDocument(document);
  for (const id of ids) {
    const layer = layerById(next, id);
    if (edge === 'left') layer.x = minX;
    if (edge === 'right') layer.x = maxX - layer.width;
    if (edge === 'center') layer.x = midX - layer.width / 2;
    if (edge === 'top') layer.y = minY;
    if (edge === 'bottom') layer.y = maxY - layer.height;
    if (edge === 'middle') layer.y = midY - layer.height / 2;
  }
  return parseDesignDocument(next);
}

export function snapValue(value: number, grid: number) {
  if (grid <= 0) return value;
  return Math.round(value / grid) * grid;
}
