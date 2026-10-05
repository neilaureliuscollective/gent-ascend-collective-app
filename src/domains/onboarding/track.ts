'use client';
import { eventNames } from './events';
let journey = '';
let began = 0;
const sent = new Set<string>();
export function track(name: (typeof eventNames)[number], method?: 'google' | 'email' | 'existing') {
  try {
    if (!journey) {
      const stored = sessionStorage.getItem('gent-claim-journey');
      const parsed = stored ? JSON.parse(stored) : null;
      journey = parsed?.id ?? crypto.randomUUID();
      began = parsed?.began ?? Date.now();
      sessionStorage.setItem('gent-claim-journey', JSON.stringify({ id: journey, began }));
    }
    const key = name + (method ?? '');
    if (sent.has(key)) return;
    sent.add(key);
    void fetch('/api/account/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        id: crypto.randomUUID(),
        journey,
        elapsed: Math.min(86400000, Math.max(0, Date.now() - began)),
        device: innerWidth < 600 ? 'phone' : 'wide',
        ...(method ? { method } : {}),
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* Measurement never blocks the product. */
  }
}
