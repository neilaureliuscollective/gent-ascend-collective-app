import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateSnapshot,
  expectedChecks,
  verifyMigrationFiles,
} from './public-release-preflight.mjs';
const now = Date.parse('2026-10-08T17:00:00Z');
const snapshot = () => ({
  contract: 'public-mission-v1',
  observed_at: new Date(now).toISOString(),
  checks: expectedChecks.map(([stage, object]) => ({ stage, object, present: true, ok: true })),
});
test('observed catalog never becomes release approval', () => {
  const result = evaluateSnapshot([{ snapshot: snapshot() }], now);
  assert.equal(result.catalogStatus, 'observed');
  assert.equal(result.releaseApproved, false);
});
test('fully absent additive stages preserve exact migration order', () => {
  const input = snapshot();
  for (const c of input.checks) if (c.stage !== 'prerequisite') c.present = c.ok = false;
  const result = evaluateSnapshot(input, now);
  assert.equal(result.catalogStatus, 'pending');
  assert.deepEqual(
    result.stages.map((s) => s.status),
    ['pending', 'pending', 'pending', 'pending', 'pending', 'pending'],
  );
  assert.deepEqual(result.migrationOrder, [
    '20261007190000_mission_continuity.sql',
    '20261007210000_mission_deliverables.sql',
    '20261008180000_technology_foundation.sql',
    '20261008221240_technology_verified_build.sql',
    '20261009001910_technology_design_engine.sql',
    '20261009005242_technology_talk_context.sql',
  ]);
});
test('prerequisite drift, partial application and reversed stage dependencies block', () => {
  for (const object of ['column:ai_turns.person_id', 'table:mission_outputs']) {
    const input = snapshot();
    input.checks.find((c) => c.object === object).ok = false;
    assert.equal(evaluateSnapshot(input, now).catalogStatus, 'blocked');
  }
  const input = snapshot();
  for (const c of input.checks) if (c.stage === 'continuity') c.present = c.ok = false;
  assert.equal(evaluateSnapshot(input, now).catalogStatus, 'blocked');
});
test('rejects stale, incomplete, duplicated and falsely successful snapshots', () => {
  const stale = snapshot();
  stale.observed_at = new Date(now - 16 * 60 * 1000).toISOString();
  assert.throws(() => evaluateSnapshot(stale, now), /stale/);
  const incomplete = snapshot();
  incomplete.checks.pop();
  assert.throws(() => evaluateSnapshot(incomplete, now), /incomplete/);
  const duplicate = snapshot();
  duplicate.checks.push(duplicate.checks[0]);
  assert.throws(() => evaluateSnapshot(duplicate, now), /duplicated/);
  const falseSuccess = snapshot();
  falseSuccess.checks[0].present = false;
  assert.throws(() => evaluateSnapshot(falseSuccess, now), /invalid/);
  const absentIdentity = snapshot();
  absentIdentity.checks[0] = { present: true, ok: true };
  assert.throws(() => evaluateSnapshot(absentIdentity, now), /invalid/);
});
test('rejects unknown fields in check identities and never reflects private payloads', () => {
  const input = snapshot();
  input.checks[0].object = 'private payload';
  assert.throws(
    () => evaluateSnapshot(input, now),
    (error) => !error.message.includes('private payload'),
  );
});
test('the six reviewed migration sources retain exact hashes', verifyMigrationFiles);
