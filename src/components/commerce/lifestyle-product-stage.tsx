'use client';
import Link from 'next/link';
import Image from 'next/image';
import {
  lifestyleSceneStatus,
  type CatalogStatus,
  type LifestyleScene,
  type LifestyleSceneItem,
} from '@/domains/commerce/lifestyle-merchandising';
import { LifestyleAction } from './lifestyle-action';
import { ProductMediaPending } from './product-media-pending';

function ScenePiece({ item, compact }: { item: LifestyleSceneItem; compact?: boolean }) {
  const media = item.src ? (
    <Image
      src={item.src}
      alt={item.alt}
      width={item.width ?? (item.role === 'focal' ? 720 : 360)}
      height={item.height ?? (item.role === 'focal' ? 900 : 450)}
      sizes={
        item.role === 'focal'
          ? compact
            ? '(max-width: 700px) 70vw, 28vw'
            : '(max-width: 700px) 80vw, 42vw'
          : '(max-width: 700px) 40vw, 16vw'
      }
      preload={item.role === 'focal' && !compact}
    />
  ) : (
    <ProductMediaPending title={item.name} />
  );
  const caption = (
    <span>
      <strong>{item.name}</strong>
      <small>
        {item.kind}
        {item.price ? ` · ${item.price}` : ''}
        {item.status && item.source !== 'house-art' ? ` · ${item.status}` : ''}
      </small>
    </span>
  );
  const className = item.role === 'focal' ? 'member-lifestyle-focal' : 'member-lifestyle-companion';
  if (item.href) {
    return (
      <Link href={item.href} className={className}>
        {media}
        {caption}
      </Link>
    );
  }
  return (
    <div className={className}>
      {media}
      {caption}
    </div>
  );
}

export function LifestyleProductStage({
  scene,
  compact = false,
  status,
  exploreHref,
}: {
  scene: LifestyleScene;
  compact?: boolean;
  status?: CatalogStatus;
  exploreHref: string;
}) {
  const focal = scene.items.find((item) => item.role === 'focal');
  const companions = scene.items.filter((item) => item.role === 'secondary');
  const catalogState = status ?? 'ready';
  return (
    <section
      className={`member-lifestyle-stage${compact ? ' member-lifestyle-stage--compact' : ''}`}
      aria-label="Aethelios Lifestyle products"
    >
      {focal ? <ScenePiece item={focal} compact={compact} /> : null}
      <div className="member-lifestyle-stage-aside">
        {companions.length > 0 && (
          <div className="member-lifestyle-companions">
            {companions.map((item) => (
              <ScenePiece key={item.id} item={item} compact={compact} />
            ))}
          </div>
        )}
        {!compact && (
          <>
            <p
              className="member-lifestyle-stage-status"
              role={catalogState !== 'ready' ? 'status' : undefined}
            >
              {lifestyleSceneStatus(catalogState, scene)}
            </p>
            <LifestyleAction className="world-button" href={exploreHref}>
              Explore the collection
            </LifestyleAction>
          </>
        )}
      </div>
    </section>
  );
}
