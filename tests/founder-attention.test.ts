import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FounderAttention } from '../src/components/founder-office/attention';
import { founderOfficeFixture } from './component-fixture/founder-office-data';
import type { FounderOfficeData } from '../src/domains/founder-office/service';

function render(missions: FounderOfficeData['missions']) {
  return renderToStaticMarkup(createElement(FounderAttention, {
    data: { ...founderOfficeFixture, missions },
  }));
}
const mission: FounderOfficeData['missions'][number] = {
  id: 'saved-mission', companyId: 'saved-company', companyName: 'Saved business',
  title: 'Saved objective', revision: 1, createdAt: '2026-10-12T00:00:00Z',
  updatedAt: '2026-10-12T00:00:00Z', latestVersion: 'saved-version', reviewedAt: null,
  summary: 'Saved draft', actions: [], gaps: ['Missing signed input'], tasks: [],
  approvals: [
    { id: 'approved', kind: 'publishing', title: 'Approved release', proposal: 'Saved proposal', figureIds: [], status: 'approved' },
    { id: 'pending', kind: 'publishing', title: 'Pending decision', proposal: 'Saved proposal', figureIds: [], status: 'pending' },
  ],
  readiness: [{ id: 'blocked', title: 'Dependent task', assignee: 'cassius', state: 'blocked', blockers: ['prerequisite'] }],
  status: 'approved_awaiting_executor', assignment: 'cassius',
};

describe('Saved Founder Office attention index', () => {
  it('keeps missing records honest and offers no execution controls', () => {
    const html = render([]);
    expect(html).toContain('No pending company approval requests in this snapshot.');
    expect(html).toContain('No prepared missions or ready assigned tasks recorded.');
    expect(html).not.toMatch(/<button|<form/);
  });
  it('keeps approved external work in dependencies and pending decisions separate', () => {
    const html = render([mission]);
    const groups = html.split('class="founder-attention-group"').slice(1);
    expect(groups[0]).toContain('Pending decision');
    expect(groups[0]).not.toContain('Approved release');
    expect(groups[1]).toContain('No prepared missions');
    expect(groups[2]).toContain('Saved objective');
    expect(html).toContain('/app/companies/saved-company/work/saved-mission');
    expect(html).not.toMatch(/<button|<form/);
  });
  it('shows a ready assigned task without claiming it has run', () => {
    const html = render([{ ...mission, approvals: [], gaps: [], status: 'active',
      readiness: [{ id: 'ready', title: 'Ready draft', assignee: 'cassius', state: 'ready', blockers: [] }],
    }]);
    const groups = html.split('class="founder-attention-group"').slice(1);
    expect(groups[1]).toContain('Saved objective');
    expect(groups[2]).toContain('No recorded evidence gaps');
    expect(html).toContain('Review each mission before advancing it');
  });
});
