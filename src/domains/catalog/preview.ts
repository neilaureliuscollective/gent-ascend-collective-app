/** Curated editorial previews, not Shopify merchandise or purchasable inventory. */
export const collectionPreviews = [
  {
    handle: 'vitalis',
    name: 'Vitalis',
    kind: 'Hair & beard oil',
    line: 'Legacy Reserve',
    number: '01',
    form: 'oil',
    state: 'In development',
    summary: 'A considered ritual for hair, beard, and the way you carry yourself.',
    story:
      'The house oil is being developed around the everyday act of looking after your hair and beard. Texture, finish, scent, and the experience in your hand all deserve the same attention.',
    ritual: 'A moment of care before you step into the day.',
  },
  {
    handle: 'hair-care',
    name: 'The daily cleanse',
    kind: 'Hair care collection',
    line: 'Legacy Reserve',
    number: '02',
    form: 'wash',
    state: 'Collection preview',
    summary: 'The foundation of a well-kept routine. Thoughtful care, used consistently.',
    story:
      'Shampoo and conditioning belong to the foundation of grooming. This collection is taking shape alongside the wider Legacy Reserve ritual, with final formulas and presentation still under review.',
    ritual: 'Begin with the essentials. Give them your attention.',
  },
  {
    handle: 'body-care',
    name: 'Care, carried further',
    kind: 'Body care collection',
    line: 'Legacy Reserve',
    number: '03',
    form: 'balm',
    state: 'Collection preview',
    summary: 'Personal care that belongs to the whole day, from the first ritual to the last.',
    story:
      'The body care collection extends the same considered approach beyond hair and beard. The range, packaging, and availability will be introduced as each product is ready.',
    ritual: 'Small rituals. A standard you can feel.',
  },
] as const;

export function previewProduct(handle: string) {
  return collectionPreviews.find((product) => product.handle === handle);
}
