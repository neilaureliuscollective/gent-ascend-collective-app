import { describe, expect, it } from 'vitest';
import {
  checkDisplayName,
  checkIdentity,
  classifyCheckDelta,
  type CheckOutcome,
} from '@/domains/architect-construct/check-coverage';

const prefix =
  'src/modules/application-runtime-services/fixtures/example-layer/service-runtime-';

function collidingPaths() {
  const alpha = `${prefix}alpha.mjs`;
  const beta = `${prefix}beta.mjs`;
  expect(checkDisplayName('syntax', alpha)).toBe(checkDisplayName('syntax', beta));
  expect(alpha.length).toBeLessThanOrEqual(120);
  return { alpha, beta, label: checkDisplayName('syntax', alpha) };
}

function recorded(
  path: string,
  status: CheckOutcome['status'],
  extras: Partial<CheckOutcome> = {},
): CheckOutcome {
  const command = `node --check ${path}`;
  return {
    id: checkIdentity({ kind: 'syntax', command, target: path }),
    name: checkDisplayName('syntax', path),
    command,
    target: path,
    exit_code: status === 'passed' ? 0 : 1,
    status,
    log: status === 'passed' ? 'ok' : 'failed',
    ...extras,
  };
}

describe('construct check identity', () => {
  it('classifies the second colliding-path failure as introduced', () => {
    const { alpha, beta, label } = collidingPaths();
    const baseline = [recorded(alpha, 'failed'), recorded(beta, 'passed')];
    const post = [recorded(beta, 'failed'), recorded(alpha, 'failed')];
    const delta = classifyCheckDelta(baseline, post);
    expect(baseline.map((item) => item.name)).toEqual([label, label]);
    expect(delta.preexisting_failures.join(' ')).toMatch(/alpha\.mjs/);
    expect(delta.introduced_failures.join(' ')).toMatch(/beta\.mjs/);
    expect(delta.preexisting_failures.join(' ')).not.toMatch(/beta\.mjs/);
    expect(delta.comparison_note).toBeUndefined();
  });

  it('does not use display names when identities collide', () => {
    const { alpha, beta, label } = collidingPaths();
    const baseline = [
      { name: label, command: `node --check ${alpha}`, status: 'failed' as const, exit_code: 1, log: '' },
      { name: label, command: `node --check ${beta}`, status: 'passed' as const, exit_code: 0, log: '' },
    ];
    const post = [
      { name: label, command: `node --check ${alpha}`, status: 'failed' as const, exit_code: 1, log: '' },
      { name: label, command: `node --check ${beta}`, status: 'failed' as const, exit_code: 1, log: '' },
    ];
    const delta = classifyCheckDelta(baseline, post);
    expect(delta.preexisting_failures.join(' ')).toMatch(alpha);
    expect(delta.introduced_failures.join(' ')).toMatch(beta);
  });

  it('labels legacy colliding names as comparison unavailable instead of pre-existing', () => {
    const label = 'syntax:src/modules/application-runtime-services/fixtures/example-l…';
    const baseline = [
      { name: label, command: 'node --check', status: 'failed' as const, exit_code: 1, log: 'a' },
      { name: label, command: 'node --check', status: 'passed' as const, exit_code: 0, log: 'b' },
    ];
    const post = [
      { name: label, command: 'node --check', status: 'failed' as const, exit_code: 1, log: 'a' },
      { name: label, command: 'node --check', status: 'failed' as const, exit_code: 1, log: 'c' },
    ];
    const delta = classifyCheckDelta(baseline, post);
    expect(delta.preexisting_failures).toEqual([]);
    expect(delta.introduced_failures).toEqual([]);
    expect(delta.comparison_note).toMatch(/unavailable|display name|identity/i);
  });

  it('treats a missing baseline entry as introduced and ignores a missing post entry', () => {
    const { alpha, beta } = collidingPaths();
    const delta = classifyCheckDelta([recorded(alpha, 'failed')], [recorded(alpha, 'failed'), recorded(beta, 'failed')]);
    expect(delta.preexisting_failures.join(' ')).toMatch(/alpha\.mjs/);
    expect(delta.introduced_failures.join(' ')).toMatch(/beta\.mjs/);
  });

  it('does not treat a changed check definition as the same check', () => {
    const path = 'check.mjs';
    const baseline = [
      recorded(path, 'failed', {
        id: checkIdentity({ kind: 'syntax', command: 'node --check check.mjs', target: path }),
      }),
    ];
    const post = [
      recorded(path, 'failed', {
        id: checkIdentity({ kind: 'syntax', command: 'true', target: path }),
        command: 'true',
      }),
    ];
    const delta = classifyCheckDelta(baseline, post);
    expect(delta.introduced_failures.join(' ')).toMatch(/check\.mjs|true/);
    expect(delta.preexisting_failures).toEqual([]);
  });

  it('matches a new identity to a unique legacy command receipt', () => {
    const { alpha, beta } = collidingPaths();
    const baseline = [
      { name: 'syntax:alpha.mjs', command: `node --check ${alpha}`, status: 'failed' as const, exit_code: 1, log: '' },
      { name: 'syntax:beta.mjs', command: `node --check ${beta}`, status: 'passed' as const, exit_code: 0, log: '' },
    ];
    const post = [recorded(alpha, 'failed'), recorded(beta, 'failed')];
    const delta = classifyCheckDelta(baseline, post);
    expect(delta.preexisting_failures.join(' ')).toMatch(/alpha\.mjs/);
    expect(delta.introduced_failures.join(' ')).toMatch(/beta\.mjs/);
  });

  it('refuses comparison when post-change identities collide', () => {
    const { alpha, label } = collidingPaths();
    const shared = recorded(alpha, 'failed');
    const delta = classifyCheckDelta(
      [shared],
      [
        { ...shared, log: 'first' },
        { ...shared, log: 'second' },
      ],
    );
    expect(delta.preexisting_failures).toEqual([]);
    expect(delta.introduced_failures).toEqual([]);
    expect(delta.comparison_note).toMatch(/unavailable|duplicate identity/i);
    expect(label.length).toBeLessThanOrEqual(80);
  });
});
