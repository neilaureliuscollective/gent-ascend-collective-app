'use client';
import { useEffect, useRef, useState } from 'react';
import type { DesignDocument, DesignLayer } from '@/domains/studio/design/document';
import { ancestorsLocked, ancestorsVisible } from '@/domains/studio/design/document';
import { snapValue } from '@/domains/studio/design/commands';
import { designFont } from '@/domains/studio/design/fonts';
import { sanitizeSvg } from '@/domains/studio/design/sanitize';
import { toPixels } from '@/domains/studio/design/units';

type FabricModule = typeof import('fabric');
type FabricObject = InstanceType<FabricModule['FabricObject']> & {
  layerId?: string;
};

function structureKey(document: DesignDocument) {
  return [
    document.id,
    document.page.width,
    document.page.height,
    document.page.unit,
    document.page.ppi,
    document.page.background,
    document.page.bleed.top,
    document.page.safe.top,
    ...document.layers.map((layer) =>
      [
        layer.id,
        layer.type,
        layer.parentId,
        layer.x,
        layer.y,
        layer.width,
        layer.height,
        layer.rotation,
        layer.visible,
        layer.locked,
        layer.name,
        layer.type === 'text' ? `${layer.content}:${layer.fontId}:${layer.fontWeight}:${layer.align}:${layer.fontSize}` : '',
        layer.type === 'svg' ? layer.markup.length : '',
        layer.type === 'image' ? `${layer.assetId}:${layer.crop.x}:${layer.crop.y}:${layer.crop.width}:${layer.crop.height}` : '',
      ].join(':'),
    ),
  ].join('|');
}

export function DesignCanvas({
  document,
  selectedId,
  onSelect,
  onChangeLayer,
  onChangeLayers,
  imageUrl,
}: {
  document: DesignDocument;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeLayer: (id: string, patch: Partial<DesignLayer>) => void;
  onChangeLayers?: (patches: Record<string, Partial<DesignLayer>>) => void;
  imageUrl: (id: string, kind: 'version' | 'reference') => string;
}) {
  const host = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<InstanceType<FabricModule['Canvas']> | null>(null);
  const fabricRef = useRef<FabricModule | null>(null);
  const skip = useRef(false);
  const generation = useRef(0);
  const painted = useRef('');
  const pageRef = useRef(document.page);
  const documentRef = useRef(document);
  const onSelectRef = useRef(onSelect);
  const onChangeRef = useRef(onChangeLayer);
  const onChangesRef = useRef(onChangeLayers);
  const [ready, setReady] = useState(0);

  useEffect(() => {
    pageRef.current = document.page;
    documentRef.current = document;
    onSelectRef.current = onSelect;
    onChangeRef.current = onChangeLayer;
    onChangesRef.current = onChangeLayers;
  });

  useEffect(() => {
    let cancelled = false;
    if (!host.current) return;
    void import('fabric').then((fabric) => {
      if (cancelled || !host.current) return;
      fabricRef.current = fabric;
      const canvas = new fabric.Canvas(host.current, {
        preserveObjectStacking: true,
        selection: true,
        stopContextMenu: true,
        fireRightClick: true,
        uniformScaling: false,
      });
      canvasRef.current = canvas;
      const touch = window.matchMedia('(pointer: coarse)').matches;
      fabric.FabricObject.prototype.set({
        cornerSize: touch ? 22 : 12,
        touchCornerSize: 28,
        transparentCorners: false,
        cornerColor: '#C4912F',
        borderColor: '#7BE0C2',
        cornerStrokeColor: '#050706',
      });
      const selected = () =>
        onSelectRef.current(((canvas.getActiveObject() as { layerId?: string } | undefined)?.layerId) ?? null);
      canvas.on('selection:created', selected);
      canvas.on('selection:updated', selected);
      canvas.on('selection:cleared', () => onSelectRef.current(null));
      canvas.on('object:modified', () => {
        if (skip.current) return;
        const target = canvas.getActiveObject() as FabricObject | undefined;
        if (!target?.layerId) return;
        const patches = readPatches(fabric, documentRef.current, target);
        if (onChangesRef.current && Object.keys(patches).length > 1) onChangesRef.current(patches);
        else {
          const patch = patches[target.layerId];
          if (patch) onChangeRef.current(target.layerId, patch);
        }
      });
      setReady((value) => value + 1);
    });
    return () => {
      cancelled = true;
      generation.current += 1;
      canvasRef.current?.dispose();
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!canvas || !fabric || !ready) return;
    const key = structureKey(document);
    if (key === painted.current) {
      syncGeometry(canvas, document);
      return;
    }
    const gen = ++generation.current;
    skip.current = true;
    void paintDocument(canvas, fabric, document, imageUrl, gen, generation, host.current).then(() => {
      if (gen !== generation.current) return;
      painted.current = key;
      skip.current = false;
      canvas.requestRenderAll();
    });
  }, [document, imageUrl, ready]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || skip.current) return;
    const match = canvas.getObjects().find((object) => (object as FabricObject).layerId === selectedId);
    if (selectedId && match && canvas.getActiveObject() !== match) {
      skip.current = true;
      canvas.setActiveObject(match);
      skip.current = false;
      canvas.requestRenderAll();
    }
    if (!selectedId && canvas.getActiveObject()) {
      skip.current = true;
      canvas.discardActiveObject();
      skip.current = false;
      canvas.requestRenderAll();
    }
  }, [selectedId, ready]);

  return (
    <div className="studio-design-stage">
      <canvas ref={host} aria-label="Design canvas" />
    </div>
  );
}

