import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('server-only', () => ({}));
const mocks = vi.hoisted(() => ({
  configured: vi.fn(),
  get: vi.fn(),
  create: vi.fn(),
  add: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  id: vi.fn(),
  save: vi.fn(),
  clear: vi.fn(),
}));
vi.mock('../src/domains/commerce/shopify', () => ({
  commerceConfigured: mocks.configured,
  getCart: mocks.get,
  createCart: mocks.create,
  addLine: mocks.add,
  updateLine: mocks.update,
  removeLine: mocks.remove,
  cartLaunchPurchasable: () => true,
  LaunchPurchaseError: class extends Error {},
}));
vi.mock('../src/domains/commerce/cart-session', () => ({
  cartId: mocks.id,
  saveCartId: mocks.save,
  clearCartId: mocks.clear,
}));
import { GET, POST } from '../src/app/api/commerce/cart/route';
const cart = {
  id: 'gid://shopify/Cart/test?key=private',
  checkoutUrl: 'https://store.myshopify.com/checkout/private',
  totalQuantity: 1,
  cost: {
    subtotalAmount: { amount: '20.00', currencyCode: 'USD' },
    totalAmount: { amount: '20.00', currencyCode: 'USD' },
  },
  lines: { nodes: [] },
};
function request(body: unknown, origin = 'http://localhost') {
  return new NextRequest('http://localhost/api/commerce/cart', {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.configured.mockReturnValue(true);
  mocks.id.mockResolvedValue(cart.id);
  mocks.get.mockResolvedValue(cart);
  for (const fn of [mocks.create, mocks.add, mocks.update, mocks.remove])
    fn.mockResolvedValue(cart);
});
describe('Shopify cart route', () => {
  it('fails closed without configuration and rejects hostile origins', async () => {
    mocks.configured.mockReturnValue(false);
    expect((await GET(new NextRequest('http://localhost/api/commerce/cart'))).status).toBe(503);
    mocks.configured.mockReturnValue(true);
    expect((await POST(request({ action: 'add' }, 'https://evil.test'))).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('validates quantities and does not accept caller prices or cart identity', async () => {
    expect(
      (
        await POST(
          request({ action: 'add', variantId: 'gid://shopify/ProductVariant/1', quantity: 0 }),
        )
      ).status,
    ).toBe(400);
    const response = await POST(
      request({
        action: 'add',
        variantId: 'gid://shopify/ProductVariant/1',
        quantity: 2,
        price: 0,
        cartId: 'attacker',
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.add).toHaveBeenCalledWith(cart.id, 'gid://shopify/ProductVariant/1', 2, undefined);
    expect(JSON.stringify(await response.json())).not.toContain('private');
  });
  it('handles update, remove and Shopify failures', async () => {
    expect(
      (await POST(request({ action: 'update', lineId: 'gid://shopify/CartLine/1', quantity: 3 })))
        .status,
    ).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith(cart.id, 'gid://shopify/CartLine/1', 3, undefined);
    expect(
      (await POST(request({ action: 'remove', lineId: 'gid://shopify/CartLine/1' }))).status,
    ).toBe(200);
    expect(mocks.remove).toHaveBeenCalled();
    mocks.add.mockRejectedValue(new Error('provider secret'));
    const response = await POST(
      request({ action: 'add', variantId: 'gid://shopify/ProductVariant/1', quantity: 1 }),
    );
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain('provider secret');
  });
  it('replaces an expired cart only after an explicit add', async () => {
    mocks.get.mockResolvedValue(null);
    expect(
      (await POST(request({ action: 'update', lineId: 'gid://shopify/CartLine/1', quantity: 1 })))
        .status,
    ).toBe(409);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(
      (
        await POST(
          request({ action: 'add', variantId: 'gid://shopify/ProductVariant/1', quantity: 1 }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.create).toHaveBeenCalled();
    expect(mocks.save).toHaveBeenCalledWith(cart.id);
  });
});
