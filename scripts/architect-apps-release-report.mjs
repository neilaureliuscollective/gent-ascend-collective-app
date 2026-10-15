// Offline evidence validation only: no environment reads, network, SQL or worker invocation.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { requiredAppsSchemaContracts } from '../src/domains/architect-apps/schema-probe.ts';

const manifestBytes = readFileSync(
  new URL('./architect-apps-release-manifest.json', import.meta.url),
);
export const manifest = JSON.parse(manifestBytes);
export const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
const sha = /^[a-f0-9]{40}$/;
const digest = /^sha256:[a-f0-9]{64}$/;
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;
const empty = (value) => Array.isArray(value) && value.length === 0;

export function commissioningPlan(profile) {
  if (!['architect-only', 'talk-integrated'].includes(profile))
    throw new Error('Unknown commissioning profile');
  return manifest.migrations.filter((step) => step.profiles.includes(profile));
}

export function releaseReport(target, evidence, now = Date.now()) {
  const blockers = [];
  const require = (ok, message) => {
    if (!ok) blockers.push(message);
  };
  require(target?.manifestSha256 === manifestSha256, 'Target must pin this manifest SHA256');
  require(sha.test(target?.commit ?? ''), 'Target needs a full candidate commit');
  require(nonempty(target?.environment), 'Target environment missing');
  require(digest.test(target?.imageDigest ?? ''), 'Target image digest missing/invalid');
  require(nonempty(target?.workerId), 'Target worker identity missing');
  require(Number.isInteger(target?.maxAgeSeconds) &&
    target.maxAgeSeconds > 0 &&
    target.maxAgeSeconds <= 86400, 'Evidence freshness window must be 1..86400 seconds');
  let plan = [];
  try {
    plan = commissioningPlan(target?.profile);
  } catch {
    blockers.push('Target profile missing/invalid');
  }
  const stamp = (receipt, name, maxAge = target?.maxAgeSeconds) => {
    require(receipt?.commit === target?.commit &&
      sha.test(receipt?.commit ?? ''), `${name}: candidate commit mismatch/missing`);
    require(receipt?.environment === target?.environment &&
      nonempty(receipt?.environment), `${name}: environment mismatch/missing`);
    require(nonempty(receipt?.reference), `${name}: evidence reference missing`);
    const time = Date.parse(receipt?.observedAt);
    require(Number.isFinite(time) &&
      time <= now &&
      now - time <= maxAge * 1000, `${name}: stale/missing/future evidence`);
  };
  for (const [name, pin] of Object.entries(manifest.sources)) {
    if (name === 'talk' && target?.profile === 'architect-only') continue;
    const source = evidence?.sources?.[name];
    stamp(source, `source ${name}`);
    require(source?.branch === pin.branch &&
      source?.observedHead === pin.head &&
      source?.includedHead ===
        pin.head, `source ${name}: stale branch head or unproven candidate inclusion; refresh manifest and evidence together`);
  }
  for (const name of manifest.requiredChecks) {
    const check = evidence?.checks?.[name];
    stamp(check, `check ${name}`);
    require(check?.conclusion === 'success', `check ${name}: terminal success missing`);
  }
  const schema = evidence?.schema;
  stamp(schema, 'schema');
  require(schema?.baselineCommit === manifest.sources.main.head &&
    schema?.baselinePhysicalVerified ===
      true, 'Physical baseline verification missing/mismatched (migration history alone is insufficient)');
  const applied = schema?.migrations;
  require(Array.isArray(applied) &&
    applied.length === plan.length &&
    plan.every(
      (step, i) => applied[i]?.file === step.file && applied[i]?.sha256 === step.sha256,
    ), 'Migration dependencies missing, duplicated, out of order or checksum mismatched');
  require(schema?.probe?.ok === true &&
    schema?.probe?.classification === 'ok' &&
    empty(schema?.probe?.missing), 'Physical schema probe did not pass');
  require(isDeepStrictEqual(
    schema?.contracts,
    requiredAppsSchemaContracts,
  ), 'Schema contract evidence mismatched/missing');
  const worker = evidence?.worker;
  stamp(worker, 'worker', Math.min(target?.maxAgeSeconds ?? 0, 90));
  require(worker?.imageDigest === target?.imageDigest &&
    digest.test(worker?.imageDigest ?? ''), 'Worker image digest mismatch/missing');
  const preflight = worker?.preflight;
  require(preflight?.ok === true &&
    preflight?.phase === 'preflight' &&
    preflight?.state === 'idle' &&
    preflight?.mode === 'commissioned' &&
    preflight?.isolation === 'docker' &&
    preflight?.digest === 'matched' &&
    preflight?.schema === 'ok' &&
    empty(preflight?.missing) &&
    preflight?.workRoot?.ok === true &&
    preflight?.workRoot?.code === 'ready' &&
    preflight?.worker === target?.workerId &&
    nonempty(preflight?.worker), 'Existing worker preflight missing/not ready/mismatched');
  for (const proof of ['write', 'compile', 'topology']) {
    const receipt = worker?.proofs?.[proof];
    stamp(receipt, `worker ${proof}`);
    require(receipt?.ok === true &&
      receipt?.imageDigest === target?.imageDigest &&
      receipt?.workerId === target?.workerId, `Worker ${proof} proof missing/mismatched`);
  }
  // The packaged worker deliberately has no model key. Provider policy belongs to the web plane.
  require(preflight?.generation?.permitted === true &&
    empty(preflight?.generation?.missing), 'Worker generation policy refused/missing');
  const provider = evidence?.provider;
  stamp(provider, 'provider');
  require(provider?.policy?.mode === 'openai' &&
    provider?.policy?.permitted === true &&
    provider?.policy?.production === true &&
    provider?.policy?.founderPilot === true &&
    provider?.policy?.generationReady === true &&
    empty(provider?.policy?.missing) &&
    empty(
      provider?.policy?.blockers,
    ), 'Web provider configuration missing/refused (use appsGenerationPolicy receipt; no secrets)');
  return {
    evidenceComplete: blockers.length === 0,
    hostedAccepted: false,
    authorizedToExecute: false,
    hostedSqlSnapshot: manifest.hostedSqlSnapshot,
    candidate: target?.commit ?? null,
    blockers,
    note: 'Offline receipt consistency only. Build/fixture success is not hosted acceptance or permission to resume SQL.',
  };
}

export function runReleaseReport(args) {
  try {
    if (args.length === 2 && args[0] === '--plan') {
      console.log(
        JSON.stringify(
          {
            executed: false,
            hostedSqlSnapshot: manifest.hostedSqlSnapshot,
            manifestSha256,
            migrations: commissioningPlan(args[1]),
          },
          null,
          2,
        ),
      );
      return 0;
    }
    if (args.length !== 4 || args[0] !== '--target' || args[2] !== '--evidence')
      throw new Error(
        'Usage: --plan <architect-only|talk-integrated> OR --target target.json --evidence evidence.json',
      );
    const report = releaseReport(
      JSON.parse(readFileSync(args[1], 'utf8')),
      JSON.parse(readFileSync(args[3], 'utf8')),
    );
    console.log(JSON.stringify(report, null, 2));
    return report.evidenceComplete ? 0 : 1;
  } catch {
    console.error(
      'Release report refused: invalid arguments or unreadable/malformed evidence. No actions executed.',
    );
    return 1;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  process.exitCode = runReleaseReport(process.argv.slice(2));
