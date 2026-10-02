'use client';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/domains/commerce/shopify';
import type { createModelStage } from './product-model-stage';
import { ConceptVessel } from './concept-vessel';
import { commerceEvent } from './commerce-events';
import { shopifyMediaUrl } from '@/domains/commerce/product-story';

export function ProductGallery({
  title,
  kind,
  images,
  model,
  brand,
}: {
  title: string;
  kind: string;
  images: Product['images']['nodes'];
  model?: string;
  brand?: string;
}) {
  const safeImages = images.filter((image) => shopifyMediaUrl(image.url));
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [angle, setAngle] = useState(0);
  const host = useRef<HTMLDivElement>(null);
  const stage = useRef<Awaited<ReturnType<typeof createModelStage>> | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const image = safeImages[selected];
  useEffect(() => {
    if (!requested || !model || !host.current) return;
    let disposed = false;
    const node = host.current;
    import('./product-model-stage')
      .then(async ({ createModelStage }) => {
        if (disposed) return;
        const result = await createModelStage(node, model, () => {
          if (!disposed) setStatus('failed');
        });
        if (disposed) {
          result.dispose();
          return;
        }
        stage.current = result;
        setStatus('ready');
      })
      .catch(() => {
        if (!disposed) setStatus('failed');
      });
    return () => {
      disposed = true;
      stage.current?.dispose();
      stage.current = null;
    };
  }, [model, requested]);
  useEffect(() => {
    if (status === 'failed') {
      stage.current?.dispose();
      stage.current = null;
    }
  }, [status]);
  useEffect(() => {
    stage.current?.rotate(angle);
  }, [angle, status]);
  useEffect(() => {
    if (zoom) dialog.current?.showModal();
    else dialog.current?.close();
  }, [zoom]);
  function closeModel() {
    setRequested(false);
    setStatus('idle');
    setAngle(0);
  }
  return (
    <div className="reserve-gallery">
      <div className="reserve-product-stage">
        <span className="reserve-stage-coordinate">
          THE COLLECTION <span>{requested ? 'OBJECT / 360°' : 'OBJECT / 01'}</span>
        </span>
        <div className="reserve-stage-rings" aria-hidden="true" />
        {image ? (
          <button
            className="reserve-image-button"
            type="button"
            onClick={() => setZoom(true)}
            aria-label={`Enlarge ${title} image ${selected + 1}`}
          >
            <Image
              src={image.url}
              alt={image.altText ?? `${title} view ${selected + 1}`}
              width={image.width ?? 800}
              height={image.height ?? 1000}
              sizes="(max-width: 760px) 90vw, 48vw"
              preload={selected === 0}
            />
          </button>
        ) : (
          <ConceptVessel title={title} kind={kind} brand={brand} />
        )}
        {requested && (
          <div ref={host} className="reserve-model-host" data-ready={status === 'ready'} />
        )}
        <span className="reserve-stage-caption">
          {image
            ? 'Inspect the details · tap to enlarge'
            : 'Concept packaging · final product may differ'}
        </span>
      </div>
      {safeImages.length > 1 && (
        <div className="reserve-thumbnails" role="group" aria-label="Product images">
          {safeImages.map((item, index) => (
            <button
              key={item.url}
              type="button"
              aria-label={`View image ${index + 1}`}
              aria-pressed={selected === index && !requested}
              onClick={() => {
                setSelected(index);
                closeModel();
                commerceEvent('gallery_view');
              }}
            >
              <Image src={item.url} alt="" width={68} height={80} sizes="68px" />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </button>
          ))}
        </div>
      )}
      {model && (
        <div className="reserve-model-controls">
          {!requested ? (
            <button
              className="world-text-link"
              type="button"
              onClick={() => {
                setRequested(true);
                setStatus('loading');
                commerceEvent('model_open');
              }}
            >
              Inspect in 3D ↗
            </button>
          ) : (
            <>
              <p role="status">
                {status === 'loading'
                  ? 'Opening the product…'
                  : status === 'failed'
                    ? '3D is unavailable. Product images remain available.'
                    : 'Use the rotation control to inspect the product.'}
              </p>
              {status === 'ready' && (
                <label>
                  Rotate product
                  <input
                    aria-label="Rotate product"
                    type="range"
                    min="0"
                    max="360"
                    value={angle}
                    onChange={(event) => setAngle(Number(event.target.value))}
                  />
                </label>
              )}
              <button type="button" onClick={closeModel}>
                Return to images
              </button>
            </>
          )}
        </div>
      )}
      {image && (
        <dialog
          ref={dialog}
          className="reserve-zoom"
          onCancel={() => setZoom(false)}
          onClose={() => setZoom(false)}
          onClick={(event) => {
            if (event.target === event.currentTarget) setZoom(false);
          }}
          aria-label={`${title} enlarged image`}
        >
          <button type="button" onClick={() => setZoom(false)} aria-label="Close enlarged image">
            Close ×
          </button>
          <Image
            src={image.url}
            alt={image.altText ?? title}
            width={image.width ?? 1200}
            height={image.height ?? 1400}
            sizes="95vw"
          />
        </dialog>
      )}
    </div>
  );
}
