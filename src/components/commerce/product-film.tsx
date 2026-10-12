'use client';
import { useEffect, useRef, useState } from 'react';
import type { ProductFilm as Film } from '@/domains/commerce/product-media';

/** Mounted only on explicit selection; no autoplay, remote embed or preloading. */
export function ProductFilm({ film, title }: { film: Film; title: string }) {
  const player = useRef<HTMLVideoElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const node = player.current;
    if (!node) return;
    const pauseHidden = () => {
      if (document.hidden) node.pause();
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) node.pause();
    });
    observer.observe(node);
    document.addEventListener('visibilitychange', pauseHidden);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', pauseHidden);
      node.pause();
    };
  }, []);
  return (
    <div className="atelier-film">
      {failed ? (
        <p role="status">
          The product film could not load. Photography and purchasing remain available.
        </p>
      ) : (
        <video
          ref={player}
          src={film.url}
          poster={film.poster}
          controls
          playsInline
          preload="none"
          crossOrigin="anonymous"
          aria-label={`${title} product film`}
          onError={() => setFailed(true)}
        >
          <track
            kind="captions"
            src={film.captions.url}
            srcLang={film.captions.language}
            label={film.captions.label}
            onError={() => setFailed(true)}
            default
          />
        </video>
      )}
      <details className="atelier-transcript">
        <summary>Read film transcript</summary>
        <p>{film.transcript}</p>
      </details>
    </div>
  );
}
