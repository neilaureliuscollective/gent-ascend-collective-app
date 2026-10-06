vi.mock('server-only', () => ({}));
import { describe, expect, it, vi } from 'vitest';
import { selectedContext, noContextSources } from '../src/domains/intelligence/context-sources';
import { buildMessages } from '../src/domains/intelligence/prompt';
import { chatInput } from '../src/domains/intelligence/validation';
import type { PersonalContext } from '../src/domains/intelligence/types';
const context: PersonalContext = {
  profile: { name: 'PROFILE_ONLY', priority: 'PRIVATE_PROFILE', timezone: 'UTC', units: 'metric', updatedAt: '' },
  goal: { title: 'GOAL_ONLY', nextStep: 'SECRET_GOAL', reason: '', updatedAt: '' },
  memories: [{ id: 'id', kind: 'fact', content: 'MEMORY_ONLY', confirmed_at: '' }],
  daily: [{ day: '2026-10-06', intention: 'DAILY_ONLY', energy: 3, reflection: '', actions: [] }],
  ascendProfile: [{ key: 'boundary', value: 'BASELINE_ONLY', confirmedAt: '', source: 'user' }],
  grooming: { profile: null, goals: [{ title: 'LIFESTYLE_ONLY', date: null }], rituals: [], products: [], looks: [], concepts: [], scans: [] },
};
describe('saved-source consent boundary', () => {
  for (const category of ['profile','goals','memory','daily','lifestyle'] as const) {
    it(`includes only the selected ${category} source in model messages`, () => {
      const sources = { ...noContextSources, [category]: true };
      const payload = JSON.stringify(buildMessages([], 'Business decision', selectedContext(context, sources)));
      const markers = { profile: ['PROFILE_ONLY', 'BASELINE_ONLY'], goals: ['GOAL_ONLY'], memory: ['MEMORY_ONLY'], daily: ['DAILY_ONLY'], lifestyle: ['LIFESTYLE_ONLY'] };
      for (const [key, words] of Object.entries(markers)) for (const word of words) {
        if (key === category) expect(payload).toContain(word); else expect(payload).not.toContain(word);
      }
    });
  }
  it('rejects unknown source keys and non-boolean consent', () => {
    const request = { conversationId: 'cd000000-0000-4000-8000-000000000001', requestId: 'cd000000-0000-4000-8000-000000000002', text: 'Prepare', includeContext: true };
    expect(chatInput.safeParse({ ...request, contextSources: noContextSources }).success).toBe(true);
    expect(chatInput.safeParse({ ...request, contextSources: { ...noContextSources, privateFounder: true } }).success).toBe(false);
    expect(chatInput.safeParse({ ...request, contextSources: { ...noContextSources, daily: 'yes' } }).success).toBe(false);
  });
});
it('structured preparation rejects absent, false or forged specialist consent', async () => {

  const { orchestrationInput } = await import('../src/domains/intelligence/orchestration');
  const input = { target: 'studio', text: 'Prepare a campaign brief' };
  expect(orchestrationInput.safeParse(input).success).toBe(false);
  expect(orchestrationInput.safeParse({ ...input, useSpecialistContext: false }).success).toBe(false);
  expect(orchestrationInput.safeParse({ ...input, useSpecialistContext: true }).success).toBe(true);
  expect(orchestrationInput.safeParse({ ...input, useSpecialistContext: true, ownerId: 'other-person' }).success).toBe(false);
});
