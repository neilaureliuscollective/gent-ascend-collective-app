/** Shopify metafields describe release state; app requests cannot override it. */
export type LaunchMetadata = {
  launchState?: { value: string } | null;
  launchWindow?: { value: string } | null;
  tags?: readonly string[];
  requiresSellingPlan?: boolean;
};
export type LaunchState = 'ready' | 'preview' | 'preorder' | 'blocked';

export function launchState(product: LaunchMetadata): LaunchState {
  const raw = product.launchState?.value;
  // Tags also protect merchandise before metafield definitions are exposed.
  const tags = new Set((product.tags ?? []).map((tag) => tag.toLowerCase()));
  if (tags.has('gent-ascend:preview')) return 'preview';
  if (tags.has('gent-ascend:preorder')) return 'preorder';
  if (product.requiresSellingPlan) return 'blocked';
  if (raw === undefined || raw === null) return 'ready'; // Preserve ordinary existing merchandise.
  if (raw === 'ready' || raw === 'preview' || raw === 'preorder') return raw;
  return 'blocked'; // Misconfigured states never silently become buy-now.
}

export function launchLabel(product: LaunchMetadata) {
  switch (launchState(product)) {
    case 'ready':
      return 'The collection';
    case 'preview':
      return 'Coming to the collection';
    case 'preorder':
      return 'Preorder opening soon';
    case 'blocked':
      return 'Ordering unavailable';
  }
}

export function launchPurchaseAllowed(product: LaunchMetadata) {
  // Phase four will introduce a separate, verified selling-plan + fulfillment path.
  return launchState(product) === 'ready';
}
