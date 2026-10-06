import { describe, expect, it } from 'vitest';
import { routeCapability } from '@/domains/intelligence/capabilities';

describe('Aethelios capability routing', () => {
  it('routes creative deliverables to Studio', () => {
    expect(routeCapability('Turn this into an investor presentation')?.id).toBe('studio');
  });

  it('routes workouts to Performance', () => {
    expect(routeCapability('Build me a full body workout for tomorrow')?.id).toBe('performance');
  });

  it('routes appearance preparation to Presence', () => {
    expect(routeCapability('Help me get ready for a wedding Saturday')?.id).toBe('presence');
  });

  it('keeps product development in company work and does not expose retail', () => {
    expect(routeCapability('Research sourcing for my skincare company')?.id).toBe('company');
    expect(routeCapability('Analyze pricing for my product development')?.id).toBe('company');
    expect(routeCapability('I need to reorder a supplement')).toBeNull();
    expect(routeCapability('Help me think through a hard decision')).toBeNull();
  });

  it('routes priorities and goals to Life', () => {
    expect(routeCapability('Help me figure out my priorities this week')?.id).toBe('life');
  });
});
