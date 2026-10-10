import { describe, it, expect } from 'vitest';
import {
  deliverableAction,
  deliverableExport,
  type DeliverableVersion,
} from '../src/domains/missions/deliverable-schema';
const id = 'e7300000-0000-4000-8000-000000000001';
describe('deliverable boundaries', () => {
  it('requires exact revisions, bounded content and explicit review; rejects caller ownership', () => {
    const valid = {
      action: 'save',
      id,
      versionId: id,
      expected: 1,
      title: 'Brief',
      body: 'Saved work',
      acceptance: '',
    };
    expect(deliverableAction.safeParse(valid).success).toBe(true);
    for (const patch of [
      { person_id: id },
      { expected: 0 },
      { body: 'x'.repeat(50001) },
      { reviewed_at: 'now' },
      { body: ' ' },
      { expected: 100 },
    ])
      expect(deliverableAction.safeParse({ ...valid, ...patch }).success).toBe(false);
    expect(
      deliverableAction.safeParse({ action: 'review', id, versionId: id, note: ' ' }).success,
    ).toBe(false);
  });
  it('exports saved text with accurate version and user-review status, never execution claims', () => {
    const v = {
      title: 'Launch brief',
      revision: 2,
      body: 'Draft work',
      acceptance: 'Audience verified',
      reviewed_at: null,
      review_note: null,
    } as DeliverableVersion;
    expect(deliverableExport(v)).toContain('Draft — not reviewed');
    expect(
      deliverableExport({ ...v, reviewed_at: '2026-10-07', review_note: 'Dates checked' }),
    ).toContain('Reviewed by you');
    expect(deliverableExport(v)).toContain('not independent verification');
  });
});
