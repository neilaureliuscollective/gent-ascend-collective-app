'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { SceneAtmosphere } from './scene-atmosphere';
const products = [
  {
    id: 'vitalis',
    name: 'Vitalis',
    kind: 'Hair & beard oil',
    detail: 'Obsidian Vale · 30 mL',
    ritual: 'A considered finishing touch.',
    link: '/shop/vitalis',
  },
  {
    id: 'obsidian-wash',
    name: 'Obsidian Wash',
    kind: 'Body wash',
    detail: 'Cedar Smoke · 473 mL',
    ritual: 'Make room for the daily reset.',
    link: '/shop',
  },
  {
    id: 'obsidian-creme',
    name: 'Obsidian Crème',
    kind: 'Face moisturizer',
    detail: 'Midnight Orchid · 60 mL',
    ritual: 'Care that continues beyond the mirror.',
    link: '/shop',
  },
  {
    id: 'ascend',
    name: 'Ascend',
    kind: 'Performance pre-workout',
    detail: 'Georgia Peach Rings',
    ritual: 'Preparation has its own ritual.',
    link: '/shop',
  },
  {
    id: 'hydros',
    name: 'Hydros',
    kind: 'Hydration + electrolytes',
    detail: 'Citrus Reserve',
    ritual: 'Carry intention into your training.',
    link: '/shop',
  },
];
export function RitualCollection() {
  const [selected, setSelected] = useState(0);
  const product = products[selected]!;
  return (
    <section className="estate-collection" aria-labelledby="collection-title">
      <SceneAtmosphere image="/media/world/gallery.webp" />
      <div className="estate-collection-heading">
        <p className="estate-eyebrow">LEGACY RESERVE / THE FOUNDING COLLECTION</p>
        <h2 id="collection-title">
          Objects of <em>intention.</em>
        </h2>
        <p>Grooming and performance. A closer look at the collection taking shape.</p>
      </div>
      <div className="estate-product-stage">
        <div className="estate-product-image" data-product={product.id}>
          <Image
            key={product.id}
            src={`/media/world/${product.id}-cutout.webp`}
            alt={`${product.name} — packaging visualization`}
            fill
            sizes="(max-width: 700px) 85vw, 40vw"
          />
        </div>
        <div className="estate-product-copy" aria-live="polite" aria-atomic="true">
          <span className="estate-eyebrow">
            {String(selected + 1).padStart(2, '0')} / 05 · PRODUCT PREVIEW
          </span>
          <h3>{product.name}</h3>
          <p>{product.kind}</p>
          <small>{product.detail}</small>
          <p className="estate-product-ritual">{product.ritual}</p>
          <Link href={product.link}>Explore the collection ↗</Link>
          <small className="estate-availability">Preview only. Not available to order.</small>
        </div>
      </div>
      <div className="estate-product-selector" role="group" aria-label="Explore products">
        {products.map((item, index) => (
          <button
            key={item.id}
            onClick={() => setSelected(index)}
            aria-pressed={selected === index}
          >
            <span>{String(index + 1).padStart(2, '0')}</span>
            {item.name}
          </button>
        ))}
      </div>
    </section>
  );
}
