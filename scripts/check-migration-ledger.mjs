import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Read-only snapshot of Gent Ascend-owned files in the shared hosted ledger,
// SQL hashes reconciled with the hosted ledger on 2026-10-02. Five Reserve-owned migrations are also applied
// in the same project but their source is maintained in a separate repository.
// This local hash check does not compare the live database on each run.
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
  ['20260925210204_founding_members_pilot.sql', '7258f409ca480ac1191868c17d12c4c1'],

  ['20260926031906_daily_action_completion.sql', 'a89aec2a4a0f302e4fc32afdf982e55e'],
  ['20260927210000_aethelios_chat_foundation.sql', '2e76538c5f3046adee305f52ab7dc66b'],
  ['20260927220000_aethelios_studio_v1.sql', '3d5d68f74b98107445a4efaf69d32d38'],
  ['20260928015000_studio_project_briefs.sql', '6cf8f39a7b2f72f2167ca3ff403fb9d7'],
  ['20260928020000_studio_storyboard.sql', 'feb52fb12eb1f3018d598e346fd30d75'],
  ['20260928021459_ascend_performance_phase_1.sql', 'cea73294c1d4f243d21119e5f1469470'],
  ['20260928023000_studio_finishes.sql', '25179db7b23c0a3aeac9d837f4c50729'],
  ['20260928145533_ascend_performance_programs.sql', '1a93325610c7881987f4ddd871d410f5'],
  ['20260928151124_studio_table_privileges.sql', '3084d934e42e62e36573b38af73ba30c'],
  ['20260928151743_ascend_performance_progression.sql', '63005ab37e1ba911a2135909a8d8b0a0'],
  ['20260928152818_grooming_concierge_recovery.sql', '4bff48892cdcff61fcc014345033bb8f'],
  ['20260928203910_ascend_performance_outcomes.sql', '531457406ee3510d9737452fcaff947e'],
  ['20260928215620_ascend_performance_fuel_body.sql', '25b9af35a6972d87008db85cecbf179b'],
  ['20260928223531_ascend_performance_recovery.sql', '9f55d35585e60b0af1ca9234b9a8d3ad'],
  ['20260929083302_ascend_performance_movement.sql', 'e7d95655c9c64262a5f0d75bf2459362'],
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
console.log(`Verified ${applied.size} Gent Ascend-owned migration files against the recorded hosted ledger snapshot; five Reserve-owned migrations are tracked in the shared database separately.`);
