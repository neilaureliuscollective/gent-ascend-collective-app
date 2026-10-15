// Disposable local Supabase only. Real Auth/PostgREST, no model or hosted writes.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);
assert.equal(
  new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname,
  '127.0.0.1',
  'Disposable loopback Supabase only',
);
const client = () =>
  createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const owner = client(),
  foreign = client(),
  anon = client();
for (const [c, email] of [
  [owner, 'member@aurelius.test'],
  [foreign, 'founder@aurelius.test'],
])
  assert.equal(
    (await c.auth.signInWithPassword({ email, password: env.AURELIUS_FOUNDER_PASSWORD })).error,
    null,
  );
const keys = [
  'vision',
  'opportunity',
  'audience',
  'requirements',
  'research',
  'solution',
  'architecture',
  'decisions',
  'risks',
  'milestones',
  'deliverables',
  'state',
  'next',
];
const content = {
  name: 'Synthetic Origin Auth journey',
  description: 'No real customer or private records.',
  discipline: 'business',
  status: 'active',
  blueprint: Object.fromEntries(
    keys.map((k) => [k, k === 'vision' ? 'Synthetic test business' : '']),
  ),
  sources: [],
  documents: [],
};
const project = crypto.randomUUID(),
  receipt = crypto.randomUUID();
