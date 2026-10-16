import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  commissioningPlan,
  manifest,
  manifestSha256,
  releaseReport,
} from './architect-apps-release-report.mjs';
import { requiredAppsSchemaContracts } from '../src/domains/architect-apps/schema-probe.ts';

const now = Date.parse('2026-10-15T12:00:00Z');
function fixture(profile = 'talk-integrated') {
  const target = {
    manifestSha256,
    profile,
    commit: 'a'.repeat(40),
    environment: 'synthetic-test',
    imageDigest: `sha256:${'b'.repeat(64)}`,
    workerId: 'fixture-worker-1',
    maxAgeSeconds: 3600,
  };
  const receipt = () => ({
    commit: target.commit,
    environment: target.environment,
    observedAt: new Date(now).toISOString(),
    reference: 'fixture://not-hosted-evidence',
  });
  const evidence = {
    sources: Object.fromEntries(
      Object.entries(manifest.sources).map(([name, source]) => [
        name,
        {
          ...receipt(),
          branch: source.branch,
          observedHead: source.head,
          includedHead: source.head,
        },
      ]),
    ),
    checks: Object.fromEntries(
      manifest.requiredChecks.map((name) => [name, { ...receipt(), conclusion: 'success' }]),
    ),
    schema: {
      ...receipt(),
      baselineCommit: manifest.sources.main.head,
      baselinePhysicalVerified: true,
      migrations: commissioningPlan(profile).map(({ file, sha256 }) => ({ file, sha256 })),
      contracts: structuredClone(requiredAppsSchemaContracts),
      probe: { ok: true, classification: 'ok', missing: [] },
    },
    worker: {
      ...receipt(),
      imageDigest: target.imageDigest,
      preflight: {
        ok: true,
        phase: 'preflight',
        state: 'idle',
        mode: 'commissioned',
        isolation: 'docker',
        worker: target.workerId,
        digest: 'matched',
        schema: 'ok',
        missing: [],
        workRoot: { ok: true, code: 'ready' },
        generation: { permitted: true, missing: [] },
      },
      proofs: Object.fromEntries(
        ['write', 'compile', 'topology'].map((name) => [
          name,
          { ...receipt(), ok: true, imageDigest: target.imageDigest, workerId: target.workerId },
        ]),
      ),
    },
    provider: {
      ...receipt(),
      policy: {
        mode: 'openai',
        permitted: true,
        production: true,
        founderPilot: true,
        generationReady: true,
        missing: [],
        blockers: [],
      },
    },
  };
  return { target, evidence };
}
for (const profile of ['architect-only', 'talk-integrated']) {
  test(`${profile}: complete ordered fixture is consistent but never hosted acceptance`, () => {
    const { target, evidence } = fixture(profile);
    const report = releaseReport(target, evidence, now);
    assert.deepEqual(report.blockers, []);
    assert.equal(report.evidenceComplete, true);
    assert.equal(report.hostedAccepted, false);
    assert.equal(report.authorizedToExecute, false);
    assert.equal(report.hostedSqlSnapshot.reportedStatus, 'paused-after-talk-step-6');
    assert.equal(report.hostedSqlSnapshot.recordedOn, '2026-10-15');
    assert.equal(report.hostedSqlSnapshot.liveStatusVerified, false);
    assert.equal(Object.hasOwn(report, 'hostedSql'), false);
    const names = evidence.schema.migrations.map((x) => x.file);
    const index = (prefix) => names.findIndex((x) => x.startsWith(prefix));
    assert.ok(index('20261015156500') < index('20261015156600'));
    assert.ok(index('20261015156600') < index('20261015156700'));
    if (profile === 'talk-integrated') {
      assert.equal(index('20261015155000'), -1);
      assert.ok(index('20261015156700') < index('20261015160000'));
      assert.ok(index('20261015160000') < index('20261015170000'));
      assert.ok(names.at(-1).includes('talk_origin_import_recovery'));
    } else assert.ok(index('20261015155000') < index('20261015156000'));
  });
}
const failures = {
  'omitted budget lock': ({ evidence }) => {
    evidence.schema.migrations = evidence.schema.migrations.filter(
      (x) => !x.file.includes('budget_lock'),
    );
  },
  'out of order dependencies': ({ evidence }) => evidence.schema.migrations.reverse(),
  'duplicate migration': ({ evidence }) =>
    evidence.schema.migrations.push(evidence.schema.migrations[0]),
  'wrong migration bytes': ({ evidence }) => {
    evidence.schema.migrations[0].sha256 = '0'.repeat(64);
  },
  'stale branch head': ({ evidence }) => {
    evidence.sources.talk.observedHead = 'c'.repeat(40);
  },
  'missing candidate inclusion': ({ evidence }) => {
    delete evidence.sources.architect.includedHead;
  },
  'checks from old commit': ({ evidence }) => {
    evidence.checks.quality.commit = 'c'.repeat(40);
  },
  'pending check': ({ evidence }) => {
    evidence.checks.quality.conclusion = 'pending';
  },
  'missing isolate check': ({ evidence }) => {
    delete evidence.checks['apps-isolate'];
  },
  'missing workers': ({ evidence }) => {
    delete evidence.worker;
  },
  'stale worker evidence': ({ evidence }) => {
    evidence.worker.observedAt = new Date(now - 91000).toISOString();
  },
  'future evidence': ({ evidence }) => {
    evidence.schema.observedAt = new Date(now + 1000).toISOString();
  },
  'missing provider configuration': ({ evidence }) => {
    delete evidence.provider;
  },
  'mock provider': ({ evidence }) => {
    evidence.provider.policy.mode = 'mock';
  },
  'missing provider key': ({ evidence }) => {
    evidence.provider.policy.generationReady = false;
    evidence.provider.policy.missing = ['OPENAI_API_KEY'];
  },
  'wrong worker digest': ({ evidence }) => {
    evidence.worker.imageDigest = `sha256:${'c'.repeat(64)}`;
  },
  'wrong worker identity': ({ evidence }) => {
    evidence.worker.preflight.worker = 'other';
  },
  'missing topology': ({ evidence }) => {
    delete evidence.worker.proofs.topology;
  },
  'schema history only': ({ evidence }) => {
    delete evidence.schema.baselinePhysicalVerified;
  },
  'missing budget schema contract': ({ evidence }) => {
    delete evidence.schema.contracts.tables.architect_app_generation_budgets;
  },
  'denied schema': ({ evidence }) => {
    evidence.schema.probe.classification = 'denied';
  },
  'environment mismatch': ({ evidence }) => {
    evidence.worker.environment = 'other';
  },
  'unpinned manifest': ({ target }) => {
    delete target.manifestSha256;
  },
  'unbounded freshness': ({ target }) => {
    target.maxAgeSeconds = Infinity;
  },
  'unknown profile': ({ target }) => {
    target.profile = 'anything';
  },
};
for (const [name, change] of Object.entries(failures))
  test(`fails closed: ${name}`, () => {
    const input = fixture();
    change(input);
    assert.equal(releaseReport(input.target, input.evidence, now).evidenceComplete, false);
  });
