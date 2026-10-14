'use client';
import { useEffect, useRef } from 'react';
import type { DesignDocument, DesignLayer } from '@/domains/studio/design/document';
import { snapValue } from '@/domains/studio/design/commands';
import { designFont } from '@/domains/studio/design/fonts';
import { toPixels } from '@/domains/studio/design/units';

type FabricModule = typeof import('fabric');

export function DesignCanvas({
  document,
  selectedId,
  onSelect,
  onChangeLayer,
  imageUrl,
}: {
  document: DesignDocument;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChangeLayer: (id: string, patch: Partial<DesignLayer>) => void;
  imageUrl: (id: string, kind: 'version' | 'reference') => string;
}) {
  const host = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<InstanceType<FabricModule['Canvas']> | null>(null);
  const fabricRef = useRef<FabricModule | null>(null);
  const skip = useRef(false);
  const pageRef = useRef(document.page);
  const onSelectRef = useRef(onSelect);
  const onChangeRef = useRef(onChangeLayer);

  useEffect(() => {
    pageRef.current = document.page;
    onSelectRef.current = onSelect;
    onChangeRef.current = onChangeLayer;
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
        const target = canvas.getActiveObject() as
          | { layerId?: string; left?: number; top?: number; width?: number; height?: number; scaleX?: number; scaleY?: number; angle?: number; text?: string }
          | undefined;
        if (!target?.layerId) return;
        const ppi = pageRef.current.ppi;
        const unit = pageRef.current.unit;
        const grid = unit === 'mm' ? 0.5 : unit === 'in' ? 0.01 : 1;
        const fromPx = (px: number) => (unit === 'px' ? px : unit === 'mm' ? (px / ppi) * 25.4 : px / ppi);
        onChangeRef.current(target.layerId, {
          x: snapValue(fromPx(target.left ?? 0), grid),
          y: snapValue(fromPx(target.top ?? 0), grid),
          width: snapValue(fromPx((target.width ?? 1) * (target.scaleX ?? 1)), grid),
          height: snapValue(fromPx((target.height ?? 1) * (target.scaleY ?? 1)), grid),
          rotation: target.angle ?? 0,
          ...(typeof target.text === 'string' ? { content: target.text } : {}),
        } as Partial<DesignLayer>);
      });
    });
    return () => {
      cancelled = true;
      canvasRef.current?.dispose();
      canvasRef.current = null;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const fabric = fabricRef.current;
    if (!canvas || !fabric) return;
    skip.current = true;
    const width = toPixels(document.page.width, document.page.unit, document.page.ppi);
    const height = toPixels(document.page.height, document.page.unit, document.page.ppi);
    const max = Math.min(host.current?.parentElement?.clientWidth || 720, 900);
    const zoom = Math.min(1, max / Math.max(width, 1));
    canvas.setDimensions({ width: Math.round(width * zoom), height: Math.round(height * zoom) });
    canvas.setZoom(zoom);
    canvas.backgroundColor = document.page.background;
    canvas.clear();
    const px = (value: number) => toPixels(value, document.page.unit, document.page.ppi);
    const tasks = document.layers.map(async (layer) => {
      if (!layer.visible) return;
      const common = {
        left: px(layer.x),
        top: px(layer.y),
        angle: layer.rotation,
        opacity: layer.opacity,
        selectable: !layer.locked,
        evented: !layer.locked,
        layerId: layer.id,
      };
      if (layer.type === 'rect') {
        canvas.add(
          new fabric.Rect({
            ...common,
            width: px(layer.width),
            height: px(layer.height),
            fill: layer.fill,
            stroke: layer.stroke ?? undefined,
            strokeWidth: px(layer.strokeWidth),
            rx: px(layer.cornerRadius),
            ry: px(layer.cornerRadius),
          }),
        );
      } else if (layer.type === 'ellipse') {
        canvas.add(
          new fabric.Ellipse({
            ...common,
            rx: px(layer.width) / 2,
            ry: px(layer.height) / 2,
            fill: layer.fill,
            stroke: layer.stroke ?? undefined,
            strokeWidth: px(layer.strokeWidth),
          }),
        );
      } else if (layer.type === 'text') {
        const spec = designFont(layer.fontId);
        canvas.add(
          new fabric.Textbox(layer.content, {
            ...common,
            width: px(layer.width),
            fontSize: layer.fontSize * (document.page.ppi / 72),
            fontFamily: spec.cssFamily,
            fontWeight: String(layer.fontWeight),
            fill: layer.fill,
            textAlign: layer.align,
            lineHeight: layer.lineHeight,
            charSpacing: layer.letterSpacing * 10,
          }),
        );
      } else if (layer.type === 'svg') {
        try {
          const parsed = await fabric.loadSVGFromString(layer.markup);
          const objects = (parsed.objects ?? []).filter((object): object is NonNullable<typeof object> =>
            Boolean(object),
          );
          const grouped = fabric.util.groupSVGElements(objects, parsed.options);
          grouped.set({
            ...common,
            scaleX: px(layer.width) / Math.max(1, grouped.width || 1),
            scaleY: px(layer.height) / Math.max(1, grouped.height || 1),
          });
          canvas.add(grouped);
        } catch {
          canvas.add(
            new fabric.Rect({
              ...common,
              width: px(layer.width),
              height: px(layer.height),
              fill: '#1a1f1c',
            }),
          );
        }
      } else if (layer.type === 'image') {
        try {
          const image = await fabric.FabricImage.fromURL(imageUrl(layer.assetId, layer.assetKind), {
            crossOrigin: 'anonymous',
          });
          image.set({
            ...common,
            scaleX: px(layer.width) / Math.max(1, image.width || 1),
            scaleY: px(layer.height) / Math.max(1, image.height || 1),
          });
          canvas.add(image);
        } catch {
          canvas.add(
            new fabric.Rect({
              ...common,
              width: px(layer.width),
              height: px(layer.height),
              fill: '#1a1f1c',
            }),
          );
        }
      }
    });
    void Promise.all(tasks).then(() => {
      const widthPx = px(document.page.width);
      const heightPx = px(document.page.height);
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
      canvas.add(
        guide(
          px(document.page.bleed.left),
          px(document.page.bleed.top),
          widthPx - px(document.page.bleed.left) - px(document.page.bleed.right),
          heightPx - px(document.page.bleed.top) - px(document.page.bleed.bottom),
          '#C4912F',
        ),
      );
      canvas.add(
        guide(
          px(document.page.safe.left),
          px(document.page.safe.top),
          widthPx - px(document.page.safe.left) - px(document.page.safe.right),
          heightPx - px(document.page.safe.top) - px(document.page.safe.bottom),
          '#7BE0C2',
        ),
      );
      if (selectedId) {
        const match = canvas.getObjects().find((object) => (object as { layerId?: string }).layerId === selectedId);
        if (match) canvas.setActiveObject(match);
      }
      canvas.requestRenderAll();
      skip.current = false;
    });
  }, [document, imageUrl, selectedId]);

  return (
    <div className="studio-design-stage">
      <canvas ref={host} aria-label="Design canvas" />
    </div>
  );
}
