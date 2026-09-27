import 'server-only';

const VERSION = '2026-07';

export function commerceConfigured() {
  return Boolean(process.env.SHOPIFY_STORE_DOMAIN && process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN);
}

export type Money = { amount: string; currencyCode: string };
export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  productType: string;
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
    nodes: {
      id: string;
      title: string;
      availableForSale: boolean;
      price: Money;
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
};
export type ProductSummary = Pick<
  Product,
  | 'id'
  | 'handle'
  | 'title'
  | 'productType'
  | 'featuredImage'
  | 'collections'
  | 'availableForSale'
  | 'requiresSellingPlan'
> & {
  priceRange: { minVariantPrice: Money };
};
export type Cart = {
  id: string;
  checkoutUrl: string;
  totalQuantity: number;
  cost: { subtotalAmount: Money; totalAmount: Money };
  lines: {
    nodes: {
      id: string;
      quantity: number;
      cost: { totalAmount: Money };
      merchandise: {
        id: string;
        title: string;
        product: { handle: string; title: string; featuredImage: Product['featuredImage'] };
      };
    }[];
  };
  warnings?: { code: string; message: string }[];
};

const PRODUCT = `id handle title description productType availableForSale requiresSellingPlan
  featuredImage { url altText width height }
  images(first: 6) { nodes { url altText width height } }
  variants(first: 50) { nodes { id title availableForSale price { amount currencyCode } selectedOptions { name value } } }
  collections(first: 8) { nodes { handle title } }
  purpose: metafield(namespace: "gent_ascend", key: "purpose") { value }
  ingredients: metafield(namespace: "gent_ascend", key: "ingredients") { value }
  directions: metafield(namespace: "gent_ascend", key: "directions") { value }
  ritual: metafield(namespace: "gent_ascend", key: "ritual") { value }`;
const CART = `id checkoutUrl totalQuantity cost { subtotalAmount { amount currencyCode } totalAmount { amount currencyCode } }
  lines(first: 100) { nodes { id quantity cost { totalAmount { amount currencyCode } }
    merchandise { ... on ProductVariant { id title product { handle title featuredImage { url altText width height } } } } } }
  `;

function config() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_STOREFRONT_PRIVATE_TOKEN;
  if (!domain || !token || !/^[a-z0-9][a-z0-9.-]*\.myshopify\.com$/.test(domain))
    throw new Error('Shopify commerce is not configured');
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
    headers: {
      'Content-Type': 'application/json',
      'Shopify-Storefront-Private-Token': token,
      ...(options.buyerIp ? { 'Shopify-Storefront-Buyer-IP': options.buyerIp } : {}),
    },
    body: JSON.stringify({ query, variables }),
    cache: options.cache ?? 'no-store',
    ...(options.revalidate ? { next: { revalidate: options.revalidate } } : {}),
  });
  if (!response.ok) throw new Error(`Shopify request failed (${response.status})`);
  const result = (await response.json()) as { data?: T; errors?: { message: string }[] };
  if (result.errors?.length || !result.data)
    throw new Error('Shopify returned an invalid commerce response');
  return result.data;
}

export async function listProducts() {
  const data = await storefront<{ products: { nodes: ProductSummary[] } }>(
    `query Catalog { products(first: 60, sortKey: CREATED_AT, reverse: true) { nodes {
      id handle title productType availableForSale requiresSellingPlan
      featuredImage { url altText width height }
      collections(first: 8) { nodes { handle title } }
      priceRange { minVariantPrice { amount currencyCode } }
    } } }`,
    {},
    { cache: 'force-cache', revalidate: 300 },
  );
  return data.products.nodes.filter((product) => !product.requiresSellingPlan);
}

export async function getProduct(handle: string) {
  const data = await storefront<{ product: Product | null }>(
    `query Product($handle: String!) { product(handle: $handle) { ${PRODUCT} } }`,
    { handle },
    { cache: 'force-cache', revalidate: 300 },
  );
  return data.product?.requiresSellingPlan ? null : data.product;
}

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
  const data = await storefront<{ cart: Cart | null }>(
    `query Cart($id: ID!) { cart(id: $id) { ${CART} } }`,
    { id },
    { buyerIp },
  );
  return data.cart;
}

export async function createCart(variantId: string, quantity: number, buyerIp?: string) {
  return mutateCart(
    'cartCreate',
    `mutation Create($lines: [CartLineInput!]!) { cartCreate(input: { lines: $lines }) { cart { ${CART} } userErrors { message } warnings { code message } } }`,
    { lines: [{ merchandiseId: variantId, quantity }] },
    buyerIp,
  );
}

export async function addLine(id: string, variantId: string, quantity: number, buyerIp?: string) {
  return mutateCart(
    'cartLinesAdd',
    `mutation Add($id: ID!, $lines: [CartLineInput!]!) { cartLinesAdd(cartId: $id, lines: $lines) { cart { ${CART} } userErrors { message } warnings { code message } } }`,
    { id, lines: [{ merchandiseId: variantId, quantity }] },
    buyerIp,
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
