'use client';
import Image from 'next/image';
import { ProductPhotoFrame } from './product-photo-frame';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/domains/commerce/shopify';
import type { createModelStage } from './product-model-stage';
import { ProductMediaPending } from './product-media-pending';
import { commerceEvent } from './commerce-events';
import { shopifyMediaUrl } from '@/domains/commerce/product-story';
import type { ProductFilm as Film } from '@/domains/commerce/product-media';
import { ProductFilm } from './product-film';

export function ProductGallery({
  title,
  images,
  model,
  film,
}: {
  title: string;
  kind: string;
  images: Product['images']['nodes'];
  model?: string;
  film?: Film;
  brand?: string;
}) {
  const safeImages = images.filter((image) => shopifyMediaUrl(image.url));
  const [selected, setSelected] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [requested, setRequested] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'failed'>('idle');
  const [angle, setAngle] = useState(0);
  const [filmOpen, setFilmOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const enlarge = useRef<HTMLButtonElement>(null);
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
  function chooseImage(index: number) {
    setSelected(index);
    setZoomLevel(1);
    setFilmOpen(false);
    closeModel();
    commerceEvent('gallery_view');
  }
  function stepImage(direction: number) {
    chooseImage((selected + direction + safeImages.length) % safeImages.length);
  }
  const imageFailed = Boolean(image && failedImages.includes(image.url));
  return (
    <div className="reserve-gallery" role="region" aria-label={`${title} product inspection`}>
      {safeImages[0] && (
        <noscript>
          <a href={safeImages[0].url} target="_blank" rel="noopener noreferrer">
            Open product photography ↗
          </a>
        </noscript>
      )}
      <div className="reserve-product-stage">
        <div className="reserve-scene-light" aria-hidden="true" />
        <span className="reserve-stage-coordinate">
          THE COLLECTION <span>{requested ? 'OBJECT / 360°' : 'OBJECT / 01'}</span>
        </span>
        <div className="reserve-stage-rings" aria-hidden="true" />
        {filmOpen && film ? (
          <ProductFilm film={film} title={title} />
        ) : image && !imageFailed ? (
          <button
            ref={enlarge}
            className="reserve-image-button"
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setZoom(true);
            }}
            aria-label={`Enlarge ${title} image ${selected + 1}`}
          >
            <ProductPhotoFrame>
              <Image
                key={image.url}
                src={image.url}
                alt={image.altText ?? `${title} view ${selected + 1}`}
                width={image.width ?? 800}
                height={image.height ?? 1000}
                sizes="(max-width: 760px) 90vw, 48vw"
                preload={selected === 0}
                onError={() => setFailedImages((current) => [...new Set([...current, image.url])])}
              />
            </ProductPhotoFrame>
          </button>
        ) : imageFailed ? (
          <p className="atelier-image-error" role="status">
            This photograph could not load. Choose another view or review the product details.
          </p>
        ) : (
          <ProductMediaPending title={title} />
        )}
        {requested && (
          <div ref={host} className="reserve-model-host" data-ready={status === 'ready'} />
        )}
        <span className="reserve-stage-caption">
          {filmOpen
            ? 'Product film · playback is under your control'
            : image
              ? `Image ${selected + 1} of ${safeImages.length} · tap to inspect`
              : 'Product photography is being prepared'}
        </span>
      </div>
      {safeImages.length > 1 && (
        <div className="atelier-gallery-navigation" aria-label="Photograph navigation">
          <button type="button" onClick={() => stepImage(-1)} aria-label="Previous product image">
            ← Previous
          </button>
          <span role="status">
            {selected + 1} / {safeImages.length}
          </span>
          <button type="button" onClick={() => stepImage(1)} aria-label="Next product image">
            Next →
          </button>
        </div>
      )}
      {(safeImages.length > 1 || film) && (
        <div className="reserve-thumbnails" role="group" aria-label="Product images">
          {safeImages.map((item, index) => (
            <button
              key={item.url}
              type="button"
              aria-label={`View image ${index + 1}`}
              aria-pressed={selected === index && !requested && !filmOpen}
              onClick={() => chooseImage(index)}
            >
              <Image src={item.url} alt="" width={68} height={80} sizes="68px" />
              <span>{String(index + 1).padStart(2, '0')}</span>
            </button>
          ))}
          {film && (
            <button
              type="button"
              aria-label="Watch product film"
              aria-pressed={filmOpen}
              onClick={() => {
                closeModel();
                setFilmOpen(true);
              }}
            >
              <span aria-hidden="true">▷</span>
              <span>Film</span>
            </button>
          )}
        </div>
      )}
      {model && (
        <div className="reserve-model-controls">
          {!requested ? (
            <button
              className="world-text-link"
              type="button"
              onClick={() => {
                setFilmOpen(false);
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
          onClose={() => {
            setZoom(false);
            enlarge.current?.focus();
          }}
          onKeyDown={(event) => {
            if (safeImages.length < 2 || event.target instanceof HTMLInputElement) return;
            if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
              event.preventDefault();
              stepImage(event.key === 'ArrowRight' ? 1 : -1);
            }
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) setZoom(false);
          }}
          aria-label={`${title} enlarged image`}
        >
          <div className="atelier-zoom-toolbar">
            <span>
              {title} · {selected + 1} / {safeImages.length}
            </span>
            {safeImages.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous enlarged image"
                  onClick={() => stepImage(-1)}
                >
                  ←
                </button>
                <button type="button" aria-label="Next enlarged image" onClick={() => stepImage(1)}>
                  →
                </button>
              </>
            )}
            <button
              type="button"
              aria-label={zoomLevel === 1 ? 'Zoom in on product image' : 'Fit product image'}
              onClick={() => setZoomLevel(zoomLevel === 1 ? 2 : 1)}
            >
              {zoomLevel === 1 ? 'Zoom 2×' : 'Fit image'}
            </button>
            <button type="button" onClick={() => setZoom(false)} aria-label="Close enlarged image">
              Close ×
            </button>
          </div>
          <p className="atelier-zoom-help">
            Use the controls or arrow keys to change views. At 2×, scroll to inspect the photograph.
            Browser pinch zoom remains available.
          </p>
          {zoom && (
            <div className="atelier-zoom-image" data-zoom={zoomLevel}>
              <Image
                src={image.url}
                alt={image.altText ?? title}
                width={image.width ?? 1200}
                height={image.height ?? 1400}
                sizes={zoomLevel === 2 ? '190vw' : '95vw'}
              />
            </div>
          )}
        </dialog>
      )}
    </div>
  );
}
