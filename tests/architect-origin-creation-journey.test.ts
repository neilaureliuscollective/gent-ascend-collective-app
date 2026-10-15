import { describe, expect, it } from 'vitest';
import {
  applicationPlan,
  creationPathProfiles,
  illustrativeApplicationModel,
  labeledDirectionOptions,
  pathSwitchNote,
  revisionKind,
  teachFor,
} from '@/domains/architect-origin/creation-journey';

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
