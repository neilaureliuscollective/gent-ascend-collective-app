import 'server-only';
import { cache } from 'react';
import { launchPurchaseAllowed, type LaunchMetadata } from './launch-policy';
import { collectCatalog, type CatalogPage } from './catalog-pagination';
import { catalogProductAllowed, lifestyleAssortmentHandle } from './lifestyle';

const VERSION = '2026-10';
export class ShopifyCommerceError extends Error {
  constructor(
    public readonly kind:
      'configuration' | 'network' | 'authentication' | 'permission' | 'schema' | 'provider',
    public readonly status?: number,
  ) {
    super('Shopify commerce is temporarily unavailable');
    this.name = 'ShopifyCommerceError';
  }
}
export class CollectionUnavailableError extends ShopifyCommerceError {
  constructor() {
    super('configuration');
    this.name = 'CollectionUnavailableError';
  }
}
function storeDomain() {
  return process.env.SHOPIFY_STORE_DOMAIN?.trim().toLowerCase();
}

export function commerceConfigured() {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN);
}

export type Money = { amount: string; currencyCode: string };
export type Product = LaunchMetadata & {
  id: string;
  handle: string;
  title: string;
  description: string;
  productType: string;
  vendor?: string;
  featuredImage: {
    url: string;
    altText: string | null;
    width: number | null;
    height: number | null;
  } | null;
  images: {
    nodes: { url: string; altText: string | null; width: number | null; height: number | null }[];
  };
  variants: {
    pageInfo?: { hasNextPage: boolean; endCursor: string | null };
    nodes: {
      id: string;
      title: string;
      availableForSale: boolean;
      price: Money;
      compareAtPrice?: Money | null;
      currentlyNotInStock?: boolean;
      selectedOptions: { name: string; value: string }[];
    }[];
  };
  collections: { nodes: { handle: string; title: string }[] };
  purpose: { value: string } | null;
  ingredients: { value: string } | null;
  directions: { value: string } | null;
  ritual: { value: string } | null;
  availableForSale: boolean;
  requiresSellingPlan: boolean;
  story?: { value: string } | null;
  media?: {
    nodes: {
      mediaContentType: string;
      sources?: { url: string; format: string; filesize: number }[];
      videoSources?: {
        url: string;
        format: string;
        mimeType: string;
        width: number;
        height: number;
      }[];
      previewImage?: { url: string; altText: string | null } | null;
    }[];
  };
};
export type ProductSummary = Pick<
  Product,
  | 'id'
  | 'handle'
  | 'title'
  | 'productType'
  | 'vendor'
  | 'featuredImage'
  | 'collections'
  | 'availableForSale'
  | 'requiresSellingPlan'
  | 'launchState'
  | 'launchWindow'
  | 'tags'
  | 'story'
> & {
  description?: string;
  priceRange: { minVariantPrice: Money };
};
export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: Money; totalAmount: Money };
  lines: {
    pageInfo?: { hasNextPage: boolean; endCursor?: string | null };
    nodes: {
      id: string;
      quantity: number;
      cost: { totalAmount: Money };
      merchandise: {
        availableForSale?: boolean;
        id: string;
        title: string;
        product: LaunchMetadata & {
          handle: string;
          title: string;
          collections: Product['collections'];
          featuredImage: Product['featuredImage'];
        };
      };
    }[];
  };
  warnings?: { code: string; message: string }[];
};

const LAUNCH = `tags requiresSellingPlan
  launchState: metafield(namespace: "gent_ascend", key: "launch_state") { value }
  launchWindow: metafield(namespace: "gent_ascend", key: "launch_window") { value }`;
const PRODUCT = `id handle title description productType vendor availableForSale ${LAUNCH}
  featuredImage { url altText width height }
  images(first: 12) { nodes { url altText width height } }
  variants(first: 50) { pageInfo { hasNextPage endCursor } nodes { id title availableForSale currentlyNotInStock price { amount currencyCode } compareAtPrice { amount currencyCode } selectedOptions { name value } } }
  collections(first: 100) { nodes { handle title } }
  purpose: metafield(namespace: "gent_ascend", key: "purpose") { value }
  ingredients: metafield(namespace: "gent_ascend", key: "ingredients") { value }
  directions: metafield(namespace: "gent_ascend", key: "directions") { value }
  ritual: metafield(namespace: "gent_ascend", key: "ritual") { value }
  story: metafield(namespace: "gent_ascend", key: "product_story") { value }
  media(first: 12) { nodes { mediaContentType previewImage { url altText }
    ... on Model3d { sources { url format filesize } }
    ... on Video { videoSources: sources { url format mimeType width height } }
  } }`;
const CART = `id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
  lines(first: 100) { pageInfo { hasNextPage endCursor } nodes { id quantity cost { totalAmount { amount currencyCode } }
    merchandise { ... on ProductVariant { id title availableForSale product { handle title ${LAUNCH} collections(first: 100) { nodes { handle title } } featuredImage { url altText width height } } } } } }
  `;

