// Disposable local Supabase only. Real Auth/PostgREST, no model or hosted writes.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function scopedTalkIdentity(seed) {
  const bytes = Uint8Array.from(createHash('sha1').update(seed).digest().subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
const owner = client();
const foreign = client();
assert.equal(
  (
    await owner.auth.signInWithPassword({
      email: 'founder@aurelius.test',
      password: env.AURELIUS_FOUNDER_PASSWORD,
    })
  ).error,
  null,
);
assert.equal(
  (
    await foreign.auth.signInWithPassword({
      email: 'member@aurelius.test',
      password: env.AURELIUS_FOUNDER_PASSWORD,
    })
  ).error,
  null,
);

const conversation = crypto.randomUUID();
const turn = crypto.randomUUID();
const briefId = crypto.randomUUID();
const briefV2 = crypto.randomUUID();
const paletteId = crypto.randomUUID();
const candidateId = crypto.randomUUID();
const handoffId = crypto.randomUUID();
const importId = crypto.randomUUID();
const wrongHandoffId = crypto.randomUUID();
const wrongImportId = crypto.randomUUID();
const brief = {
  title: 'Reserve site',
  purpose: 'A premium brand and website.',
  audience: 'Founders',
  visualDirection: 'Obsidian and gold',
  requirements: ['Phone first'],
  unresolved: ['Typeface'],
};
const palette = {
  title: 'Imperial palette',
  notes: 'Exact hex roles.',
  swatches: [
    { hex: '#080D0D', name: 'Obsidian', role: 'background' },
    { hex: '#C4912F', name: 'Reserve Gold', role: 'accent' },
  ],
  contrast: [],
};
const handoff = {
  schema: 'talk-architect-handoff/v1',
  conversationId: conversation,
  preparedAt: '2026-10-14T00:00:00.000Z',
  discipline: 'business',
  idea: 'A premium brand and website.',
  description: '',
  decisions: 'Keep emerald restrained.',
  selections: [
    {
      kind: 'brief',
      lineageId: briefId,
      versionId: briefV2,
      version: 2,
      title: 'Reserve site refined',
    },
    {
      kind: 'palette',
      lineageId: paletteId,
      versionId: paletteId,
      version: 1,
      title: 'Imperial palette',
    },
  ],
  images: [],
  imported: false,
};
const wrongContent = {
  name: 'Wrong valid content',
  description: 'Occupied destination with the expected note.',
  discipline: 'business',
  status: 'active',
  sources: [],
  documents: [],
  blueprint: Object.fromEntries(
    [
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
    ].map((key) => [key, key === 'vision' ? 'Wrong valid content' : '']),
  ),
};

try {
  assert.equal(
    (
      await owner.rpc('ai_begin_turn', {
        p_conversation: conversation,
        p_request: turn,
        p_text: 'Synthetic Talk persistence check',
        p_model: 'synthetic-no-model-call',
        p_context: false,
        p_prompt_version: 'talk-architect-import',
      })
    ).error,
    null,
  );
  assert.equal(
    (
      await owner.rpc('ai_talk_save_creation', {
        p_id: briefId,
        p_conversation: conversation,
        p_turn: turn,
        p_kind: 'brief',
        p_predecessor: null,
        p_content: brief,
      })
    ).error,
    null,
  );
  assert.equal(
    (
      await owner.rpc('ai_talk_save_creation', {
        p_id: briefV2,
        p_conversation: conversation,
        p_turn: turn,
        p_kind: 'brief',
        p_predecessor: briefId,
        p_content: { ...brief, title: 'Reserve site refined' },
      })
    ).data.version,
    2,
  );
  assert.equal(
    (
      await owner.rpc('ai_talk_save_creation', {
        p_id: paletteId,
        p_conversation: conversation,
        p_turn: null,
        p_kind: 'palette',
        p_predecessor: null,
        p_content: palette,
      })
    ).error,
    null,
  );
  const reopened = await owner
    .from('ai_talk_creations')
    .select('id,version,kind')
    .eq('conversation_id', conversation)
    .order('version');
  assert.equal(reopened.error, null);
  assert.ok(reopened.data.some((row) => row.id === briefV2 && row.version === 2));
  assert.equal(
    (
      await owner.rpc('ai_talk_save_candidate', {
        p_id: candidateId,
        p_conversation: conversation,
        p_turn: turn,
        p_kind: 'brief',
        p_base: briefV2,
        p_content: { ...brief, title: 'Stale generated proposal' },
      })
    ).error,
    null,
  );
  const current = await owner
    .from('ai_talk_selection')
    .select('creation_id')
    .eq('conversation_id', conversation)
    .eq('kind', 'brief')
    .single();
  assert.equal(current.data.creation_id, briefV2);
  const candidate = await owner.from('ai_talk_creations').select('candidate,version').eq('id', candidateId).single();
  assert.equal(candidate.data.candidate, true);
  assert.equal(
    (
      await owner.rpc('ai_talk_save_creation', {
        p_id: handoffId,
        p_conversation: conversation,
        p_turn: null,
        p_kind: 'handoff',
        p_predecessor: null,
        p_content: handoff,
      })
    ).error,
    null,
  );
  const replay = await owner.rpc('ai_talk_save_creation', {
    p_id: handoffId,
    p_conversation: conversation,
    p_turn: null,
    p_kind: 'handoff',
    p_predecessor: null,
    p_content: handoff,
  });
  assert.equal(replay.data.recovered, true);
  const person = await owner
    .from('persons')
    .select('id')
    .eq('auth_user_id', (await owner.auth.getUser()).data.user.id)
    .single();
  assert.equal(person.error, null);
  const originProject = scopedTalkIdentity(`talk-origin-project:${person.data.id}:${handoffId}`);
  const originSave = scopedTalkIdentity(`talk-origin-save:${person.data.id}:${handoffId}`);
  assert.ok((await owner.rpc('ai_talk_scoped_identity', { p_seed: `talk-origin-project:${person.data.id}:${handoffId}` })).error);
  assert.ok(
    (
      await owner.rpc('ai_talk_record_origin_import', {
        p_id: importId,
        p_handoff: handoffId,
        p_project: originProject,
        p_save: originSave,
        p_conversation: conversation,
        p_prepared: handoff.preparedAt,
        p_provenance: { imagesCopied: false, paletteRolesCopied: false },
      })
    ).error,
  );

  const wrongHandoff = {
    ...handoff,
    idea: 'A quieter luxury brand.',
    selections: [
      {
        kind: 'brief',
        lineageId: briefId,
        versionId: briefV2,
        version: 2,
        title: 'Reserve site refined',
      },
    ],
  };
  assert.equal(
    (
      await owner.rpc('ai_talk_save_creation', {
        p_id: wrongHandoffId,
        p_conversation: conversation,
        p_turn: null,
        p_kind: 'handoff',
        p_predecessor: null,
        p_content: wrongHandoff,
      })
    ).error,
    null,
  );
  const wrongProject = scopedTalkIdentity(`talk-origin-project:${person.data.id}:${wrongHandoffId}`);
  const wrongSave = scopedTalkIdentity(`talk-origin-save:${person.data.id}:${wrongHandoffId}`);
  assert.equal(
    (
      await owner.rpc('architect_origin_save', {
        p_project: wrongProject,
        p_request: wrongSave,
        p_expected: 0,
        p_content: wrongContent,
        p_note: 'Imported from Talk',
      })
    ).data,
    1,
  );
  assert.ok(
    (
      await owner.rpc('ai_talk_import_origin', {
        p_id: wrongImportId,
        p_handoff: wrongHandoffId,
        p_conversation: conversation,
      })
    ).error,
  );
  const occupied = await owner
    .from('architect_origin_versions')
    .select('content,note')
    .eq('id', wrongSave)
    .single();
  assert.equal(occupied.data.note, 'Imported from Talk');
  assert.equal(occupied.data.content.name, 'Wrong valid content');
  assert.equal(
    (await owner.from('ai_talk_origin_imports').select('id').eq('handoff_id', wrongHandoffId)).data.length,
    0,
  );

  const first = await owner.rpc('ai_talk_import_origin', {
    p_id: importId,
    p_handoff: handoffId,
    p_conversation: conversation,
  });
  assert.equal(first.error, null);
  assert.equal(first.data.projectId, originProject);
  assert.equal(first.data.saveId, originSave);
  assert.equal(first.data.mappingVersion, 'talk-origin-import/v1');
  const saved = await owner
    .from('architect_origin_versions')
    .select('content,note,revision')
    .eq('id', originSave)
    .single();
  assert.equal(saved.data.note, 'Imported from Talk');
  assert.equal(saved.data.revision, 1);
  assert.equal(saved.data.content.name, 'Reserve site refined');
  assert.match(saved.data.content.blueprint.deliverables, /#080D0D|#C4912F/);
  assert.doesNotMatch(saved.data.content.blueprint.deliverables, /background|accent/i);
  assert.match(saved.data.content.blueprint.state, /Referenced and retained in Talk only/);
  const [left, right] = await Promise.all([
    owner.rpc('ai_talk_import_origin', {
      p_id: importId,
      p_handoff: handoffId,
      p_conversation: conversation,
    }),
    owner.rpc('ai_talk_import_origin', {
      p_id: crypto.randomUUID(),
      p_handoff: handoffId,
      p_conversation: conversation,
    }),
  ]);
  assert.equal(left.data.projectId, originProject);
  assert.equal(right.data.projectId, originProject);
  assert.equal(left.data.saveId, originSave);
  assert.equal(
    (await owner.from('ai_talk_origin_imports').select('id').eq('handoff_id', handoffId)).data.length,
    1,
  );
  assert.ok(
    (
      await owner.rpc('ai_talk_import_origin', {
        p_id: importId,
        p_handoff: crypto.randomUUID(),
        p_conversation: conversation,
      })
    ).error,
  );
  assert.ok(
    (
      await owner.rpc('ai_talk_import_origin', {
        p_id: crypto.randomUUID(),
        p_handoff: handoffId,
        p_conversation: crypto.randomUUID(),
      })
    ).error,
  );
  assert.equal((await foreign.from('ai_talk_creations').select('id').eq('id', handoffId)).data.length, 0);
  assert.equal(
    (await foreign.from('ai_talk_origin_imports').select('id').eq('handoff_id', handoffId)).data.length,
    0,
  );
  assert.equal(
    (await foreign.from('architect_origin_projects').select('id').eq('id', originProject)).data.length,
    0,
  );
  assert.ok(
    (
      await foreign.rpc('ai_talk_import_origin', {
        p_id: crypto.randomUUID(),
        p_handoff: handoffId,
        p_conversation: conversation,
      })
    ).error,
  );
  console.log(
    'PASS: Talk→Architect real Auth/PostgREST brief/palette save, candidate beside current, handoff replay, atomic content-bound import, wrong-content denial, retired acknowledgement denial, concurrent retry, foreign denial. No provider evaluation.',
  );
} finally {
  await owner.from('ai_conversations').delete().eq('id', conversation);
  await owner.auth.signOut();
  await foreign.auth.signOut();
}