function fromPx(px: number, unit: DesignDocument['page']['unit'], ppi: number) {
  if (unit === 'px') return px;
  if (unit === 'mm') return (px / ppi) * 25.4;
  return px / ppi;
}

function readPatches(fabric: FabricModule, document: DesignDocument, target: FabricObject) {
  const page = document.page;
  const grid = page.unit === 'mm' ? 0.5 : page.unit === 'in' ? 0.01 : 1;
  const patches: Record<string, Partial<DesignLayer>> = {};
  const write = (object: FabricObject, layerId: string) => {
    const decomposed = fabric.util.qrDecompose(object.calcTransformMatrix());
    const width = Math.max(0.01, (object.width ?? 1) * decomposed.scaleX);
    const height = Math.max(0.01, (object.height ?? 1) * decomposed.scaleY);
    const center =
      typeof object.getCenterPoint === 'function'
        ? object.getCenterPoint()
        : { x: decomposed.translateX, y: decomposed.translateY };
    const bleedX = toPixels(page.bleed.left, page.unit, page.ppi);
    const bleedY = toPixels(page.bleed.top, page.unit, page.ppi);
    patches[layerId] = {
      x: snapValue(fromPx(center.x - width / 2 - bleedX, page.unit, page.ppi), grid),
      y: snapValue(fromPx(center.y - height / 2 - bleedY, page.unit, page.ppi), grid),
      width: snapValue(fromPx(width, page.unit, page.ppi), grid),
      height: snapValue(fromPx(height, page.unit, page.ppi), grid),
      rotation: decomposed.angle,
      ...('text' in object && typeof object.text === 'string' ? { content: object.text } : {}),
    };
  };
  write(target, target.layerId!);
  const grouped = (target as unknown as { getObjects?: () => FabricObject[] }).getObjects?.() ?? [];
  for (const child of grouped) {
    if (child.layerId) write(child, child.layerId);
  }
  return patches;
}

