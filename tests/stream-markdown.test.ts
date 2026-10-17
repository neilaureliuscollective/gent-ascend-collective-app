import { expect, it } from 'vitest';
import { stabilizeStreamingMarkdown } from '../src/components/aurelius/stream-markdown';

it('closes an in-flight code fence so later copy is not swallowed', () => {
  const open = 'A paragraph before the sample.\n\n```ts\nconst session = 1;';
  const stabilized = stabilizeStreamingMarkdown(open);
  expect(stabilized.endsWith('```\n')).toBe(true);
  expect(stabilized.match(/```/g)).toHaveLength(2);
});

it('leaves balanced fences unchanged', () => {
  const closed = '```ts\nconst session = 1;\n```\n\n- Stay on A\n';
  expect(stabilizeStreamingMarkdown(closed)).toBe(closed);
});
