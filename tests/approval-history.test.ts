import { describe, it, expect } from 'vitest';
import { approvalHistory } from '../src/domains/company-work/approval-history';
import { syntheticWork } from './component-fixture/company-work-data';
import type { WorkVersion } from '../src/domains/company-work/schema';
const version = (revision: number, status: 'pending' | 'approved' | 'rejected'): WorkVersion => ({
  ...syntheticWork.versions[0]!,
  id: `version-${revision}`,
  revision,
  content: {
    ...syntheticWork.versions[0]!.content,
    approvalRequests: [
      {
        id: 'proposal-a',
        title: 'Synthetic release',
        proposal: 'Deploy only after verification',
        kind: 'deployment',
        figureIds: [],
        status,
      },
    ],
  },
});
describe('approval history from immutable versions', () => {
  it('distinguishes withdrawal from initial rejection and ignores unchanged copies', () => {
    const versions = [
      version(4, 'rejected'),
      version(3, 'approved'),
      version(2, 'approved'),
      version(1, 'pending'),
    ];
    expect(approvalHistory(versions, 'proposal-a').map((x) => x.event)).toEqual([
      'pending',
      'approved',
      'approval_withdrawn',
    ]);
    expect(versions[0]!.revision).toBe(4);
    expect(approvalHistory(versions, 'unknown')).toEqual([]);
    expect(
      approvalHistory([version(1, 'pending'), version(2, 'rejected')], 'proposal-a')[1]!.event,
    ).toBe('rejected');
  });
  it('labels the first observed state when earlier history was not loaded', () => {
    expect(approvalHistory([version(20, 'approved')], 'proposal-a')[0]!.event).toBe(
      'observed_approved',
    );
  });
});
