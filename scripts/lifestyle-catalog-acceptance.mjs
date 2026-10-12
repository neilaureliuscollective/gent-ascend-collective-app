// Read-only merchant acceptance. Run with securely supplied server environment.
// Never prints tokens, cart keys, provider errors or private customer data.
const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
const collection = process.env.SHOPIFY_LEGACY_RESERVE_COLLECTION || 'legacy-reserve';
if (
  !domain ||
  !token ||
  !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/.test(domain) ||
  !/^[a-z0-9][a-z0-9-]{0,99}$/.test(collection)
) {
  console.error(
    'Missing or invalid server-only Shopify domain, Storefront token or collection handle.',
  );
  process.exit(1);
}
const query = `query Acceptance($handle: String!, $cursor: String) {
 collection(handle: $handle) { title products(first: 60, after: $cursor) {
  pageInfo { hasNextPage endCursor }
  nodes { id handle title description availableForSale requiresSellingPlan
   featuredImage { url }
   ingredients: metafield(namespace: "gent_ascend", key: "ingredients") { value }
   directions: metafield(namespace: "gent_ascend", key: "directions") { value }
   variants(first: 1) { nodes { id availableForSale price { amount currencyCode } } }
  }
 } }
}`;
try {
  const products = [];
  const cursors = new Set();
  let cursor = null;
  let complete = false;
  for (let page = 0; page < 10; page++) {
    const response = await fetch(`https://${domain}/api/2026-10/graphql.json`, {
      method: 'POST',
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
      headers: { 'Content-Type': 'application/json', 'Shopify-Storefront-Private-Token': token },
      body: JSON.stringify({ query, variables: { handle: collection, cursor } }),
    });
    if (!response.ok) throw new Error('request');
    const result = await response.json();
    if (result.errors?.length || !result.data?.collection) throw new Error('collection');
    const connection = result.data.collection.products;
    products.push(...connection.nodes);
    if (!connection.pageInfo.hasNextPage) {
      complete = true;
      break;
    }
    const next = connection.pageInfo.endCursor;
    if (!next || cursors.has(next)) throw new Error('pagination');
    cursors.add(next);
    cursor = next;
  }
  if (!complete) throw new Error('bound');
  const targets = ['Virelis', 'Hydros', 'Hydros Plus', 'Fortium', 'Restoria', 'Nocturne'];
  const report = {
    apiVersion: '2026-10',
    collection,
    publishedProducts: products.length,
    targets: targets.map((name) => ({
      name,
      matches: products
        .filter((p) => p.title.toLowerCase().includes(name.toLowerCase()))
        .map((p) => p.handle),
    })),
    products: products.map((p) => ({
      handle: p.handle,
      title: p.title,
      available: p.availableForSale,
      subscriptionOnly: p.requiresSellingPlan,
      incomplete: [
        ...(!p.description.trim() ? ['description'] : []),
        ...(!p.featuredImage ? ['photography'] : []),
        ...(!p.ingredients?.value ? ['ingredients'] : []),
        ...(!p.directions?.value ? ['directions'] : []),
      ],
      sampleVariant: p.variants.nodes[0] ?? null,
    })),
    limitations:
      'Read-only published assortment check. Missing targets may be unpublished or in another collection. Does not verify every variant, fulfillment, customer login, checkout or purchases.',
  };
  console.log(JSON.stringify(report, null, 2));
  if (!products.length) process.exitCode = 1;
} catch {
  console.error(
    'Published assortment acceptance failed. Verify secure credentials, network access, Headless publication, collection and Storefront metafield access. No provider payload is logged.',
  );
  process.exitCode = 1;
}
