import { describe, expect, it } from 'vitest';
import {
  acceptInspectMessage,
  applicationPlan,
  changeScopeForTarget,
  creationBriefForGeneration,
  creationPathProfiles,
  encodeCreationDecision,
  explainInspectTarget,
  illustrativeApplicationModel,
  inspectTargets,
  labeledDirectionOptions,
  mergeCreationDecision,
  pathSwitchNote,
  readCreationBrief,
  readFirstVisit,
  revisionKind,
  teachFor,
} from '@/domains/architect-origin/creation-journey';
import { initialProject } from '@/domains/architect-origin/schema';

describe('Architect creation journey contracts', () => {
  it('keeps four exact paths with differentiated working stages', () => {
    expect(creationPathProfiles.business.title).toBe('Create a Business');
    expect(creationPathProfiles.application.title).toBe('Design an Application');
    expect(creationPathProfiles.product.title).toBe('Develop a Product');
    expect(creationPathProfiles.custom.title).toBe('Start without limits');
    expect(creationPathProfiles.business.facets.map((row) => row.title)).toEqual(['Customer', 'Offer', 'Delivery']);
    expect(creationPathProfiles.application.facets.map((row) => row.title)).toEqual(['Screens', 'Actions', 'Results']);
    expect(creationPathProfiles.product.facets.map((row) => row.title)).toEqual(['Use', 'Form', 'Constraints']);
    expect(creationPathProfiles.custom.limit).toMatch(/cannot invent servers/i);
    expect(creationPathProfiles.business.limit).toMatch(/not incorporate/i);
    expect(creationPathProfiles.product.limit).toMatch(/not manufacture/i);
  });

  it('preserves typed ideas when switching paths and asks for reconsideration', () => {
    const note = pathSwitchNote('business', 'application', 'A planning app for independent studios.');
    expect(note).toMatch(/typed idea is kept/i);
    expect(note).toMatch(/Customer|Offer|Delivery/i);
    expect(note).toMatch(/Design an Application/);
  });

  it('changes the illustrative application model from a first-visit choice', () => {
    const project = illustrativeApplicationModel({ idea: 'Studio planner', firstVisit: 'project' });
    const milestone = illustrativeApplicationModel({ idea: 'Studio planner', firstVisit: 'milestone' });
    expect(project.label).toMatch(/not generated code/i);
    expect(milestone.nodes.find((node) => node.id === 'milestone')?.detail).toMatch(/first visit should finish one milestone/i);
    expect(project.nodes.find((node) => node.id === 'milestone')?.detail).toMatch(/optional/i);
  });

  it('labels examples and does not invent confidence', () => {
    for (const option of labeledDirectionOptions('application')) {
      expect(option.label).toBe('example');
      expect(option.tradeoff).toMatch(/example|not generated/i);
    }
    const plan = applicationPlan({ idea: 'Studio planner', firstVisit: 'milestone', collections: ['projects'] });
    expect(plan.screens.length).toBeGreaterThan(0);
    expect(plan.label).toMatch(/plan from your brief/i);
  });

  it('persists first-visit as a typed decision, not display text', () => {
    const content = initialProject('A planning app for independent studios.', 'application');
    content.blueprint.decisions = mergeCreationDecision('', 'client');
    content.blueprint.next = 'Add a client and send an invitation.';
    expect(readFirstVisit(content.blueprint.decisions)).toBe('client');
    expect(encodeCreationDecision('milestone')).toBe('creation.v1 firstVisit=milestone');
    expect(readCreationBrief(content).firstVisit).toBe('client');
    expect(creationBriefForGeneration(content)).toMatch(/First visit: client/);
    expect(readFirstVisit('Add a client and send an invitation.')).toBeUndefined();
  });

  it('builds a different plan for client review than for milestone or project creation', () => {
    const project = applicationPlan({ idea: 'Studio planner', firstVisit: 'project' });
    const client = applicationPlan({ idea: 'Studio planner', firstVisit: 'client', audience: 'Independent studios' });
    const milestone = applicationPlan({ idea: 'Studio planner', firstVisit: 'milestone' });
    expect(project.actions).toEqual(['Create a project']);
    expect(project.screens).toEqual(['Overview', 'Projects']);
    expect(client.actions).toEqual(['Add a client', 'Send an invitation']);
    expect(client.screens).toContain('Clients');
    expect(client.audience).toBe('Independent studios');
    expect(milestone.screens).toContain('Milestones');
    expect(milestone.relationships).toMatch(/milestone/i);
    expect(client.relationships).not.toEqual(milestone.relationships);
  });

  it('explains inspect targets from host evidence and scopes a change', () => {
    const plan = applicationPlan({ idea: 'Studio planner', firstVisit: 'milestone' });
    const targets = inspectTargets({
      files: [{ path: 'src/App.tsx', content: 'export function App() { return <main>Projects</main>; }' }],
      records: { projects: [{ id: 'p1', title: 'Riverside Brand' }] },
      plan,
      revision: 1,
    });
    const file = targets.find((row) => row.kind === 'file');
    expect(file).toBeTruthy();
    expect(explainInspectTarget(file!)).toMatch(/saved generated file/i);
    expect(explainInspectTarget(file!)).toMatch(/export function App/);
    expect(changeScopeForTarget(file!, 1)).toMatch(/src\/App\.tsx/);
    expect(changeScopeForTarget(file!, 1)).toMatch(/without overwriting the working revision/);
    const compare = inspectTargets({
      files: [{ path: 'src/App.tsx', content: 'next' }],
      records: {},
      plan,
      revision: 2,
    });
    expect(compare[0]?.evidence).toBe('next');
    const bound = { session: 's1', projectId: 'p1', revisionId: 'r1' };
    expect(acceptInspectMessage({ schema: 'architect-apps-inspect/v1', session: 's1', targetId: file!.id }, bound, [file!.id])).toBe(file!.id);
    expect(acceptInspectMessage({ schema: 'architect-apps-inspect/v1', session: 'nope', targetId: file!.id }, bound, [file!.id])).toBeNull();
    expect(acceptInspectMessage({ schema: 'architect-apps-data/v1', session: 's1', targetId: file!.id }, bound, [file!.id])).toBeNull();
    expect(acceptInspectMessage({ schema: 'architect-apps-inspect/v1', session: 's1', projectId: 'other', targetId: file!.id }, bound, [file!.id])).toBeNull();
  });

  it('makes current, previous, proposed and failed revisions distinct', () => {
    expect(revisionKind({ current: true })).toBe('current');
    expect(revisionKind({ working: true })).toBe('previous');
    expect(revisionKind({ proposed: true })).toBe('proposed');
    expect(revisionKind({ failed: true })).toBe('failed');
    const teach = teachFor('application', 'screens');
    expect(teach.what).toMatch(/Screens/);
    expect(teach.next.length).toBeGreaterThan(8);
  });
});
