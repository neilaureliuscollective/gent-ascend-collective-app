import type { Money } from '@/domains/commerce/shopify';
export function formatMoney(money: Money) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: money.currencyCode }).format(
    Number(money.amount),
  );
}
