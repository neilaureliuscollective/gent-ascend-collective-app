import { describe, it, expect } from 'vitest';
import { ecosystemOrigin } from '@/platform/ecosystem-links';
describe('corporate integration boundaries', () => {
  it('accepts only an explicit HTTPS origin without credentials, paths or token parameters', () => {
    expect(ecosystemOrigin('https://example.com/')).toBe('https://example.com');
    for (const value of [
      undefined,
      '',
      'javascript:alert(1)',
      'http://example.com',
      'https://example.com/path',
      'https://example.com?token=x',
      'https://user:password@example.com',
      'https://example.com:8443',
      'https://localhost',
      'https://127.0.0.1',
    ])
      expect(ecosystemOrigin(value)).toBeNull();
  });
});