test('missing evidence fails closed', () =>
  assert.equal(releaseReport({}, {}, now).evidenceComplete, false));
// Only an explicitly declared Talk-only dependency may be absent from this Architect checkout.
// Every other I/O error must fail, including unreadable optional files.
function verifyMigrationFiles(steps = manifest.migrations, read = readFileSync) {
  for (const step of steps) {
    let bytes;
    try {
      bytes = read(new URL(`../supabase/migrations/${step.file}`, import.meta.url));
    } catch (error) {
      if (
        error.code === 'ENOENT' &&
        step.optionalOnArchitectBranch === true &&
        step.profiles.length === 1 &&
        step.profiles[0] === 'talk-integrated'
      )
        continue;
      throw error;
    }
    assert.equal(createHash('sha256').update(bytes).digest('hex'), step.sha256, step.file);
  }
}
test('every required Architect migration exists and matches its checksum', () => {
  verifyMigrationFiles();
  const budget = manifest.migrations.find((step) => step.file.includes('budget_lock'));
  assert.ok(budget);
  assert.notEqual(budget.optionalOnArchitectBranch, true);
  assert.ok(requiredAppsSchemaContracts.rpcs.includes('architect_apps_lock_generation_budget'));
});
for (const step of manifest.migrations.filter((step) => step.profiles.includes('architect-only'))) {
  test(`rejects absent required migration: ${step.file}`, () => {
    assert.throws(
      () =>
        verifyMigrationFiles([step], () => {
          throw Object.assign(new Error('Synthetic missing file'), { code: 'ENOENT' });
        }),
      { code: 'ENOENT' },
    );
  });
}
for (const code of ['EACCES', 'EISDIR', 'EIO']) {
  for (const optional of [false, true]) {
    test(`rejects ${code} for ${optional ? 'optional Talk' : 'required Architect'} file`, () => {
      const step = manifest.migrations.find(
        (step) => Boolean(step.optionalOnArchitectBranch) === optional,
      );
      assert.throws(
        () =>
          verifyMigrationFiles([step], () => {
            throw Object.assign(new Error('Synthetic read failure'), { code });
          }),
        { code },
      );
    });
  }
}
test('only explicitly optional Talk-only ENOENT is allowed; present files still hash', () => {
  const step = manifest.migrations.find((step) => step.optionalOnArchitectBranch === true);
  const absent = () => {
    throw Object.assign(new Error('Synthetic absence'), { code: 'ENOENT' });
  };
  assert.doesNotThrow(() => verifyMigrationFiles([step], absent));
  assert.throws(
    () => verifyMigrationFiles([{ ...step, optionalOnArchitectBranch: false }], absent),
    { code: 'ENOENT' },
  );
  assert.throws(() => verifyMigrationFiles([{ ...step, profiles: ['architect-only'] }], absent), {
    code: 'ENOENT',
  });
  assert.throws(
    () => verifyMigrationFiles([step], () => Buffer.from('wrong bytes')),
    /AssertionError/,
  );
});
test('offline preflight dispatch and malformed evidence never invoke worker dependencies', () => {
  const cwd = new URL('..', import.meta.url);
  const result = spawnSync(
    process.execPath,
    [
      'scripts/architect-apps-worker-preflight.mjs',
      '--release-report',
      '--plan',
      'talk-integrated',
    ],
    { cwd, encoding: 'utf8', env: {} },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).executed, false);
  const dir = mkdtempSync(join(tmpdir(), 'architect-report-'));
  try {
    const path = join(dir, 'bad.json');
    writeFileSync(path, '{');
    const invalid = spawnSync(
      process.execPath,
      ['scripts/architect-apps-release-report.mjs', '--target', path, '--evidence', path],
      { cwd, encoding: 'utf8', env: {} },
    );
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /No actions executed/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