function syncGeometry(canvas: InstanceType<FabricModule['Canvas']>, document: DesignDocument) {
  const px = (value: number) => toPixels(value, document.page.unit, document.page.ppi);
  const bleedX = px(document.page.bleed.left);
  const bleedY = px(document.page.bleed.top);
  for (const object of canvas.getObjects()) {
    const id = (object as FabricObject).layerId;
    if (!id) continue;
    const layer = document.layers.find((item) => item.id === id);
    if (!layer) continue;
    const width = px(layer.width);
    const height = px(layer.height);
    object.set({
      left: bleedX + px(layer.x),
      top: bleedY + px(layer.y),
      angle: layer.rotation,
      opacity: layer.opacity,
      selectable: !ancestorsLocked(document, layer.id),
      evented: !ancestorsLocked(document, layer.id),
      visible: ancestorsVisible(document, layer.id),
    });
    if ('rx' in object && 'ry' in object && layer.type === 'ellipse') {
      object.set({ rx: width / 2, ry: height / 2, scaleX: 1, scaleY: 1 });
    } else {
      const intrinsicW = Math.max(0.01, object.width || 1);
      const intrinsicH = Math.max(0.01, object.height || 1);
      object.set({ scaleX: width / intrinsicW, scaleY: height / intrinsicH });
    }
    object.setCoords();
  }
}

