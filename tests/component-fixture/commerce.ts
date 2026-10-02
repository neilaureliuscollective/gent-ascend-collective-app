import type { CollectionEntry } from '@/domains/commerce/collection';
import type { Product } from '@/domains/commerce/shopify';
export const commerceFixture: Product = {
  id: 'gid://shopify/Product/fixture',
  handle: 'fixture-vitalis',
  title: 'Fixture Vitalis',
  description: 'Synthetic product used to verify shopping interactions. Not real merchandise.',
  productType: 'Beard oil',
  featuredImage: {
    url: 'https://cdn.shopify.com/fixture/front.png',
    altText: 'Synthetic front image',
    width: 800,
    height: 1000,
  },
  images: {
    nodes: [
      {
        url: 'https://cdn.shopify.com/fixture/front.png',
        altText: 'Synthetic front image',
        width: 800,
        height: 1000,
      },
      {
        url: 'https://cdn.shopify.com/fixture/back.png',
        altText: 'Synthetic rear label',
        width: 800,
        height: 1000,
      },
    ],
  },
  variants: {
    nodes: [
      {
        id: 'gid://shopify/ProductVariant/fixture-small',
        title: '30 ml',
        availableForSale: true,
        price: { amount: '24.00', currencyCode: 'USD' },
        selectedOptions: [],
      },
      {
        id: 'gid://shopify/ProductVariant/fixture-large',
        title: '60 ml',
        availableForSale: true,
        price: { amount: '38.00', currencyCode: 'USD' },
        selectedOptions: [],
      },
    ],
  },
  collections: { nodes: [{ handle: 'grooming', title: 'Legacy Reserve' }] },
  purpose: { value: 'Synthetic benefit copy for layout verification.' },
  ingredients: { value: 'Synthetic ingredient list.\nNot a real formula.' },
  directions: { value: 'Synthetic directions.' },
  ritual: { value: 'A synthetic morning ritual.' },
  availableForSale: true,
  requiresSellingPlan: false,
  launchState: { value: 'ready' },
  story: {
    value: JSON.stringify({
      version: 1,
      status: 'approved',
      mediaApproved: true,
      size: '30 ml / 60 ml',
      discovery: ['beard'],
      related: [
        {
          handle: 'fixture-balm',
          kind: 'alternative',
          reason: 'Synthetic alternative for browser verification.',
        },
        {
          handle: 'fixture-wash',
          kind: 'complementary',
          reason: 'Synthetic next chapter for browser verification.',
        },
      ],
      fit: 'Synthetic fit information.',
      texture: 'Synthetic texture description.',
      scent: [{ label: 'Profile', value: 'Synthetic scent notes' }],
      highlights: [{ name: 'Synthetic ingredient', role: 'Synthetic role; not a product claim.' }],
      steps: [{ title: 'Prepare', detail: 'Synthetic application instruction.' }],
      shipping: 'Synthetic shipping terms.',
      cancellation: 'Synthetic cancellation terms.',
    }),
  },
};

export const relatedFixture: CollectionEntry[] = [
  {
    handle: 'fixture-balm',
    title: 'Fixture Balm',
    kind: 'Beard balm',
    brand: 'Legacy Reserve',
    summary: 'Synthetic product, not merchandise.',
    price: 'From $28.00',
    status: 'Available',
    categories: ['grooming'],
    discovery: ['beard'],
    orderable: true,
  },
  {
    handle: 'fixture-wash',
    title: 'Fixture Wash',
    kind: 'Body wash',
    brand: 'Legacy Reserve',
    summary: 'Synthetic preview, not merchandise.',
    price: 'Pricing at release',
    status: 'Collection preview',
    categories: ['grooming'],
    discovery: ['body'],
    orderable: false,
    preview: true,
  },
];
