import type { CustomerOrdersView } from '@/domains/commerce/customer-account';
import { LifestyleAction } from './lifestyle-action';
const status = (raw: string | null) =>
  raw ? raw.toLowerCase().replaceAll('_', ' ') : 'Not reported';
export function CustomerOrders({
  view,
  failed = false,
}: {
  view: CustomerOrdersView;
  failed?: boolean;
}) {
  const connected = view.state === 'connected',
    available = ['disconnected', 'connected', 'unavailable'].includes(view.state);
  return (
    <section className="member-collection customer-orders" aria-label="Your Shopify orders">
      <header className="cabinet-hero">
        <p className="eyebrow">Aethelios Lifestyle / Orders</p>
        <h1>
          Your orders.
          <br />
          <em>A clear record.</em>
        </h1>
        <p>
          Read the orders belonging to the Shopify account you explicitly connect. Cabinet notes and
          saved interests stay separate. This is not a public storefront introduction.
        </p>
        <nav aria-label="Order destinations">
          <LifestyleAction href="/app/collection">The collection</LifestyleAction>
          <LifestyleAction href="/app/collection/cabinet">Cabinet</LifestyleAction>
          <LifestyleAction href="/app/lifestyle">Lifestyle</LifestyleAction>
        </nav>
      </header>
      {view.state === 'signed-out' ? (
        <>
          <p>Sign in to your Gent Ascend account before connecting Shopify.</p>
          <LifestyleAction href="/enter">Sign in</LifestyleAction>
        </>
      ) : view.state === 'unconfigured' ? (
        <p>
          Shopify account connection is not open yet. You can still browse the Collection and keep
          products in your Cabinet.
        </p>
      ) : (
        <>
          {failed && (
            <p role="alert">
              The account connection could not be completed. Start again from this page.
            </p>
          )}
          {view.state === 'unavailable' && (
            <p role="alert">
              Shopify orders are temporarily unavailable. Your Cabinet is unchanged. Retry or
              reconnect your account.
            </p>
          )}
          {connected && (
            <p className="customer-account-name">
              Connected Shopify account: <strong>{view.displayName}</strong>
            </p>
          )}
          <p>
            This connection stays on this browser for at most one hour. Connect again after it
            expires or on another device. It does not change your membership or activate a discount.
          </p>
          {available && (
            <div className="customer-order-actions">
              <form method="post" action="/api/commerce/customer">
                <button className="secondary-button">
                  {connected ? 'Reconnect Shopify account' : 'Connect Shopify account'}
                </button>
              </form>
              {(connected || view.state === 'unavailable') && (
                <form method="post" action="/api/commerce/customer/disconnect">
                  <button className="secondary-button">Disconnect from this browser</button>
                </form>
              )}
              {view.state === 'unavailable' && (
                <LifestyleAction href="/app/collection/orders">Retry order history</LifestyleAction>
              )}
            </div>
          )}
          {connected && (
            <section aria-label="Recent orders from Shopify">
              <h2>Recent orders</h2>
              <p>
                Up to ten recent orders, read from Shopify now. Payment and fulfillment are shown
                separately; an order alone does not prove delivery.
              </p>
              {!view.orders?.length ? (
                <p>No orders returned for this connected Shopify account.</p>
              ) : (
                <ol className="customer-order-list">
                  {view.orders.map((order) => (
                    <li key={order.id}>
                      <h3>{order.name}</h3>
                      <p>
                        <time dateTime={order.processedAt}>
                          {new Intl.DateTimeFormat('en-US', {
                            dateStyle: 'medium',
                            timeZone: 'UTC',
                          }).format(new Date(order.processedAt))}
                        </time>{' '}
                        · UTC
                      </p>
                      <p>
                        {order.totalPrice.currencyCode} {order.totalPrice.amount}
                      </p>
                      <p>
                        Payment: {status(order.financialStatus)} · Fulfillment:{' '}
                        {status(order.fulfillmentStatus)}
                      </p>
                      {order.cancelledAt && <p>Cancelled</p>}
                    </li>
                  ))}
                </ol>
              )}
              {view.more && (
                <p>More orders exist in Shopify. This view contains only the ten most recent.</p>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
