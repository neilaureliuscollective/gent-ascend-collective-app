import { describe, expect, it } from 'vitest';
import {
  createOriginDraftHandoff,
  type OriginDraft,
} from '@/components/architect-origin/draft-handoff';
import { initialProject } from '@/domains/architect-origin/schema';
const content = initialProject('Synthetic recovery project', 'application');
const snapshot = (): OriginDraft => ({
  base: {
    id: 'project-a',
    person_id: 'owner-a',
    revision: 2,
    content,
    created_at: '',
    updated_at: '',
  },
  content: { ...content, name: 'Private unsaved name' },
  pending: null,
  uncertainRun: false,
});
describe('Origin transient draft ownership and recovery', () => {
  it('restores once only after a matching fresh owner/project read, preserving the original revision', () => {
    const handoff = createOriginDraftHandoff();
    const draft = snapshot();
    handoff.stage(draft);
    draft.content.name = 'Later mutation';
    const current = { ...draft.base, revision: 3 };
    expect(handoff.take(current)).toMatchObject({
      base: { revision: 2 },
      content: { name: 'Private unsaved name' },
    });
    expect(handoff.take(current)).toBeNull();
  });
  it.each(['absent', 'owner', 'project'])('drops a %s mismatch permanently', (mismatch) => {
    const handoff = createOriginDraftHandoff();
    const draft = snapshot();
    handoff.stage(draft);
    const current =
      mismatch === 'absent'
        ? undefined
        : { ...draft.base, [mismatch === 'owner' ? 'person_id' : 'id']: 'other' };
    expect(handoff.take(current)).toBeNull();
    expect(handoff.take(draft.base)).toBeNull();
  });
  it('does not retain a draft without an authoritative owner or after explicit discard', () => {
    const handoff = createOriginDraftHandoff();
    const draft = snapshot();
    handoff.stage({ ...draft, base: { ...draft.base, person_id: '' } });
    expect(handoff.take(draft.base)).toBeNull();
    handoff.stage(draft);
    handoff.stage(null);
    expect(handoff.take(draft.base)).toBeNull();
  });
  it('isolates mounted workspaces and retains the exact uncertain save', () => {
    const handoff = createOriginDraftHandoff();
    const draft = snapshot();
    draft.pending = {
      action: 'save',
      projectId: draft.base.id,
      expected: 2,
      requestId: 'same-request',
      content: draft.content,
      note: 'Synthetic uncertain save',
    };
    handoff.stage(draft);
    expect(createOriginDraftHandoff().take(draft.base)).toBeNull();
    expect(handoff.take(draft.base)?.pending).toEqual(draft.pending);
  });
});
