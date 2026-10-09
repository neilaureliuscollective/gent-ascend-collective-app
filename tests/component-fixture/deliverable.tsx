import { DeliverableWorkspace } from '@/components/missions/deliverable-workspace';
import type { Deliverable, DeliverableVersion } from '@/domains/missions/deliverable-schema';
export const fixtureDocument: Deliverable = {
  id: 'e7400000-0000-4000-8000-000000000001',
  person_id: 'e7400000-0000-4000-8000-000000000002',
  mission_id: 'e7400000-0000-4000-8000-000000000003',
  source_mission_id: 'e7400000-0000-4000-8000-000000000003',
  source_turn_id: 'e7400000-0000-4000-8000-000000000004',
  source_revision: 1,
  revision: 1,
  created_at: '2026-10-07T00:00:00Z',
};
export const fixtureVersion: DeliverableVersion = {
  id: 'e7400000-0000-4000-8000-000000000005',
  person_id: fixtureDocument.person_id,
  deliverable_id: fixtureDocument.id,
  revision: 1,
  title: 'Homepage brief',
  body: 'Original saved reply',
  acceptance: '',
  source: 'reply',
  reviewed_at: null,
  review_note: null,
  created_at: fixtureDocument.created_at,
};
export function DeliverableFixture() {
  return (
    <>
      <p>Synthetic deliverable · no real account</p>
      <DeliverableWorkspace
        initial={{ deliverable: fixtureDocument, versions: [fixtureVersion] }}
      />
    </>
  );
}
