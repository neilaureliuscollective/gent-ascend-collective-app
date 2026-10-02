import { describe, it, expect } from 'vitest';
import { captureSchema } from '../src/domains/capture/schema';
describe('capture write contract', () => {
  it('keeps unstructured text bounded and rejects ownership or invented fields', () => {
    const value = { id: '83000000-0000-4000-8000-000000000001', content: '  Rethink the Reserve membership  ', kind: 'thought' };
    expect(captureSchema.parse(value).content).toBe('Rethink the Reserve membership');
    expect(captureSchema.safeParse({ ...value, person_id: 'another-user' }).success).toBe(false);
    expect(captureSchema.safeParse({ ...value, content: 'x'.repeat(2001) }).success).toBe(false);
  });
});
