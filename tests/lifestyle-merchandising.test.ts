import { describe, expect, it } from 'vitest';
import { memberLifestyleFixture } from './component-fixture/commerce';
import type { CollectionEntry } from '../src/domains/commerce/collection';
import {
  approvedHousePhotographs,
  lifestyleBrowseEntries,
  lifestyleSceneStatus,
  resolveLifestyleScene,
} from '../src/domains/commerce/lifestyle-merchandising';
import { productBrand } from '../src/domains/commerce/lifestyle';

const vitalis: CollectionEntry = {
  handle: 'vitalis',
  title: 'Published Vitalis',
  kind: 'Hair & beard oil',
  brand: 'Aethelios Lifestyle',
  summary: 'Published catalog product.',
  price: 'From $42.00',
  status: 'Available',
  size: '30 ml',
  categories: ['grooming'],
  orderable: true,
  image: {
    url: 'https://cdn.shopify.com/published/vitalis.png',
    altText: 'Published Vitalis',
    width: 800,
    height: 1000,
  },
};

const unavailableVitalis: CollectionEntry = {
  ...vitalis,
  status: 'Unavailable',
  orderable: false,
};

describe('Lifestyle merchandising', () => {
  it('binds house photography only to exact published handles', () => {
    const scene = resolveLifestyleScene([vitalis, ...memberLifestyleFixture], {
      basePath: '/app/collection',
      status: 'ready',
    });
    expect(scene.items[0]).toMatchObject({
      handle: 'vitalis',
      src: '/media/world/vitalis-cutout.webp',
      href: '/app/collection/vitalis',
      source: 'catalog-house',
      orderable: true,
    });
    expect(scene.featuredOrderable).toBe(true);
  });

  it('does not invent a Vitalis purchase link from house photography', () => {
    const scene = resolveLifestyleScene(memberLifestyleFixture, {
      basePath: '/app/collection',
      status: 'ready',
    });
    expect(scene.items.map((item) => item.handle)).toEqual(['fixture-oil', 'fixture-balm']);
    expect(scene.items.every((item) => item.source === 'catalog')).toBe(true);
    expect(scene.items.some((item) => item.href?.includes('/vitalis'))).toBe(false);
    expect(scene.items[0]?.src).toBe('https://cdn.shopify.com/fixture/front.png');
  });

  it('shows house photography without product destinations when the catalog is unverified', () => {
    for (const status of ['empty', 'unconfigured', 'error'] as const) {
      const scene = resolveLifestyleScene(memberLifestyleFixture, {
        basePath: '/shop',
        status,
      });
      expect(scene.items.map((item) => item.id)).toEqual(['vitalis', 'obsidian-creme', 'hydros']);
      expect(scene.items.every((item) => item.source === 'house-art' && !item.href)).toBe(true);
      expect(scene.featuredOrderable).toBe(false);
    }
  });

  it('keeps an unavailable featured product visible without implying it can be bought', () => {
    const scene = resolveLifestyleScene([unavailableVitalis], {
      basePath: '/shop',
      status: 'ready',
    });
    expect(scene.items[0]).toMatchObject({
      handle: 'vitalis',
      href: '/shop/vitalis',
      orderable: false,
      status: 'Unavailable',
    });
    expect(scene.featuredOrderable).toBe(false);
    expect(lifestyleSceneStatus('ready', scene)).toContain('availability is confirmed on its page');
  });

  it('excludes scene products from the following assortment', () => {
    const scene = resolveLifestyleScene(memberLifestyleFixture, {
      basePath: '/app/collection',
      status: 'ready',
    });
    expect(
      lifestyleBrowseEntries(memberLifestyleFixture, scene).map((entry) => entry.handle),
    ).toEqual(['fixture-wash']);
  });

  it('keeps approved photograph handles explicit and unchanged', () => {
    expect(approvedHousePhotographs.map((photo) => [photo.id, ...photo.candidateHandles])).toEqual([
      ['vitalis', 'vitalis'],
      ['obsidian-creme', 'obsidian-creme'],
      ['obsidian-wash', 'obsidian-wash'],
      ['hydros', 'hydros'],
      ['ascend', 'ascend'],
    ]);
  });
});

describe('customer-facing brand presentation', () => {
  it('presents Shopify default store names as Aethelios Lifestyle without hiding real suppliers', () => {
    expect(productBrand({ vendor: 'My Store', collections: { nodes: [] } })).toBe(
      'Aethelios Lifestyle',
    );
    expect(productBrand({ vendor: 'Actual supplier', collections: { nodes: [] } })).toBe(
      'Actual supplier',
    );
  });
});
