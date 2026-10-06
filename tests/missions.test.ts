import { describe, it, expect } from 'vitest';
import {
  createMissionInput,
  updateMissionInput,
  missionResumeDraft,
  type Mission,
} from '../src/domains/missions/schema';
const fields = {
  title: 'Website launch',
  objective: 'Launch my landscaping website',
  status: 'draft',
  decisions: '',
  open_questions: '',
  next_actions: '',
};
const id = 'dd000000-0000-4000-8000-000000000001';
describe('public Mission boundary', () => {
  it('requires explicit bounded direction and rejects caller ownership, private tools and invalid statuses', () => {
    const valid = { ...fields, id, conversation_id: id };
    expect(createMissionInput.safeParse(valid).success).toBe(true);
    for (const extra of [
      { person_id: id },
      { tools: ['github.structure'] },
      { status: 'running' },
      { objective: 'x' },
      { title: 'x'.repeat(121) },
    ])
      expect(createMissionInput.safeParse({ ...valid, ...extra }).success).toBe(false);
    expect(updateMissionInput.safeParse({ ...fields, id, expected_revision: 1 }).success).toBe(
      true,
    );
    expect(updateMissionInput.safeParse({ ...fields, id, expected_revision: 0 }).success).toBe(
      false,
    );
  });
  it('prepares only the selected direction as untrusted records with no execution permissions', () => {
    const mission = {
      ...fields,
      status: 'active',
      id,
      person_id: id,
      conversation_id: id,
      revision: 1,
      created_at: '',
      updated_at: '',
    } as Mission;
    expect(missionResumeDraft(mission)).toContain('not execution permissions');
    expect(missionResumeDraft(mission)).not.toContain('person_id');
    const long = {
      ...mission,
      objective: '\\'.repeat(2000),
      decisions: '\\'.repeat(4000),
      open_questions: '\\'.repeat(2000),
      next_actions: '\\'.repeat(2000),
    };
    expect(missionResumeDraft(long).length).toBeLessThanOrEqual(6000);
    expect(missionResumeDraft(long)).toContain('Bounded excerpts');
  });
});
