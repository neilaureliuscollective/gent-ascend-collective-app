import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Read-only snapshot of the hosted Gent Ascend migration ledger, 2026-09-25.
// The database was queried for version, name and md5(statements[1]); no production mutation.
const applied = new Map([
  ['20260924150752_202609200001_foundation.sql', 'dea15ce18e0d6bdaab921105a2a5e029'],
  ['20260924150810_202609200002_person_and_goals.sql', 'b8acf698ab71908359bbaa6f854e0be5'],
  ['20260924150812_202609200003_aurelius.sql', 'e49563a062bf227fd0f6a08d79b1ce77'],
  ['20260924150813_202609210004_daily_dashboard.sql', 'a1abfd5253893c86b1de093d366881d0'],
  ['20260924150814_202609240005_grooming_foundation.sql', '911fcf6a14a630fdcb751fa12003bb2a'],
  ['20260924150815_20260924144912_founder_access.sql', '993ba4836a53fd4fd973c2c1c94c5faa'],
  ['20260925135437_ascend_loop_capture.sql', '768c2fa0c91798cd989ff0bb453d10de'],
  ['20260925135447_ascend_profile_baseline.sql', '41aac19a4dc659c95d66cc840dab3333'],
  ['20260925135455_aethelios_confirmed_actions.sql', 'c4fe550769976ddbef025c79f152575d'],
  ['20260925135504_daily_review_continuity.sql', '610d3661d18f7e0d08dbb126b217bfbc'],
]);
const directory = new URL('../supabase/migrations/', import.meta.url);
const filenames = (await readdir(directory)).filter(name => name.endsWith('.sql'));
for (const [name, expected] of applied) {
  if (!filenames.includes(name)) throw new Error(`Applied migration absent from source: ${name}`);
  const content = await readFile(new URL(name, directory));
  const actual = createHash('md5').update(content).digest('hex');
  if (actual !== expected) throw new Error(`Applied migration changed after deployment: ${name}`);
}
const versions = filenames.map(name => name.split('_')[0]);
if (new Set(versions).size !== versions.length) throw new Error('Duplicate migration version in source');
console.log(`Verified ${applied.size} applied migration files against the recorded hosted ledger snapshot.`);