function config() {
  const domain = storeDomain();
  const token = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN?.trim();
  if (!domain || !token || !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/.test(domain))
    throw new ShopifyCommerceError('configuration');
  return { domain, token };
}

export async function storefront<T>(
  query: string,
  variables: Record<string, unknown> = {},
  options: { buyerIp?: string; cache?: RequestCache; revalidate?: number } = {},
): Promise<T> {
  const { domain, token } = config();
  const response = await fetch(`https://${domain}/api/${VERSION}/graphql.json`, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      'Shopify-Storefront-Private-Token': token,
      ...(options.buyerIp ? { 'Shopify-Storefront-Buyer-IP': options.buyerIp } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: options.cache ?? 'no-store',
    ...(options.revalidate ? { next: { revalidate: options.revalidate } } : {}),
  });
  if (!response.ok)
    throw new ShopifyCommerceError(
      response.status === 401
        ? 'authentication'
        : response.status === 403
          ? 'permission'
          : 'provider',
      response.status,
    );
  const result = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (result.errors?.length || !result.data) {
    const messages = (result.errors ?? []).map((error) => error.message).join(' ');
    throw new ShopifyCommerceError(
      /access denied|unauthorized/i.test(messages)
        ? 'permission'
        : /doesn't exist|undefinedField|unknown argument/i.test(messages)
          ? 'schema'
          : 'provider',
    );
  }
  return result.data;
}

export const listProducts = cache(async () => {
  const products = await collectCatalog<ProductSummary>(async (cursor) => {
    const data = await storefront<{ products: CatalogPage<ProductSummary> }>(
      `query Catalog($cursor: String) { products(first: 60, after: $cursor, sortKey: CREATED_AT, reverse: true) {
      pageInfo { hasNextPage endCursor }
      nodes {
      id handle title description productType vendor availableForSale ${LAUNCH}
      story: metafield(namespace: "gent_ascend", key: "product_story") { value }
      featuredImage { url altText width height }
      collections(first: 8) { nodes { handle title } }
      priceRange { minVariantPrice { amount currencyCode } }
    } } }`,
      { cursor },
      { cache: 'force-cache', revalidate: 300 },
    );
    return data.products;
  });
  return products.filter((product) => !product.requiresSellingPlan);
});

export const listCollectionProducts = cache(async (handle: string) => {
  return collectCatalog<ProductSummary>(async (cursor) => {
    const data = await storefront<{ collection: { products: CatalogPage<ProductSummary> } | null }>(
      `query LifestyleCollection($handle: String!, $cursor: String) {
        collection(handle: $handle) { products(first: 60, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { id handle title description productType vendor availableForSale ${LAUNCH}
            story: metafield(namespace: "gent_ascend", key: "product_story") { value }
            featuredImage { url altText width height }
            collections(first: 100) { nodes { handle title } }
            priceRange { minVariantPrice { amount currencyCode } }
          }
        } }
      }`,
      { handle, cursor },
      { cache: 'force-cache', revalidate: 300 },
    );
    if (!data.collection) throw new CollectionUnavailableError();
    return data.collection.products;
  }).then((products) => products.filter((product) => !product.requiresSellingPlan));
});

export const getProduct = cache(async (handle: string) => {
  const data = await storefront<{ product: Product | null }>(
    `query Product($handle: String!) { product(handle: $handle) { ${PRODUCT} } }`,
    { handle },
    { cache: 'no-store' },
  );
  if (data.product?.variants.pageInfo?.hasNextPage) {
    const first = data.product.variants;
    const variants = await collectCatalog<Product['variants']['nodes'][number]>(async (cursor) => {
      if (!cursor) return { nodes: first.nodes, pageInfo: first.pageInfo! };
      const next = await storefront<{
        product: { variants: CatalogPage<Product['variants']['nodes'][number]> } | null;
      }>(
        `query ProductVariants($handle: String!, $cursor: String!) { product(handle: $handle) { variants(first: 50, after: $cursor) {
          pageInfo { hasNextPage endCursor }
          nodes { id title availableForSale currentlyNotInStock price { amount currencyCode } compareAtPrice { amount currencyCode } selectedOptions { name value } }
        } } }`,
        { handle, cursor },
        { cache: 'no-store' },
      );
      if (!next.product) throw new Error('Product became unavailable');
      return next.product.variants;
    });
    data.product.variants.nodes = variants;
  }
  return data.product?.requiresSellingPlan ? null : data.product;
});

export const getPurchasePolicies = cache(async () => {
  const data = await storefront<{
    shop: {
      shippingPolicy: { title: string; url: string } | null;
      refundPolicy: { title: string; url: string } | null;
    };
  }>(
    'query PurchasePolicies { shop { shippingPolicy { title url } refundPolicy { title url } } }',
    {},
    { cache: 'force-cache', revalidate: 300 },
  );
  return Object.entries(data.shop).flatMap(([kind, policy]) => {
    if (!policy) return [];
    try {
      const url = new URL(policy.url);
      if (url.protocol !== 'https:' || url.username || url.password || url.port) return [];
      return [{ kind, title: policy.title, url: url.toString() }];
    } catch {
      return [];
    }
  });
});

