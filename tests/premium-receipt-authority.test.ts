import { it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('@/domains/intelligence/service', () => ({
  IntelligenceError: class extends Error {
    constructor(
      message: string,
      public status = 400,
    ) {
      super(message);
    }
  },
}));
import {
  requirePremiumReceiptAuthority,
  PREMIUM_RECEIPT_AUTHORITY,
} from '@/domains/talk-creation/premium-receipt';
import { produceArchitectDirection } from '@/domains/talk-creation/architect-direction';
import { lifestyleLaunchBoard, legacyReserveBoard } from '@/domains/talk-creation/design-board';
import { designDirectionDigest } from '@/domains/architect-design-direction/contract';
const input = {
  conversationId: '00000000-0000-4000-8000-000000000001',
  boardId: '00000000-0000-4000-8000-000000000002',
  version: 3,
};
const receipt = produceArchitectDirection({ ...input, board: lifestyleLaunchBoard() });
it('requires the fresh exact owner-session SQL derivation, not just a capability marker', async () => {
  const rpc = vi
    .fn()
    .mockResolvedValue({ data: { capability: PREMIUM_RECEIPT_AUTHORITY, receipt }, error: null });
  await requirePremiumReceiptAuthority({ rpc }, receipt);
  expect(rpc).toHaveBeenCalledExactlyOnceWith('ai_talk_review_premium_direction', {
    p_conversation: input.conversationId,
    p_board: input.boardId,
    p_version: 3,
  });
  const forged = structuredClone(receipt);
  forged.content.designSnapshot!.direction.copy.proof = 'Forged';
  forged.digest = designDirectionDigest(forged.content, forged.sourceRecords);
  rpc.mockResolvedValue({
    data: { capability: PREMIUM_RECEIPT_AUTHORITY, receipt: forged },
    error: null,
  });
  await expect(requirePremiumReceiptAuthority({ rpc }, receipt)).rejects.toThrow(/changed/);
});
for (const code of ['PGRST202', '42883', 'PGRST204'])
  it(`keeps an unmigrated database gated (${code})`, async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code, message: 'missing' } });
    await expect(requirePremiumReceiptAuthority({ rpc }, receipt)).rejects.toMatchObject({
      status: 409,
      message: expect.stringMatching(/not available on this database/),
    });
  });
for (const data of [
  null,
  {},
  { capability: PREMIUM_RECEIPT_AUTHORITY },
  { capability: 'unknown', receipt },
])
  it(`rejects unsupported or incomplete capability replies (${JSON.stringify(data).slice(0, 50)})`, async () => {
    const rpc = vi.fn().mockResolvedValue({ data, error: null });
    await expect(requirePremiumReceiptAuthority({ rpc }, receipt)).rejects.toThrow(/not available/);
  });
it('blocks source revocation and transient failed reads without treating the design as absent', async () => {
  for (const [code, status] of [
    ['42501', 409],
    ['XX000', 503],
  ] as const) {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { code, message: 'unavailable' } });
    await expect(requirePremiumReceiptAuthority({ rpc }, receipt)).rejects.toMatchObject({
      status,
    });
  }
});
it('does not add a new database dependency to genuine v1 transfers', async () => {
  const rpc = vi.fn();
  await requirePremiumReceiptAuthority(
    { rpc },
    produceArchitectDirection({ ...input, board: legacyReserveBoard() }),
  );
  expect(rpc).not.toHaveBeenCalled();
});
