import { describe, expect, it } from 'vitest';
import {
  RESULT_RECEIPT_MAX_BYTES,
  boundRunResult,
  persistenceRejectedResult,
  serializedReceiptBytes,
  truncateUtf8,
} from '@/domains/architect-construct/receipt-budget';
import { MemoryConstructStore, ConstructStoreError } from '@/domains/architect-construct/store';
import { sha256Text } from '@/domains/architect-construct/hash';
import type { RunResult } from '@/domains/architect-construct/schema';

const hash = 'a'.repeat(64);

function bulkyResult(log: string, count = 8): RunResult {
  const checks = Array.from({ length: count }, (_, index) => ({
    name: `syntax:app-${index}.js`.slice(0, 80),
    command: `node --check app-${index}.js`,
    exit_code: index === 0 ? 1 : 0,
    status: (index === 0 ? 'failed' : 'passed') as 'failed' | 'passed',
    log,
  }));
  return {
    isolation: 'process-fixture',
    runtime_available: false,
    sandbox: false,
    blocker: null,
    source_hash: hash,
    result_hash: hash,
    changed_files: ['app.js'],
    diff: '-before\n+after\n',
    checks,
    baseline_checks: checks.map((check, index) =>
      index === 0 ? check : { ...check, status: 'passed' as const, exit_code: 0 },
    ),
    coverage: {
      no_applicable: false,
      preexisting_failures: [],
      introduced_failures: ['syntax:app.js'],
      untested: ['Runtime application behavior'],
      unsupported: [{ kind: 'functional', reason: 'No functional test runner is available in this snapshot.' }],
      revision_note: 'imported receipt',
    },
    preview: { path: 'preview.html', body: '<html><body>After</body></html>', unavailable_reason: null },
    artifacts: [{ kind: 'receipt', ref: 'receipt', hash: sha256Text('receipt') }],
  };
}

