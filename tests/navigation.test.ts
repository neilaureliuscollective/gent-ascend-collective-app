import { describe, expect, it } from 'vitest';
import {
  destinations,
  destinationIsCurrent,
  visibleDestinations,
} from '../src/components/destinations';
describe('global destination registry', () => {
  it('keeps unique safe routes and four primary destinations including Architect', () => {
    expect(new Set(destinations.map((d) => d.href)).size).toBe(destinations.length);
    for (const d of destinations) expect(d.href).toMatch(/^\/(?!\/)[a-z/]*$/);
    expect(destinations.filter((d) => d.primary).map((d) => d.label)).toEqual([
      'Home',
      'Talk',
      'Work',
      'Architect',
    ]);
    expect(destinations.find((d) => d.label === 'Work')?.href).toBe('/app/work');
    expect(destinations.some((d) => /Agency|Continuum/.test(d.label))).toBe(false);
  });
  it('requires signed-in server founder authority and does not infer it from identity strings', () => {
    expect(visibleDestinations().some((d) => d.audience)).toBe(false);
    expect(visibleDestinations({ signedIn: true }).some((d) => d.audience)).toBe(false);
    expect(visibleDestinations({ founderOffice: true }).some((d) => d.audience)).toBe(false);
    expect(
      visibleDestinations({ signedIn: true, founderOffice: true })
        .filter((d) => d.audience)
        .map((d) => d.href),
    ).toEqual(['/app/founder']);
    expect(
      visibleDestinations({ signedIn: true, developer: true }).some((d) => d.href === '/dev'),
    ).toBe(true);
  });
  it('uses existing public alternatives and retains stable member deep links', () => {
    expect(visibleDestinations().find((d) => d.label === 'Lifestyle')?.href).toBe('/lifestyle');
    expect(visibleDestinations({ signedIn: true }).find((d) => d.label === 'Lifestyle')?.href).toBe(
      '/app/lifestyle',
    );
    expect(destinationIsCurrent('/app', '/app/work')).toBe(false);
    expect(destinationIsCurrent('/app/architect', '/app/architecture')).toBe(false);
    expect(destinationIsCurrent('/app/architect', '/app/architect/project')).toBe(true);
    expect(destinationIsCurrent('/app/aethelios', '/app/companies/example')).toBe(true);
    expect(destinationIsCurrent('/app/lifestyle', '/app/collection/item')).toBe(true);
  });
});
