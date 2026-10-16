import { beforeAll, afterAll, it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import {
  lifestyleLaunchBoard,
  legacyReserveBoard,
  selectDesignDirection,
} from '@/domains/talk-creation/design-board';
import { produceArchitectDirection } from '@/domains/talk-creation/architect-direction';
import {
  canonicalDesignJson,
  designDirectionDigest,
  type DesignDirectionReceipt,
} from '@/domains/architect-design-direction/contract';

// PostgreSQL emulation, not Supabase Auth. Real Auth/PostgREST is covered separately.
const db = new PGlite({ extensions: { pgcrypto } });
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const conversation = '00000000-0000-4000-8000-000000000003';
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}
async function save(board = lifestyleLaunchBoard(), predecessor: string | null = null) {
  const id = randomUUID();
  const result = await asUser(
    owner,
    `select public.ai_talk_save_creation('${id}','${conversation}',null,'board',${predecessor ? `'${predecessor}'` : 'null'},${literal(board)}) as saved`,
  );
  const version = (result.rows[0] as { saved: { version: number } }).saved.version;
  return {
    id,
    board,
    receipt: produceArchitectDirection({
      conversationId: conversation,
      boardId: id,
      version,
      board,
    }),
  };
}
async function derive(id: string, version = 1) {
  return (
    await db.query(
      `select public.ai_talk_derived_design_receipt('${owner}','${conversation}','${id}',${version}) as receipt`,
    )
  ).rows[0] as { receipt: DesignDirectionReceipt | null };
}
async function project() {
  const id = randomUUID();
  await db.exec(`insert into public.architect_origin_projects values('${id}','${owner}')`);
  return id;
}
function retain(id: string, projectId: string, receipt: DesignDirectionReceipt) {
  return `select public.architect_apps_retain_design('${id}','${projectId}','${receipt.digest}',${literal(receipt)},'talk-authorized',true)`;
}
function record(id: string, projectId: string, receipt: DesignDirectionReceipt) {
  return `select public.ai_talk_record_direction_transfer('${id}','${conversation}','${receipt.identity.boardId}',${receipt.identity.boardVersion},'${receipt.content.designSnapshot?.direction.id ?? 'direction-b'}','${receipt.identity.directionId}','${projectId}','${receipt.digest}',${literal(receipt)}) as saved`;
}

beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create schema auth; create schema extensions;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema public,auth to authenticated,anon;
    create extension pgcrypto with schema extensions;
    create table public.persons(id uuid primary key,auth_user_id uuid);
    insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
    grant select on public.persons to authenticated;
    create table public.ai_conversations(id uuid primary key,person_id uuid,title text,company_id uuid,archived_at timestamptz,unique(person_id,id));
    insert into public.ai_conversations values('${conversation}','${owner}','Synthetic premium',null,null);
    create table public.ai_turns(id uuid primary key,person_id uuid,conversation_id uuid);
    create table public.architect_origin_projects(id uuid,person_id uuid,primary key(id,person_id));
    create table public.architect_design_directions(request_id uuid primary key,person_id uuid,project_id uuid,revision integer,digest text,receipt jsonb,started boolean,source_kind text,verified boolean);
    grant select on public.architect_design_directions to authenticated;
    create table public.ai_studio_projects(id uuid primary key,person_id uuid,company_id uuid);
    create table public.ai_studio_versions(id uuid primary key,person_id uuid,project_id uuid,status text,storage_key text);
    create function public.ai_talk_scoped_identity(seed text) returns uuid language plpgsql immutable set search_path=public,extensions as $$
    declare raw bytea; hex text;
    begin raw:=substring(digest(convert_to(seed,'UTF8'),'sha1') from 1 for 16);
      raw:=set_byte(set_byte(raw,6,(get_byte(raw,6)&15)|80),8,(get_byte(raw,8)&63)|128);
      hex:=encode(raw,'hex'); return (substr(hex,1,8)||'-'||substr(hex,9,4)||'-'||substr(hex,13,4)||'-'||substr(hex,17,4)||'-'||substr(hex,21,12))::uuid; end $$;`);
  for (const file of [
    '20261013240000_talk_creation.sql',
    '20261013260000_talk_creation_candidates.sql',
    '20261014100000_talk_design_board.sql',
    '20261014130000_talk_direction_transfers.sql',
    '20261015170000_architect_apps_retain_provenance.sql',
    '20261016051741_premium_design_receipt.sql',
  ])
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
});
afterAll(() => db.close());

it('keeps genuine v1 content and digest byte-identical', async () => {
  const { id, receipt } = await save(legacyReserveBoard());
  const prior = (
    await db.query(
      `select public.ai_talk_derived_design_receipt_v1('${owner}','${conversation}','${id}',1) as receipt`,
    )
  ).rows[0] as { receipt: unknown };
  expect((await derive(id)).receipt).toEqual(prior.receipt);
  expect((await derive(id)).receipt?.digest).toBe(receipt.digest);
  expect(receipt.digest).toBe(
    createHash('sha256')
      .update(JSON.stringify({ content: receipt.content, sourceRecords: receipt.sourceRecords }))
      .digest('hex'),
  );
});

for (const directionId of ['direction-a', 'direction-b', 'direction-c'])
  it(`matches exact JS/PostgreSQL premium receipt for ${directionId}, Unicode and escaped copy`, async () => {
    const board = selectDesignDirection(lifestyleLaunchBoard(), directionId);
    board.product = 'Aethelios — Lumière 🧭';
    const selected = board.directions.find((x) => x.id === directionId)!;
    selected.copy.proof = 'Quoted “craft” / \\ materials\nSecond paragraph 🧭';
    selected.demo.supporting = 'Lists, paragraphs, \t tabs and \u2028 Unicode.';
    selected.tokens.colors[0]!.hex = '#aAbBcC';
    const { id, receipt } = await save(board);
    const derived = (await derive(id)).receipt!;
    expect(derived.content).toEqual(receipt.content);
    expect(derived.digest).toBe(receipt.digest);
    expect(derived.sourceRecords).toEqual(receipt.sourceRecords);
    const review = await asUser(
      owner,
      `select public.ai_talk_review_premium_direction('${conversation}','${id}',1) as result`,
    );
    expect(review.rows[0]).toEqual({ result: { capability: 'talk-premium-receipt/v1', receipt } });
    expect(canonicalDesignJson(derived.content)).toBe(canonicalDesignJson(receipt.content));
    // Nested key order is independently exercised by jsonb and the full digest comparison.
  });

it('retains only the exact saved revision, with replay idempotency and prior artifacts preserved', async () => {
  const first = await save();
  const revised = structuredClone(first.board);
  revised.directions[0]!.demo.headline = 'A revised, owned creative.';
  const current = await save(revised, first.id);
  expect(current.receipt.identity.boardVersion).toBe(2);
  const projectId = await project(),
    requestId = randomUUID();
  await asUser(
    owner,
    retain(requestId, projectId, current.receipt).replace(
      "'talk-authorized',true",
      "'pending',false",
    ),
  );
  await asUser(owner, retain(requestId, projectId, current.receipt));
  const stored = await asUser(
    owner,
    `select receipt,verified,source_kind,started from public.architect_design_directions where request_id='${requestId}'`,
  );
  await expect(asUser(owner, retain(randomUUID(), projectId, current.receipt))).rejects.toThrow(
    /already retained/,
  );
  expect(stored.rows).toEqual([
    { receipt: current.receipt, verified: true, source_kind: 'talk-authorized', started: false },
  ]);
  expect(
    (await asUser(owner, record(requestId, projectId, current.receipt))).rows[0],
  ).toMatchObject({ saved: { imported: true, recovered: false } });
  expect(
    (await asUser(owner, record(requestId, projectId, current.receipt))).rows[0],
  ).toMatchObject({ saved: { imported: true, recovered: true } });
  expect(
    (
      await asUser(
        owner,
        `select id,version,superseded_by from public.ai_talk_creations where lineage_id='${first.id}' order by version`,
      )
    ).rows,
  ).toEqual([
    { id: first.id, version: 1, superseded_by: current.id },
    { id: current.id, version: 2, superseded_by: null },
  ]);
  expect((await derive(first.id)).receipt?.digest).toBe(first.receipt.digest);
  await expect(asUser(owner, retain(requestId, await project(), current.receipt))).rejects.toThrow(
    /different project/,
  );
  await expect(
    asUser(
      owner,
      record(requestId, projectId, {
        ...current.receipt,
        identity: { ...current.receipt.identity, boardVersion: 1 },
      }),
    ),
  ).rejects.toThrow(/authority|source unavailable/);
});

it('rejects tampered copy, material, roles, assets, identity and source records even with recomputed client digests/flags', async () => {
  const { receipt } = await save();
  const projectId = await project();
  for (const change of [
    (r: DesignDirectionReceipt) => {
      r.content.designSnapshot!.direction.demo.headline = 'Forged';
    },
    (r: DesignDirectionReceipt) => {
      r.content.designSnapshot!.direction.tokens.material = 'stone';
    },
    (r: DesignDirectionReceipt) => {
      r.content.designSnapshot!.direction.tokens.colors[1]!.hex = '#FFFFFF';
    },
    (r: DesignDirectionReceipt) => {
      r.content.designSnapshot!.direction.assets = [];
    },
    (r: DesignDirectionReceipt) => {
      r.identity.directionId = randomUUID();
      r.content.identity = r.identity;
    },
    (r: DesignDirectionReceipt) => {
      r.sourceRecords[1]!.revision = 99;
    },
    (r: DesignDirectionReceipt) => {
      r.content.compatibleTextImport = 'talk-architect-handoff/v1';
    },
  ]) {
    const forged = structuredClone(receipt);
    change(forged);
    forged.digest = designDirectionDigest(forged.content, forged.sourceRecords);
    await expect(asUser(owner, retain(randomUUID(), projectId, forged))).rejects.toThrow(
      /authority/,
    );
  }
  await expect(asUser(foreign, retain(randomUUID(), projectId, receipt))).rejects.toThrow(
    /Project unavailable/,
  );
  await expect(
    asUser(
      foreign,
      `select public.ai_talk_review_premium_direction('${conversation}','${receipt.identity.boardId}',1)`,
    ),
  ).rejects.toThrow(/unavailable/);
  const id = randomUUID();
  await asUser(owner, retain(id, projectId, receipt));
  const forged = structuredClone(receipt);
  forged.content.copy.title = 'Forged record';
  await expect(asUser(owner, record(id, projectId, forged))).rejects.toThrow(
    /authority|source unavailable/,
  );
});

it('rejects missing/unknown renderers and noncanonical nested schemas instead of downgrading them', async () => {
  for (const change of [
    (b: Record<string, unknown>) => {
      delete b.rendererVersion;
    },
    (b: Record<string, unknown>) => {
      b.rendererVersion = 'premium/v99';
    },
    (b: Record<string, unknown>) => {
      (b.directions as Array<{ tokens: Record<string, unknown> }>)[0]!.tokens.extra = 'untrusted';
    },
  ]) {
    const board = structuredClone(lifestyleLaunchBoard()) as unknown as Record<string, unknown>;
    change(board);
    const id = randomUUID();
    await asUser(
      owner,
      `select public.ai_talk_save_creation('${id}','${conversation}',null,'board',null,${literal(board)})`,
    );
    expect((await derive(id)).receipt).toBeNull();
    await expect(
      asUser(owner, `select public.ai_talk_review_premium_direction('${conversation}','${id}',1)`),
    ).rejects.toThrow(/unavailable/);
  }
  for (const invalid of [
    null,
    {},
    {
      id: 'a',
      label: 'a',
      kind: 'referenced',
      provenance: 'test',
      referenced: true,
      source: 'studio-version',
    },
  ])
    expect(
      (await db.query(`select public.ai_talk_premium_asset_valid(${literal(invalid)}) as ok`))
        .rows[0],
    ).toEqual({ ok: false });
});

it('revalidates archive/workspace and private asset revocation without deleting prior receipts', async () => {
  const versionId = randomUUID(),
    studioProject = randomUUID();
  await db.exec(`insert into public.ai_studio_projects values('${studioProject}','${owner}',null);
    insert into public.ai_studio_versions values('${versionId}','${owner}','${studioProject}','complete','synthetic-owned.png');`);
  const board = selectDesignDirection(lifestyleLaunchBoard(), 'direction-a');
  const image = board.directions[0]!.demo.image;
  image.kind = 'referenced';
  image.referenced = true;
  image.source = 'studio-version';
  image.versionId = versionId;
  const { id, receipt } = await save(board),
    projectId = await project(),
    requestId = randomUUID();
  expect((await derive(id)).receipt?.digest).toBe(receipt.digest);
  await asUser(owner, retain(requestId, projectId, receipt));
  for (const scope of ['archived_at=now()', `company_id='${randomUUID()}'`]) {
    await db.exec(`update public.ai_conversations set ${scope} where id='${conversation}'`);
    expect((await derive(id)).receipt).toBeNull();
    await expect(asUser(owner, retain(requestId, projectId, receipt))).rejects.toThrow(
      /authority|source unavailable/,
    );
    await expect(asUser(owner, record(requestId, projectId, receipt))).rejects.toThrow(
      /authority|source unavailable/,
    );
    await db.exec(
      `update public.ai_conversations set archived_at=null,company_id=null where id='${conversation}'`,
    );
  }
  await db.exec(
    `update public.ai_studio_projects set company_id='${randomUUID()}' where id='${studioProject}'`,
  );
  expect((await derive(id)).receipt).toBeNull();
  await db.exec(`update public.ai_studio_projects set company_id=null where id='${studioProject}'`);
  await db.exec(
    `update public.ai_studio_versions set status='failed',storage_key=null where id='${versionId}'`,
  );
  expect((await derive(id)).receipt).toBeNull();
  await db.exec(
    `update public.ai_studio_versions set status='complete',storage_key='synthetic-owned.png' where id='${versionId}'`,
  );
  await db.exec(
    `update public.ai_studio_versions set person_id='${foreign}' where id='${versionId}'`,
  );
  expect((await derive(id)).receipt).toBeNull();
  await db.exec(`delete from public.ai_studio_versions where id='${versionId}'`);
  expect((await derive(id)).receipt).toBeNull();
  expect(
    (
      await asUser(
        owner,
        `select verified,receipt from public.architect_design_directions where request_id='${requestId}'`,
      )
    ).rows,
  ).toEqual([{ verified: true, receipt }]);
});

it('keeps internal derivation private and refuses anonymous capability reads', async () => {
  await expect(
    asUser(
      owner,
      `select public.ai_talk_derived_design_receipt('${owner}','${conversation}','${randomUUID()}',1)`,
    ),
  ).rejects.toThrow(/permission denied/);
  await db.exec('set role anon');
  try {
    await expect(
      db.query(
        `select public.ai_talk_review_premium_direction('${conversation}','${randomUUID()}',1)`,
      ),
    ).rejects.toThrow(/permission denied/);
  } finally {
    await db.exec('reset role');
  }
});

it('matches UTF-16 bounds and rejects untrimmed or null premium source strings', async () => {
  for (const [value, min, max, expected] of [
    ['🧭', 1, 1, false],
    ['🧭', 1, 2, true],
    ['', 0, 200, true],
    ['\u00a0copy', 1, 200, false],
    [null, 0, 200, false],
  ] as const) {
    expect(
      (await db.query(`select public.ai_talk_premium_text(${literal(value)},${min},${max}) as ok`))
        .rows[0],
    ).toEqual({ ok: expected });
  }
});