async function mutateCart(
  field: string,
  query: string,
  variables: Record<string, unknown>,
  buyerIp?: string,
) {
  const data = await storefront<
    Record<
      string,
      {
        cart: Cart | null;
        userErrors: { message: string }[];
        warnings?: { code: string; message: string }[];
      }
    >
  >(query, variables, { buyerIp });
  const result = data[field];
  if (!result || result.userErrors.length || !result.cart) {
    throw new Error(result?.userErrors[0]?.message ?? 'Cart could not be updated');
  }
  return { ...result.cart, warnings: result.warnings ?? [] };
}

export async function getCart(id: string, buyerIp?: string) {
  const lines = new Map<string, Cart['lines']['nodes'][number]>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  // Shopify carts are bounded; never hand off a partially reviewed cart.
  for (let page = 0; page < 3; page++) {
    const data: { cart: Cart | null } = await storefront(
      `query Cart($id: ID!, $cursor: String) { cart(id: $id) { ${CART.replace('lines(first: 100)', 'lines(first: 100, after: $cursor)')} } }`,
      { id, cursor },
      { buyerIp },
    );
    if (!data.cart) return null;
    for (const line of data.cart.lines.nodes) lines.set(line.id, line);
    if (!data.cart.lines.pageInfo?.hasNextPage)
      return { ...data.cart, lines: { nodes: [...lines.values()] } };
    const next = data.cart.lines.pageInfo.endCursor;
    if (!next || cursors.has(next)) throw new ShopifyCommerceError('provider');
    cursors.add(next);
    cursor = next;
  }
  throw new ShopifyCommerceError('provider');
}

export async function createCart(variantId: string, quantity: number, buyerIp?: string) {
  await assertVariantPurchasable(variantId, buyerIp);
  return mutateCart(
    'cartCreate',
    `mutation Create($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { ${CART} } userErrors { message } warnings { code message } } }`,
    { lines: [{ merchandiseId: variantId, quantity }] },
    buyerIp,
  );
}

export async function addLine(id: string, variantId: string, quantity: number, buyerIp?: string) {
  await assertVariantPurchasable(variantId, buyerIp);
  return mutateCart(
    'cartLinesAdd',
    `mutation Add($id: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $id, lines: $lines) { cart { ${CART} } userErrors { message } warnings { code message } } }`,
    { id, lines: [{ merchandiseId: variantId, quantity }] },
    buyerIp,
  );
}

export class LaunchPurchaseError extends Error {
  constructor() {
    super('This item is not open for ordering yet.');
    this.name = 'LaunchPurchaseError';
  }
}

async function assertVariantPurchasable(id: string, buyerIp?: string) {
  const data = await storefront<{
    node: {
      availableForSale: boolean;
      product: LaunchMetadata & Pick<Product, 'collections'>;
    } | null;
  }>(
    `query PurchaseReadiness($id: ID!) { node(id: $id) { ... on ProductVariant {
      availableForSale product { ${LAUNCH} collections(first: 100) { nodes { handle title } } }
    } } }`,
    { id },
    { buyerIp },
  );
  if (
    !data.node?.availableForSale ||
    !data.node.product ||
    !launchPurchaseAllowed(data.node.product) ||
    !catalogProductAllowed(
      data.node.product,
      lifestyleAssortmentHandle(process.env.SHOPIFY_LIFESTYLE_COLLECTION),
    )
  )
    throw new LaunchPurchaseError();
}

export function cartLaunchPurchasable(cart: Cart) {
  return cart.lines.nodes.every(
    (line) =>
      Boolean(line.merchandise?.product) &&
      line.merchandise.availableForSale !== false &&
      launchPurchaseAllowed(line.merchandise.product) &&
      catalogProductAllowed(
        line.merchandise.product,
        lifestyleAssortmentHandle(process.env.SHOPIFY_LIFESTYLE_COLLECTION),
      ),
  );
}

export async function updateLine(id: string, lineId: string, quantity: number, buyerIp?: string) {
  return mutateCart(
    'cartLinesUpdate',
    `mutation Update($id: ID!, $lines: [CartLineUpdateInput!]!) { cartLinesUpdate(cartId: $id, lines: $lines) { cart { ${CART} } userErrors { message } warnings { code message } } }`,
    { id, lines: [{ id: lineId, quantity }] },
    buyerIp,
  );
}

export async function removeLine(id: string, lineId: string, buyerIp?: string) {
  return mutateCart(
    'cartLinesRemove',
    `mutation Remove($id: ID!, $lineIds: [ID!]!) { cartLinesRemove(cartId: $id, lineIds: $lineIds) { cart { ${CART} } userErrors { message } warnings { code message } } }`,
    { id, lineIds: [lineId] },
    buyerIp,
  );
}
