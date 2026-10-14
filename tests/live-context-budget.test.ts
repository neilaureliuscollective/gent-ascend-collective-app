import { expect, it } from 'vitest';
import { budgetLiveSeed } from '@/domains/live/context-budget';

it('pins application and artifact context separately from the last twelve history messages', () => {
  const application = [
    { role: 'user', content: 'Application context and thread summary' },
    { role: 'user', content: 'Selected design-board artifact' },
  ];
  const history = Array.from({ length: 20 }, (_, index) => ({
    role: index % 2 ? 'assistant' : 'user',
    content: `History ${index + 1}`,
  }));
  const seed = budgetLiveSeed(application, history, 12);
  expect(seed[0]?.content).toBe('Application context and thread summary');
  expect(seed[1]?.content).toBe('Selected design-board artifact');
  expect(seed).toHaveLength(14);
  expect(seed.at(-1)?.content).toBe('History 20');
  expect(seed.some((item) => item.content === 'History 1')).toBe(false);
  expect(seed.some((item) => item.content === 'History 9')).toBe(true);
});