const save = {
  p_project: project,
  p_request: receipt,
  p_expected: 0,
  p_content: content,
  p_note: 'Synthetic Auth acceptance',
};
try {
  assert.equal((await owner.rpc('architect_origin_save', save)).data, 1);
  assert.equal((await owner.rpc('architect_origin_save', save)).data, 1);
  assert.equal(
    (await owner.from('architect_origin_versions').select('id').eq('project_id', project)).data
      .length,
    1,
  );
  assert.equal(
    (await foreign.from('architect_origin_projects').select('id').eq('id', project)).data.length,
    0,
  );
  assert.equal(
    (await foreign.from('architect_origin_versions').select('id').eq('project_id', project)).data
      .length,
    0,
  );
  assert.ok(
    (
      await foreign.rpc('architect_origin_save', {
        ...save,
        p_request: crypto.randomUUID(),
        p_expected: 1,
      })
    ).error,
  );
  assert.ok((await anon.from('architect_origin_projects').select('id')).error);
  assert.ok((await anon.rpc('architect_origin_save', save)).error);
  assert.ok(
    (
      await owner
        .from('architect_origin_projects')
        .update({ content: { ...content, name: 'Forbidden direct overwrite' } })
        .eq('id', project)
    ).error,
  );
  assert.ok(
    (await owner.from('architect_origin_versions').delete().eq('project_id', project)).error,
  );
  const document = {
    id: crypto.randomUUID(),
    title: 'Synthetic plan',
    kind: 'Business plan',
    content:
      '# Synthetic plan\n\nVerify audience interviews, supplier quotes and safety requirements.',
    status: 'approved',
    basis: 1,
  };
  const next = {
    ...content,
    documents: [document],
    blueprint: {
      ...content.blueprint,
      audience: 'Synthetic audience',
      decisions: 'User-confirmed direction',
    },
  };
  assert.equal(
    (
      await owner.rpc('architect_origin_save', {
        ...save,
        p_request: crypto.randomUUID(),
        p_expected: 1,
        p_content: next,
      })
    ).data,
    2,
  );
  assert.ok(
    (
      await owner.rpc('architect_origin_save', {
        ...save,
        p_request: crypto.randomUUID(),
        p_expected: 1,
      })
    ).error,
  );
  const resumed = await owner
    .from('architect_origin_projects')
    .select('*')
    .eq('id', project)
    .single();
  assert.equal(resumed.error, null);
  assert.deepEqual(resumed.data.content, next);
  assert.equal(
    (
      await owner.rpc('architect_origin_save', {
        ...save,
        p_request: crypto.randomUUID(),
        p_expected: 2,
        p_content: { ...next, status: 'archived' },
      })
    ).data,
    3,
  );
  const history = await owner
    .from('architect_origin_versions')
    .select('*')
    .eq('project_id', project)
    .order('revision');
  assert.equal(history.data.length, 3);
  assert.deepEqual(history.data[1].content.documents, [document]);
  const tool = crypto.randomUUID();
  const toolReceipt = crypto.randomUUID();
  const toolConfig = {
    kind: 'quantity-cost-estimator',
    currency: 'USD',
    rounding: 'half-up-minor',
    waste_percent: '10',
    markup_percent: '15',
    assumptions: 'Sample demonstration — Auth smoke. Not a live supplier quote.',
    items: [
      {
        id: crypto.randomUUID(),
        name: 'Plywood sheet 8x4',
        quantity: '12',
        unit: 'sheet',
        unit_cost: '24.50',
      },
    ],
  };
  assert.equal(
    (
      await owner.rpc('architect_origin_tool_save', {
        p_tool: tool,
        p_project: project,
        p_request: toolReceipt,
        p_expected: 0,
        p_name: 'Auth smoke estimator',
        p_config: toolConfig,
        p_note: 'Synthetic tool save',
      })
    ).data,
    1,
  );
  assert.equal(
    (await foreign.from('architect_origin_tools').select('id').eq('id', tool)).data.length,
    0,
  );
  assert.ok(
    (
      await foreign.rpc('architect_origin_tool_record_invocation', {
        p_id: crypto.randomUUID(),
        p_tool: tool,
        p_revision: 1,
        p_inputs: { quantities: {} },
        p_result: { total: '1.00' },
        p_source: 'architect',
      })
    ).error,
  );
  assert.ok(
    (
      await owner.rpc('architect_origin_tool_record_invocation', {
        p_id: crypto.randomUUID(),
        p_tool: tool,
        p_revision: 1,
        p_inputs: { quantities: {} },
        p_result: { total: '1.00', currency: 'USD' },
        p_source: 'architect',
      })
    ).error,
    'owner must not persist a forged invocation result',
  );
  const invokeId = crypto.randomUUID();
  const invoked = await owner.rpc('architect_origin_tool_invoke', {
    p_id: invokeId,
    p_project: project,
    p_tool: tool,
    p_revision: 1,
    p_inputs: { quantities: {} },
    p_source: 'architect',
  });
  assert.equal(invoked.data.total, '371.91');
  assert.equal(
    (
      await owner.rpc('architect_origin_tool_invoke', {
        p_id: invokeId,
        p_project: project,
        p_tool: tool,
        p_revision: 1,
        p_inputs: { quantities: {} },
        p_source: 'architect',
      })
    ).data.total,
    '371.91',
  );
  assert.ok(
    (
      await owner.rpc('architect_origin_tool_save', {
        p_tool: crypto.randomUUID(),
        p_project: project,
        p_request: crypto.randomUUID(),
        p_expected: 0,
        p_name: 'Invalid zero quantity',
        p_config: { ...toolConfig, items: [{ ...toolConfig.items[0], quantity: '0' }] },
        p_note: 'Invalid save',
      })
    ).error,
  );
  const fineTool = crypto.randomUUID();
  const fineReceipt = crypto.randomUUID();
  const fineConfig = {
    kind: 'quantity-cost-estimator',
    currency: 'USD',
    rounding: 'half-up-minor',
    waste_percent: '50',
    markup_percent: null,
    assumptions: 'Fine-cut Auth smoke. Not a live supplier quote.',
    items: [
      {
        id: crypto.randomUUID(),
        name: 'Fine cut',
        quantity: '0.0001',
        unit: 'tonne',
        unit_cost: '10000',
      },
    ],
  };
  assert.equal(
    (
      await owner.rpc('architect_origin_tool_save', {
        p_tool: fineTool,
        p_project: project,
        p_request: fineReceipt,
        p_expected: 0,
        p_name: 'Fine-cut estimator',
        p_config: fineConfig,
        p_note: 'Precision tool save',
      })
    ).data,
    1,
  );
  const fineInvoked = await owner.rpc('architect_origin_tool_invoke', {
    p_id: crypto.randomUUID(),
    p_project: project,
    p_tool: fineTool,
    p_revision: 1,
    p_inputs: { quantities: {} },
    p_source: 'architect',
  });
  assert.equal(fineInvoked.data.total, '1.50');
  assert.equal(fineInvoked.data.lines[0].waste, '0.50');
  assert.ok(
    (
      await foreign.rpc('architect_origin_tool_invoke', {
        p_id: crypto.randomUUID(),
        p_project: project,
        p_tool: tool,
        p_revision: 1,
        p_inputs: { quantities: {} },
        p_source: 'architect',
      })
    ).error,
  );
  console.log(
    'PASS: Origin actual local Auth/PostgREST create, exact replay, immutable history, stale writes, foreign/anonymous/direct-write denial, document persistence, archive retention, and authoritative estimator invoke with forged-result denial. No provider evaluation.',
  );
} finally {
  // Disposable local database retains only synthetic rows until CI stops without backup.
  await owner.auth.signOut();
  await foreign.auth.signOut();
}