describe('construct receipt budget', () => {
  it('truncates verbose baseline and post logs so the serialized receipt fits', () => {
    const result = bulkyResult(`${'ERROR line '.repeat(4000)}\n`);
    expect(serializedReceiptBytes(result)).toBeGreaterThan(RESULT_RECEIPT_MAX_BYTES);
    const bounded = boundRunResult(result);
    expect(serializedReceiptBytes(bounded)).toBeLessThanOrEqual(RESULT_RECEIPT_MAX_BYTES);
    expect(bounded.checks[0]?.status).toBe('failed');
    expect(bounded.baseline_checks?.[1]?.status).toBe('passed');
    expect(bounded.checks[0]?.log).toMatch(/truncated this log to fit the durable receipt/i);
    expect(bounded.checks.filter((check) => check.status === 'failed').map((check) => check.name)).toEqual([
      'syntax:app-0.js',
    ]);
  });

  it('truncates multibyte logs on UTF-8 boundaries', () => {
    const log = `${'界'.repeat(20000)}`;
    const bounded = boundRunResult(bulkyResult(log));
    expect(serializedReceiptBytes(bounded)).toBeLessThanOrEqual(RESULT_RECEIPT_MAX_BYTES);
    expect(() => new TextDecoder('utf-8', { fatal: true }).decode(new TextEncoder().encode(bounded.checks[0]!.log))).not.toThrow();
    expect(truncateUtf8('éééé', 3).length).toBeGreaterThan(0);
  });

  it('persists a bounded receipt and rejects an oversized raw payload', async () => {
    const store = new MemoryConstructStore();
    const owner = '00000000-0000-4000-8000-000000000001';
    const project = '00000000-0000-4000-8000-000000000002';
    const runId = '00000000-0000-4000-8000-000000000039';
    const source = {
      id: runId,
      person_id: owner,
      kind: 'imported' as const,
      repository: null,
      commit: null,
      label: 'Imported source snapshot — exact attached files, not live repository knowledge.',
      tree_hash: hash,
      files: [{ path: 'preview.html', content: '<h1>Before</h1>' }],
      created_at: new Date().toISOString(),
    };
    await store.importSource(source);
    const brief = await store.approveBrief(owner, runId, {
      project_id: project,
      project_revision: 1,
      source_id: source.id,
      repository: null,
      source_commit: null,
      source_tree_hash: hash,
      allowed_paths: ['preview.html'],
      protected_paths: ['.env'],
      intended_change: 'Replace the heading.',
      acceptance_checks: [{ name: 'syntax:preview', command: 'true', args: [] }],
      resource_limits: {
        timeout_ms: 30000,
        lease_ms: 45000,
        max_files: 32,
        max_file_bytes: 65536,
        max_output_bytes: 16384,
        max_diff_bytes: 32768,
      },
      patch: [{ path: 'preview.html', before: '<h1>Before</h1>', after: '<h1>After</h1>' }],
    });
    await store.startRun({
      personId: owner,
      projectId: project,
      briefId: brief.id,
      requestId: runId,
      expected: 1,
      sourceKind: 'imported',
      sourceTreeHash: hash,
      approvalHash: brief.approval_hash,
      sourceId: source.id,
    });
    const claimed = await store.claimRun('worker-receipt', new Date());
    const token = claimed?.lease_token;
    if (!claimed || !token) throw new Error('Claim did not issue a lease.');
    const raw = bulkyResult(`${'overflow '.repeat(8000)}\n`);
    await expect(
      store.finishRun('worker-receipt', claimed.id, token, 'failed', raw, new Date()),
    ).rejects.toBeInstanceOf(ConstructStoreError);
    const bounded = boundRunResult(raw);
    const finished = await store.finishRun(
      'worker-receipt',
      claimed.id,
      token,
      'failed',
      bounded,
      new Date(),
    );
    expect(serializedReceiptBytes(finished.result)).toBeLessThanOrEqual(RESULT_RECEIPT_MAX_BYTES);
    const reopened = await store.readRun(owner, claimed.id);
    expect(reopened?.result?.checks[0]?.status).toBe('failed');
    expect(reopened?.result?.checks[0]?.log).toMatch(/truncated this log|failed|overflow/i);
    expect(reopened?.status).toBe('failed');
  });

  it('does not convert persistence rejection into a successful run', () => {
    const rejected = persistenceRejectedResult(bulkyResult('x'.repeat(100)), 'Store rejected the receipt.');
    expect(rejected.blocker).toMatch(/not reported successful|rejected/i);
    expect(rejected.sandbox).toBe(false);
    expect(serializedReceiptBytes(rejected)).toBeLessThanOrEqual(RESULT_RECEIPT_MAX_BYTES);
  });

  it('accepts a receipt at the durable size boundary and rejects one byte over', async () => {
    const store = new MemoryConstructStore();
    const owner = '00000000-0000-4000-8000-000000000001';
    const project = '00000000-0000-4000-8000-000000000002';
    const runId = '00000000-0000-4000-8000-000000000040';
    const hash = 'b'.repeat(64);
    const source = {
      id: runId,
      person_id: owner,
      kind: 'imported' as const,
      repository: null,
      commit: null,
      label: 'Imported source snapshot — exact attached files, not live repository knowledge.',
      tree_hash: hash,
      files: [{ path: 'preview.html', content: '<h1>Before</h1>' }],
      created_at: new Date().toISOString(),
    };
    await store.importSource(source);
    const brief = await store.approveBrief(owner, runId, {
      project_id: project,
      project_revision: 1,
      source_id: source.id,
      repository: null,
      source_commit: null,
      source_tree_hash: hash,
      allowed_paths: ['preview.html'],
      protected_paths: ['.env'],
      intended_change: 'Replace the heading.',
      acceptance_checks: [{ name: 'syntax:preview', command: 'true', args: [] }],
      resource_limits: {
        timeout_ms: 30000,
        lease_ms: 45000,
        max_files: 32,
        max_file_bytes: 65536,
        max_output_bytes: 16384,
        max_diff_bytes: 32768,
      },
      patch: [{ path: 'preview.html', before: '<h1>Before</h1>', after: '<h1>After</h1>' }],
    });
    await store.startRun({
      personId: owner,
      projectId: project,
      briefId: brief.id,
      requestId: runId,
      expected: 1,
      sourceKind: 'imported',
      sourceTreeHash: hash,
      approvalHash: brief.approval_hash,
      sourceId: source.id,
    });
    const claimed = await store.claimRun('worker-boundary', new Date());
    const token = claimed?.lease_token;
    if (!claimed || !token) throw new Error('Claim did not issue a lease.');
    const bounded = boundRunResult(bulkyResult(`${'boundary '.repeat(8000)}\n`));
    const pad = RESULT_RECEIPT_MAX_BYTES - serializedReceiptBytes(bounded);
    expect(pad).toBeGreaterThan(0);
    const atLimit = {
      ...bounded,
      preview: { ...bounded.preview, body: `${bounded.preview.body}${'n'.repeat(pad)}` },
    };
    while (serializedReceiptBytes(atLimit) > RESULT_RECEIPT_MAX_BYTES) {
      atLimit.preview.body = atLimit.preview.body.slice(0, -1);
    }
    while (serializedReceiptBytes(atLimit) < RESULT_RECEIPT_MAX_BYTES) {
      atLimit.preview.body = `${atLimit.preview.body}n`;
    }
    expect(serializedReceiptBytes(atLimit)).toBe(RESULT_RECEIPT_MAX_BYTES);
    const over = {
      ...atLimit,
      preview: { ...atLimit.preview, body: `${atLimit.preview.body}x` },
    };
    expect(serializedReceiptBytes(over)).toBe(RESULT_RECEIPT_MAX_BYTES + 1);
    await expect(
      store.finishRun('worker-boundary', claimed.id, token, 'failed', over, new Date()),
    ).rejects.toBeInstanceOf(ConstructStoreError);
    const stillOpen = await store.readRun(owner, claimed.id);
    expect(stillOpen?.status).toBe('claimed');
    const finished = await store.finishRun(
      'worker-boundary',
      claimed.id,
      token,
      'failed',
      atLimit,
      new Date(),
    );
    expect(finished.status).toBe('failed');
    expect(serializedReceiptBytes(finished.result)).toBe(RESULT_RECEIPT_MAX_BYTES);
  });
});