async function paintDocument(
  canvas: InstanceType<FabricModule['Canvas']>,
  fabric: FabricModule,
  document: DesignDocument,
  imageUrl: (id: string, kind: 'version' | 'reference') => string,
  gen: number,
  generation: { current: number },
  host: HTMLCanvasElement | null,
) {
  const px = (value: number) => toPixels(value, document.page.unit, document.page.ppi);
  const trimW = px(document.page.width);
  const trimH = px(document.page.height);
  const bleedX = px(document.page.bleed.left);
  const bleedY = px(document.page.bleed.top);
  const width = trimW + bleedX + px(document.page.bleed.right);
  const height = trimH + bleedY + px(document.page.bleed.bottom);
  const max = Math.min(host?.parentElement?.clientWidth || 720, 900);
  const zoom = Math.min(1, max / Math.max(width, 1));
  canvas.setDimensions({ width: Math.round(width * zoom), height: Math.round(height * zoom) });
  canvas.setZoom(zoom);
  canvas.backgroundColor = document.page.background;
  canvas.clear();
  const made = new Map<string, FabricObject>();
  for (const layer of document.layers) {
    if (gen !== generation.current) return;
    if (layer.type === 'group') continue;
    if (!ancestorsVisible(document, layer.id)) continue;
    const object = await makeObject(fabric, document, layer, imageUrl, px);
    if (gen !== generation.current) return;
    if (object) made.set(layer.id, object);
  }
  if (gen !== generation.current) return;
  const added = new Set<string>();
  for (const layer of document.layers) {
    if (layer.type === 'group') {
      const children = document.layers
        .filter((item) => item.parentId === layer.id && made.has(item.id))
        .map((item) => made.get(item.id)!);
      if (!children.length || !ancestorsVisible(document, layer.id)) continue;
      const group = new fabric.Group(children, {
        originX: 'left',
        originY: 'top',
        left: bleedX + px(layer.x),
        top: bleedY + px(layer.y),
        angle: layer.rotation,
        opacity: layer.opacity,
        selectable: !ancestorsLocked(document, layer.id),
        evented: !ancestorsLocked(document, layer.id),
        subTargetCheck: false,
      }) as FabricObject;
      group.layerId = layer.id;
      canvas.add(group);
      for (const child of children) added.add(child.layerId!);
      continue;
    }
    const object = made.get(layer.id);
    if (!object || layer.parentId || added.has(layer.id)) continue;
    canvas.add(object);
  }
  const widthPx = trimW;
  const heightPx = trimH;
  const guide = (left: number, top: number, w: number, h: number, stroke: string) =>
    new fabric.Rect({
      left,
      top,
      width: Math.max(1, w),
      height: Math.max(1, h),
      fill: 'transparent',
      stroke,
      strokeDashArray: [8, 6],
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
  canvas.add(guide(bleedX, bleedY, widthPx, heightPx, '#C4912F'));
  canvas.add(
    guide(
      bleedX + px(document.page.safe.left),
      bleedY + px(document.page.safe.top),
      widthPx - px(document.page.safe.left) - px(document.page.safe.right),
      heightPx - px(document.page.safe.top) - px(document.page.safe.bottom),
      '#7BE0C2',
    ),
  );
}

async function makeObject(
  fabric: FabricModule,
  document: DesignDocument,
  layer: DesignLayer,
  imageUrl: (id: string, kind: 'version' | 'reference') => string,
  px: (value: number) => number,
): Promise<FabricObject | null> {
  const locked = ancestorsLocked(document, layer.id);
  const bleedX = px(document.page.bleed.left);
  const bleedY = px(document.page.bleed.top);
  const common = {
    left: bleedX + px(layer.x),
    top: bleedY + px(layer.y),
    angle: layer.rotation,
    opacity: layer.opacity,
    selectable: !locked,
    evented: !locked,
    originX: 'left' as const,
    originY: 'top' as const,
    layerId: layer.id,
  };
  if (layer.type === 'rect') {
    const rect = new fabric.Rect({
      ...common,
      width: px(layer.width),
      height: px(layer.height),
      fill: layer.fill,
      stroke: layer.stroke ?? undefined,
      strokeWidth: px(layer.strokeWidth),
      rx: px(layer.cornerRadius),
      ry: px(layer.cornerRadius),
    }) as FabricObject;
    rect.layerId = layer.id;
    return rect;
  }
  if (layer.type === 'ellipse') {
    const ellipse = new fabric.Ellipse({
      ...common,
      rx: px(layer.width) / 2,
      ry: px(layer.height) / 2,
      fill: layer.fill,
      stroke: layer.stroke ?? undefined,
      strokeWidth: px(layer.strokeWidth),
    }) as FabricObject;
    ellipse.layerId = layer.id;
    return ellipse;
  }
  if (layer.type === 'text') {
    const spec = designFont(layer.fontId);
    const text = new fabric.Textbox(layer.content, {
      ...common,
      width: px(layer.width),
      fontSize: layer.fontSize * (document.page.ppi / 72),
      fontFamily: spec.cssFamily,
      fontWeight: String(layer.fontWeight),
      fill: layer.fill,
      textAlign: layer.align,
      lineHeight: layer.lineHeight,
      charSpacing: layer.letterSpacing * 10,
    }) as FabricObject;
    text.layerId = layer.id;
    return text;
  }
  if (layer.type === 'svg') {
    try {
      const parsed = await fabric.loadSVGFromString(sanitizeSvg(layer.markup));
      const objects = (parsed.objects ?? []).filter((object): object is NonNullable<typeof object> => Boolean(object));
      const grouped = fabric.util.groupSVGElements(objects, parsed.options) as FabricObject;
      grouped.set({
        ...common,
        scaleX: px(layer.width) / Math.max(1, grouped.width || 1),
        scaleY: px(layer.height) / Math.max(1, grouped.height || 1),
      });
      grouped.layerId = layer.id;
      return grouped;
    } catch {
      const fallback = new fabric.Rect({
        ...common,
        width: px(layer.width),
        height: px(layer.height),
        fill: '#1a1f1c',
      }) as FabricObject;
      fallback.layerId = layer.id;
      return fallback;
    }
  }
  if (layer.type === 'image') {
    try {
      const image = (await fabric.FabricImage.fromURL(imageUrl(layer.assetId, layer.assetKind), {
        crossOrigin: 'anonymous',
      })) as FabricObject;
      image.set({
        ...common,
        cropX: (image.width ?? 1) * layer.crop.x,
        cropY: (image.height ?? 1) * layer.crop.y,
        width: (image.width ?? 1) * layer.crop.width,
        height: (image.height ?? 1) * layer.crop.height,
        scaleX: px(layer.width) / Math.max(1, (image.width ?? 1) * layer.crop.width),
        scaleY: px(layer.height) / Math.max(1, (image.height ?? 1) * layer.crop.height),
      });
      image.layerId = layer.id;
      return image;
    } catch {
      const fallback = new fabric.Rect({
        ...common,
        width: px(layer.width),
        height: px(layer.height),
        fill: '#1a1f1c',
      }) as FabricObject;
      fallback.layerId = layer.id;
      return fallback;
    }
  }
  return null;
}
