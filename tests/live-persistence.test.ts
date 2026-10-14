import { expect, it } from 'vitest';
import { voiceItemsAcknowledged } from '@/domains/live/receipt';

it('acknowledges persistence only from provider-item bindings, not turn-count growth', () => {
  expect(
    voiceItemsAcknowledged(
      ['item-a', 'item-a-again'],
      [
        { providerItemId: 'item-a', providerResponseId: 'r1', turnId: 'turn-1' },
        { providerItemId: 'item-a-again', providerResponseId: 'r2', turnId: 'turn-2' },
      ],
    ),
  ).toBe(true);
  expect(
    voiceItemsAcknowledged(
      ['item-a', 'item-a-again'],
      [{ providerItemId: 'item-a', providerResponseId: 'r1', turnId: 'turn-1' }],
    ),
  ).toBe(false);
  expect(voiceItemsAcknowledged([], [{ providerItemId: 'unrelated', providerResponseId: 'r', turnId: 't' }])).toBe(
    true,
  );
});
