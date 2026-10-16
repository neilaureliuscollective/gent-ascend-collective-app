import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';

const db = new PGlite({ extensions: { pgcrypto } });
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const conversation = '00000000-0000-4000-8000-000000000003';
const turn = '00000000-0000-4000-8000-000000000004';
const first = '00000000-0000-4000-8000-000000000005';
const second = '00000000-0000-4000-8000-000000000006';
const brief = {
  title: 'Reserve site',
  purpose: 'A premium brand and website.',
  audience: 'Founders',
  visualDirection: 'Obsidian and gold',
  requirements: ['Phone first'],
  unresolved: ['Typeface'],
};
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";

async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false); select set_config('request.jwt.claim.role','authenticated',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}

async function asService(sql: string) {
  await db.exec(`set role service_role; select set_config('request.jwt.claim.role','service_role',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}

beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'))$$;
 grant usage on schema public,auth to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;
 grant execute on function auth.role() to authenticated,anon,service_role;
 create extension if not exists pgcrypto;
 create table public.persons(id uuid primary key, auth_user_id uuid);
 insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
 grant select on public.persons to authenticated;
 create table public.ai_conversations(id uuid primary key, person_id uuid not null, title text, company_id uuid, archived_at timestamptz, unique(person_id,id));
 insert into public.ai_conversations(id,person_id,title) values('${conversation}','${owner}','Talk');
 create table public.ai_turns(id uuid primary key, person_id uuid, conversation_id uuid, status text default 'complete', finished_at timestamptz default now());
 insert into public.ai_turns values('${turn}','${owner}','${conversation}','complete',now());
 create table public.ai_live_sessions(id uuid primary key, person_id uuid not null, conversation_id uuid);
 create table public.architect_origin_projects(id uuid not null, person_id uuid not null, primary key(id, person_id));
 create table public.architect_design_directions(
   request_id uuid primary key, person_id uuid not null, project_id uuid not null,
   revision integer default 1, digest text not null, receipt jsonb, started boolean default false,
   source_kind text not null default 'pending', verified boolean not null default false, created_at timestamptz default now()
 );
 grant select, insert on public.ai_live_sessions, public.architect_design_directions, public.architect_origin_projects to authenticated;
 create function public.ai_talk_scoped_identity(p_seed text) returns uuid
 language plpgsql immutable set search_path=public,extensions as $$
 declare raw bytea; hex text;
 begin
  if p_seed is null or length(p_seed)=0 then raise exception 'Invalid import'; end if;
  raw := substring(digest(convert_to(p_seed,'UTF8'),'sha1') from 1 for 16);
  raw := set_byte(set_byte(raw,6,(get_byte(raw,6)&15)|80),8,(get_byte(raw,8)&63)|128);
  hex := encode(raw,'hex');
  return (substr(hex,1,8)||'-'||substr(hex,9,4)||'-'||substr(hex,13,4)||'-'||substr(hex,17,4)||'-'||substr(hex,21,12))::uuid;
 end $$;`);
  await db.exec(await readFile('supabase/migrations/20261013240000_talk_creation.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013260000_talk_creation_candidates.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014100000_talk_design_board.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014120000_talk_live_bindings.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014130000_talk_direction_transfers.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014140000_talk_live_bind_authority.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015160000_architect_apps_retain_authority.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015170000_architect_apps_retain_provenance.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015180000_talk_live_trusted_observe.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261015190000_talk_live_bind_intended_turn.sql', 'utf8'));
});
afterAll(() => db.close());

describe('Talk creation SQL versions and ownership (PGlite; not Supabase Auth)', () => {
  it('saves a first version, then a refinement, and rejects a stale predecessor', async () => {
    const save = (id: string, predecessor: string | null, title: string) =>
      `select public.ai_talk_save_creation('${id}','${conversation}','${turn}','brief',${
        predecessor ? `'${predecessor}'` : 'null'
      },${literal({ ...brief, title })}) as receipt`;
    expect((await asUser(owner, save(first, null, 'Reserve site'))).rows[0]).toMatchObject({
      receipt: { id: first, lineageId: first, version: 1 },
    });
    expect((await asUser(owner, save(second, first, 'Reserve site refined'))).rows[0]).toMatchObject({
      receipt: { id: second, lineageId: first, version: 2 },
    });
    await expect(asUser(owner, save('00000000-0000-4000-8000-000000000007', first, 'Stale'))).rejects.toThrow(
      /Stale creation version/,
    );
    expect(
      (await asUser(owner, `select id,version,superseded_by from public.ai_talk_creations order by version`))
        .rows,
    ).toEqual([
      { id: first, version: 1, superseded_by: second },
      { id: second, version: 2, superseded_by: null },
    ]);
  });

  it('denies foreign reads, anonymous access and last-write overwrite of a current version', async () => {
    expect((await asUser(foreign, `select id from public.ai_talk_creations`)).rows).toEqual([]);
    await expect(
      asUser(
        foreign,
        `select public.ai_talk_save_creation('00000000-0000-4000-8000-000000000008','${conversation}',null,'brief',null,${literal(brief)})`,
      ),
    ).rejects.toThrow(/unavailable/i);
    await db.exec('set role anon');
    await expect(db.query(`select * from public.ai_talk_creations`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
    await expect(
      asUser(owner, `update public.ai_talk_creations set content=${literal({ ...brief, title: 'Overwrite' })}`),
    ).rejects.toThrow(/permission denied/);
  });

  it('inherits the predecessor turn and returns the same receipt after a lost-response retry', async () => {
    const firstId = '00000000-0000-4000-8000-000000000021';
    const retryId = '00000000-0000-4000-8000-000000000022';
    await asUser(
      owner,
      `select public.ai_talk_save_creation('${firstId}','${conversation}','${turn}','brief',null,${literal({ ...brief, title: 'Lineage' })})`,
    );
    const refined = { ...brief, title: 'Lineage refined' };
    const first = await asUser(
      owner,
      `select public.ai_talk_save_creation('${retryId}','${conversation}',null,'brief','${firstId}',${literal(refined)}) as receipt`,
    );
    const retry = await asUser(
      owner,
      `select public.ai_talk_save_creation('${retryId}','${conversation}',null,'brief','${firstId}',${literal(refined)}) as receipt`,
    );
    expect(first.rows[0]).toMatchObject({ receipt: { id: retryId, version: 2 } });
    expect(retry.rows[0]).toMatchObject({ receipt: { id: retryId, version: 2, recovered: true } });
    expect(
      (await asUser(owner, `select source_turn_id, count(*)::int as n from public.ai_talk_creations where lineage_id='${firstId}' group by source_turn_id`))
        .rows,
    ).toEqual([{ source_turn_id: turn, n: 2 }]);
    await expect(
      asUser(
        owner,
        `select public.ai_talk_save_creation('${retryId}','${conversation}',null,'brief','${firstId}',${literal({ ...brief, title: 'Different' })})`,
      ),
    ).rejects.toThrow(/different inputs/);
  });

  it('returns the same Architect package after a lost-response retry and rejects a changed selection on that identity', async () => {
    const handoffId = '00000000-0000-4000-8000-000000000031';
    const packageContent = {
      schema: 'talk-architect-handoff/v1',
      conversationId: conversation,
      preparedAt: '2026-10-13T00:00:00.000Z',
      discipline: 'business',
      idea: 'A premium brand and website.',
      description: '',
      decisions: '',
      selections: [
        {
          kind: 'brief',
          lineageId: first,
          versionId: second,
          version: 2,
          title: 'Lineage refined',
        },
      ],
      images: [],
      imported: false,
    };
    const save = (content: unknown) =>
      `select public.ai_talk_save_creation('${handoffId}','${conversation}',null,'handoff',null,${literal(content)}) as receipt`;
    expect((await asUser(owner, save(packageContent))).rows[0]).toMatchObject({
      receipt: { id: handoffId, version: 1 },
    });
    expect((await asUser(owner, save(packageContent))).rows[0]).toMatchObject({
      receipt: { id: handoffId, version: 1, recovered: true },
    });
    expect(
      (await asUser(owner, `select count(*)::int as n from public.ai_talk_creations where kind='handoff'`))
        .rows[0],
    ).toEqual({ n: 1 });
    await expect(
      asUser(owner, save({ ...packageContent, idea: 'A different package.' })),
    ).rejects.toThrow(/different inputs/);
    await expect(
      asUser(
        owner,
        save({
          ...packageContent,
          selections: [
            {
              kind: 'brief',
              lineageId: first,
              versionId: first,
              version: 1,
              title: 'Reserve site',
            },
          ],
        }),
      ),
    ).rejects.toThrow(/different inputs/);
  });

  it('replays the original Architect receipt after the source brief is revised', async () => {
    const briefId = '00000000-0000-4000-8000-000000000051';
    const revisedId = '00000000-0000-4000-8000-000000000052';
    const handoffId = '00000000-0000-4000-8000-000000000053';
    const packageContent = {
      schema: 'talk-architect-handoff/v1',
      conversationId: conversation,
      preparedAt: '2026-10-13T00:00:01.000Z',
      discipline: 'business',
      idea: 'Replay after a later brief.',
      description: '',
      decisions: '',
      selections: [
        {
          kind: 'brief',
          lineageId: briefId,
          versionId: briefId,
          version: 1,
          title: 'Original brief',
        },
      ],
      images: [],
      imported: false,
    };
    await asUser(
      owner,
      `select public.ai_talk_save_creation('${briefId}','${conversation}','${turn}','brief',null,${literal({ ...brief, title: 'Original brief' })})`,
    );
    expect(
      (await asUser(
        owner,
        `select public.ai_talk_save_creation('${handoffId}','${conversation}',null,'handoff',null,${literal(packageContent)}) as receipt`,
      )).rows[0],
    ).toMatchObject({ receipt: { id: handoffId, version: 1 } });
    await asUser(
      owner,
      `select public.ai_talk_save_creation('${revisedId}','${conversation}','${turn}','brief','${briefId}',${literal({ ...brief, title: 'Revised brief' })})`,
    );
    expect(
      (await asUser(
        owner,
        `select public.ai_talk_save_creation('${handoffId}','${conversation}',null,'handoff',null,${literal(packageContent)}) as receipt`,
      )).rows[0],
    ).toMatchObject({ receipt: { id: handoffId, version: 1, recovered: true } });
    expect(
      (
        await asUser(
          owner,
          `select count(*)::int as n from public.ai_talk_creations where id='${handoffId}'`,
        )
      ).rows[0],
    ).toEqual({ n: 1 });
    await expect(
      asUser(
        foreign,
        `select public.ai_talk_save_creation('${handoffId}','${conversation}',null,'handoff',null,${literal(packageContent)})`,
      ),
    ).rejects.toThrow(/unavailable|different inputs|Unauthorized/i);
  });
});

describe('Talk studio entitlement (PGlite; not Supabase Auth)', () => {
  beforeAll(async () => {
    await db.exec(`
      create table if not exists public.founder_access(person_id uuid primary key);
      create table if not exists public.membership_accounts(
        person_id uuid primary key, tier text, billing_state text, beta_access boolean,
        trial_ends_at timestamptz, access_until timestamptz
      );
      insert into public.membership_accounts values
        ('${owner}','free','none',false,null,null),
        ('${foreign}','signature','active',false,null,now()+interval '30 days')
      on conflict do nothing;
    `);
    const entitlementSql = await readFile(
      'supabase/migrations/20261013250000_talk_image_entitlement.sql',
      'utf8',
    );
    const entitled = entitlementSql.match(
      /create function public\.talk_studio_entitled[\s\S]*?\$\$;/,
    );
    if (!entitled) throw new Error('talk_studio_entitled missing from Talk image entitlement SQL');
    await db.exec(entitled[0].replace('create function', 'create or replace function'));
  });

  it('grants paid Studio tiers and founder/beta, and denies a free account', async () => {
    expect((await db.query(`select public.talk_studio_entitled('${owner}') as ok`)).rows[0]).toEqual({
      ok: false,
    });
    expect((await db.query(`select public.talk_studio_entitled('${foreign}') as ok`)).rows[0]).toEqual({
      ok: true,
    });
    await db.exec(`insert into public.founder_access(person_id) values('${owner}')`);
    expect((await db.query(`select public.talk_studio_entitled('${owner}') as ok`)).rows[0]).toEqual({
      ok: true,
    });
  });
});

describe('Talk stale proposal candidates (PGlite; not Supabase Auth)', () => {
  const candidate = '00000000-0000-4000-8000-000000000041';
  const applied = '00000000-0000-4000-8000-000000000042';

  it('keeps a stale proposal without superseding the current version, and isolates it from another owner', async () => {
    const refined = { ...brief, title: 'Manual edit v2' };
    const proposal = { ...brief, title: 'Generated proposal' };
    const selectedBefore = (
      await asUser(owner, `select creation_id from public.ai_talk_selection where kind='brief'`)
    ).rows;
    await asUser(
      owner,
      `select public.ai_talk_save_candidate('${candidate}','${conversation}','${turn}','brief','${second}',${literal(proposal)})`,
    );
    const retry = await asUser(
      owner,
      `select public.ai_talk_save_candidate('${candidate}','${conversation}','${turn}','brief','${second}',${literal(proposal)}) as receipt`,
    );
    expect(retry.rows[0]).toMatchObject({ receipt: { id: candidate, recovered: true, candidate: true } });
    expect(
      (await asUser(
        owner,
        `select id,version,candidate,superseded_by from public.ai_talk_creations where lineage_id='${first}' order by version`,
      )).rows,
    ).toEqual([
      { id: first, version: 1, candidate: false, superseded_by: second },
      { id: second, version: 2, candidate: false, superseded_by: null },
      { id: candidate, version: 3, candidate: true, superseded_by: null },
    ]);
    const selectedAfter = (
      await asUser(owner, `select creation_id from public.ai_talk_selection where kind='brief'`)
    ).rows;
    expect(selectedAfter).toEqual(selectedBefore);
    expect(selectedAfter.some((row) => (row as { creation_id: string }).creation_id === candidate)).toBe(
      false,
    );
    expect((await asUser(foreign, `select id from public.ai_talk_creations where id='${candidate}'`)).rows).toEqual(
      [],
    );
    await expect(
      asUser(
        owner,
        `select public.ai_talk_select_creation('${conversation}','${candidate}')`,
      ),
    ).rejects.toThrow(/unavailable/i);
    await expect(
      asUser(
        owner,
        `select public.ai_talk_save_candidate('${candidate}','${conversation}','${turn}','brief','${second}',${literal(refined)})`,
      ),
    ).rejects.toThrow(/different inputs/);
    expect(
      (await asUser(
        owner,
        `select public.ai_talk_save_creation('${applied}','${conversation}','${turn}','brief','${second}',${literal(proposal)}) as receipt`,
      )).rows[0],
    ).toMatchObject({ receipt: { id: applied, version: 4 } });
    await expect(
      asUser(
        owner,
        `select public.ai_talk_save_candidate('00000000-0000-4000-8000-000000000043','${conversation}','${turn}','brief','00000000-0000-4000-8000-000000000099',${literal(proposal)})`,
      ),
    ).rejects.toThrow(/unavailable/i);
  });
});

describe('Talk design-board SQL versions (PGlite; not Supabase Auth)', () => {
  it('saves a board, selects B, then a warmer revision without losing A or C', async () => {
    const { legacyReserveBoard, refineSelectedDirection } = await import(
      '@/domains/talk-creation/design-board'
    );
    const firstId = '00000000-0000-4000-8000-000000000061';
    const secondId = '00000000-0000-4000-8000-000000000062';
    const board = legacyReserveBoard();
    const warmer = refineSelectedDirection(board, { warmer: true });
    await asUser(
      owner,
      `select public.ai_talk_save_creation('${firstId}','${conversation}',null,'board',null,${literal(board)})`,
    );
    await asUser(
      owner,
      `select public.ai_talk_save_creation('${secondId}','${conversation}',null,'board','${firstId}',${literal(warmer)})`,
    );
    const current = (
      await asUser(
        owner,
        `select id, version, superseded_by, content->>'selectedDirectionId' as selected from public.ai_talk_creations where id='${secondId}'`,
      )
    ).rows[0] as { version: number; selected: string };
    expect(current.version).toBe(2);
    expect(current.selected).toBe('direction-b');
    const prior = (
      await asUser(owner, `select superseded_by from public.ai_talk_creations where id='${firstId}'`)
    ).rows[0] as { superseded_by: string };
    expect(prior.superseded_by).toBe(secondId);
    const directions = (
      await asUser(
        owner,
        `select jsonb_array_length(content->'directions') as count from public.ai_talk_creations where id='${secondId}'`,
      )
    ).rows[0] as { count: number };
    expect(Number(directions.count)).toBe(3);
  });

  it('selects C, records one direction transfer receipt, and denies another owner', async () => {
    const { legacyReserveBoard, selectDesignDirection } = await import(
      '@/domains/talk-creation/design-board'
    );
    const { produceArchitectDirection } = await import('@/domains/talk-creation/architect-direction');
    await db.exec(`delete from public.ai_talk_creations where person_id='${owner}'`);
    const boardId = '00000000-0000-4000-8000-000000000071';
    const requestId = '00000000-0000-4000-8000-000000000072';
    const projectId = '00000000-0000-4000-8000-000000000073';
    const board = selectDesignDirection(legacyReserveBoard(), 'direction-c');
    const authorized = produceArchitectDirection({
      conversationId: conversation,
      boardId,
      version: 1,
      board,
    });
    const directionUuid = authorized.identity.directionId;
    const digest = authorized.digest;
    const receipt = authorized;
    await asUser(
      owner,
      `select public.ai_talk_save_creation('${boardId}','${conversation}',null,'board',null,${literal(board)})`,
    );
    const selected = (
      await asUser(
        owner,
        `select content->>'selectedDirectionId' as selected from public.ai_talk_creations where id='${boardId}'`,
      )
    ).rows[0] as { selected: string };
    expect(selected.selected).toBe('direction-c');
    const derived = (
      await db.query(
        `select public.ai_talk_derived_design_receipt('${owner}','${conversation}','${boardId}',1) as receipt`,
      )
    ).rows[0] as { receipt: { digest: string; identity: { directionId: string } } };
    expect(derived.receipt.digest).toBe(digest);
    expect(derived.receipt.identity.directionId).toBe(directionUuid);
    await db.exec(`insert into public.architect_origin_projects(id,person_id) values('${projectId}','${owner}')`);
    await asUser(
      owner,
      `select public.architect_apps_retain_design('${requestId}','${projectId}','${digest}',${literal(receipt)},'talk-authorized',false)`,
    );
    const retained = (
      await asUser(
        owner,
        `select verified, source_kind, digest from public.architect_design_directions where request_id='${requestId}'`,
      )
    ).rows[0] as { verified: boolean; source_kind: string; digest: string };
    expect(retained).toMatchObject({ verified: true, source_kind: 'talk-authorized', digest });
    await expect(
      asUser(owner, `insert into public.ai_talk_direction_transfers(id,person_id,conversation_id,board_id,board_version,direction_id,direction_uuid,project_id,digest,receipt,imported)
        values('${crypto.randomUUID()}','${owner}','${conversation}','${boardId}',1,'direction-c','${directionUuid}','${projectId}','${digest}',${literal(receipt)},true)`),
    ).rejects.toThrow();
    const first = await asUser(
      owner,
      `select public.ai_talk_record_direction_transfer('${requestId}','${conversation}','${boardId}',1,'direction-c','${directionUuid}','${projectId}','${digest}',${literal(receipt)}) as receipt`,
    );
    const retry = await asUser(
      owner,
      `select public.ai_talk_record_direction_transfer('${requestId}','${conversation}','${boardId}',1,'direction-c','${directionUuid}','${projectId}','${digest}',${literal(receipt)}) as receipt`,
    );
    expect(first.rows[0]).toMatchObject({ receipt: { imported: true, projectId } });
    expect(retry.rows[0]).toMatchObject({ receipt: { imported: true, recovered: true, projectId } });
    await expect(
      asUser(
        owner,
        `select public.ai_talk_record_direction_transfer('${crypto.randomUUID()}','${conversation}','${boardId}',1,'direction-c','${directionUuid}','${crypto.randomUUID()}','${digest}',${literal(receipt)})`,
      ),
    ).rejects.toThrow(/acknowledgment missing/i);
    expect(
      (await asUser(owner, `select count(*)::int as n from public.ai_talk_direction_transfers`)).rows[0],
    ).toEqual({ n: 1 });
    expect(
      (await asUser(foreign, `select id from public.ai_talk_direction_transfers`)).rows,
    ).toEqual([]);
    await expect(
      asUser(
        foreign,
        `select public.ai_talk_record_direction_transfer('${requestId}','${conversation}','${boardId}',1,'direction-c','${directionUuid}','${projectId}','${digest}',${literal(receipt)})`,
      ),
    ).rejects.toThrow(/unavailable/i);
    const forgedVersion = '00000000-0000-4000-8000-000000000075';
    await asUser(
      owner,
      `select public.architect_apps_retain_design('${forgedVersion}','${projectId}','${digest}',${literal({
        ...receipt,
        identity: { ...receipt.identity, boardVersion: 99 },
        content: { ...receipt.content, identity: { ...receipt.content.identity, boardVersion: 99 } },
      })},'talk-authorized',true)`,
    );
    const forgedVersionRow = (
      await asUser(
        owner,
        `select verified, source_kind from public.architect_design_directions where request_id='${forgedVersion}'`,
      )
    ).rows[0] as { verified: boolean; source_kind: string };
    expect(forgedVersionRow).toMatchObject({ verified: false, source_kind: 'pending' });
    const forgedCases = [
      {
        id: '00000000-0000-4000-8000-000000000076',
        digest,
        receipt: {
          ...receipt,
          identity: { ...receipt.identity, directionId: '00000000-0000-4000-8000-000000000079' },
          content: {
            ...receipt.content,
            identity: { ...receipt.content.identity, directionId: '00000000-0000-4000-8000-000000000079' },
          },
        },
      },
      {
        id: '00000000-0000-4000-8000-000000000077',
        digest,
        receipt: { ...receipt, content: { ...receipt.content, name: 'Forged Chamber' } },
      },
      {
        id: '00000000-0000-4000-8000-000000000078',
        digest: 'c'.repeat(64),
        receipt: { ...receipt, digest: 'c'.repeat(64) },
      },
    ];
    for (const forged of forgedCases) {
      await asUser(
        owner,
        `select public.architect_apps_retain_design('${forged.id}','${projectId}','${forged.digest}',${literal(forged.receipt)},'talk-authorized',true)`,
      );
      const forgedRow = (
        await asUser(
          owner,
          `select verified, source_kind from public.architect_design_directions where request_id='${forged.id}'`,
        )
      ).rows[0] as { verified: boolean; source_kind: string };
      expect(forgedRow).toMatchObject({ verified: false, source_kind: 'pending' });
      await expect(
        asUser(
          owner,
          `select public.ai_talk_record_direction_transfer('${forged.id}','${conversation}','${boardId}',1,'direction-c','${directionUuid}','${projectId}','${forged.digest}',${literal(forged.receipt)})`,
        ),
      ).rejects.toThrow(/acknowledgment missing/i);
    }
    await expect(
      asUser(
        owner,
        `select public.ai_talk_record_direction_transfer('${forgedVersion}','${conversation}','${boardId}',1,'direction-c','${directionUuid}','${projectId}','${digest}',${literal(receipt)})`,
      ),
    ).rejects.toThrow(/acknowledgment missing/i);
  });
});

describe('Live turn bindings (PGlite; not Supabase Auth)', () => {
  it('maps distinct provider items to durable turns, including repeated text', async () => {
    const session = '00000000-0000-4000-8000-000000000081';
    const turnA = '00000000-0000-4000-8000-000000000082';
    const turnB = '00000000-0000-4000-8000-000000000083';
    await db.exec(
      `insert into public.ai_turns values('${turnA}','${owner}','${conversation}','complete',now()),('${turnB}','${owner}','${conversation}','complete',now());
       insert into public.ai_live_sessions(id,person_id,conversation_id) values('${session}','${owner}','${conversation}')`,
    );
    await expect(
      asUser(
        owner,
        `select public.ai_live_observe_item('${session}','${conversation}','item-same','resp-1')`,
      ),
    ).rejects.toThrow();
    await expect(
      asUser(
        owner,
        `select public.ai_live_bind_turn('${session}','${conversation}','item-same','resp-1','${turnA}')`,
      ),
    ).rejects.toThrow();
    await expect(
      asUser(owner, `insert into public.ai_live_turn_bindings(person_id,conversation_id,session_id,provider_item_id,turn_id)
        values('${owner}','${conversation}','${session}','forged','${turnA}')`),
    ).rejects.toThrow();
    await expect(
      asUser(
        owner,
        `select public.ai_live_bind_finished_turn('${crypto.randomUUID()}','${conversation}','item-same','resp-1','${turnA}')`,
      ),
    ).rejects.toThrow(/unavailable/i);
    const pendingTurn = '00000000-0000-4000-8000-000000000086';
    await db.exec(
      `insert into public.ai_turns values('${pendingTurn}','${owner}','${conversation}','pending',null)`,
    );
    await expect(
      asUser(
        owner,
        `select public.ai_live_bind_finished_turn('${session}','${conversation}','item-same','resp-1','${pendingTurn}')`,
      ),
    ).rejects.toThrow(/unavailable/i);
    const otherConversation = '00000000-0000-4000-8000-000000000084';
    const wrongTurn = '00000000-0000-4000-8000-000000000085';
    await db.exec(
      `insert into public.ai_conversations(id,person_id,title) values('${otherConversation}','${owner}','Other');
       insert into public.ai_turns values('${wrongTurn}','${owner}','${otherConversation}','complete',now())`,
    );
    await expect(
      asUser(
        owner,
        `select public.ai_live_bind_finished_turn('${session}','${conversation}','item-same','resp-1','${wrongTurn}')`,
      ),
    ).rejects.toThrow(/unavailable/i);
    await expect(
      asUser(
        owner,
        `select public.ai_live_observe_trusted_item('${session}','${conversation}','item-same','resp-1','${turnA}')`,
      ),
    ).rejects.toThrow(/Trusted voice observation required|permission denied/i);
    await expect(
      asUser(
        owner,
        `select public.ai_live_bind_finished_turn('${session}','${conversation}','spoken-1','resp-1','${turnA}')`,
      ),
    ).rejects.toThrow(/unavailable/i);
    await asService(
      `select public.ai_live_observe_trusted_item('${session}','${conversation}','item-same','resp-1','${turnA}')`,
    );
    await asService(
      `select public.ai_live_observe_trusted_item('${session}','${conversation}','item-same-again','resp-2','${turnB}')`,
    );
    await expect(
      asUser(
        owner,
        `select public.ai_live_bind_finished_turn('${session}','${conversation}','item-same','resp-1','${turnB}')`,
      ),
    ).rejects.toThrow(/unavailable/i);
    await expect(
      asUser(
        owner,
        `select public.ai_live_bind_finished_turn('${session}','${conversation}','item-same','resp-2','${turnA}')`,
      ),
    ).rejects.toThrow(/unavailable/i);
    await asUser(
      owner,
      `select public.ai_live_bind_finished_turn('${session}','${conversation}','item-same','resp-1','${turnA}')`,
    );
    await asUser(
      owner,
      `select public.ai_live_bind_finished_turn('${session}','${conversation}','item-same-again','resp-2','${turnB}')`,
    );
    await expect(
      asUser(
        owner,
        `select public.ai_live_bind_finished_turn('${session}','${conversation}','item-same','resp-1','${turnB}')`,
      ),
    ).rejects.toThrow(/Binding request reused with different inputs|unavailable/i);
    const replay = await asUser(
      owner,
      `select public.ai_live_bind_finished_turn('${session}','${conversation}','item-same','resp-1','${turnA}') as receipt`,
    );
    expect(replay.rows[0]).toMatchObject({ receipt: { turnId: turnA, recovered: true } });
    const bindings = (
      await asUser(owner, `select public.ai_live_read_bindings('${session}','${conversation}') as rows`)
    ).rows[0] as { rows: Array<{ providerItemId: string; turnId: string }> };
    expect(bindings.rows).toHaveLength(2);
    expect(bindings.rows.map((item) => item.turnId).sort()).toEqual([turnA, turnB].sort());
    expect((await asUser(foreign, `select public.ai_live_read_bindings('${session}','${conversation}') as rows`)).rows[0]).toEqual(
      { rows: [] },
    );
  });
});

it('keeps premium transfer blocked until database authority derives the complete snapshot', async () => {
  const { lifestyleLaunchBoard, premiumDirectionTransferBlocker } = await import('@/domains/talk-creation/design-board');
  const { produceArchitectDirection } = await import('@/domains/talk-creation/architect-direction');
  const boardId = '00000000-0000-4000-8000-000000000091';
  const projectId = '00000000-0000-4000-8000-000000000092';
  const requestId = '00000000-0000-4000-8000-000000000093';
  const board = lifestyleLaunchBoard();
  const receipt = produceArchitectDirection({ conversationId: conversation, boardId, version: 1, board });
  expect(premiumDirectionTransferBlocker(board)).toMatch(/not available yet/);
  await asUser(owner, `select public.ai_talk_save_creation('${boardId}','${conversation}',null,'board',null,${literal(board)})`);
  const derived = (await db.query(`select public.ai_talk_derived_design_receipt('${owner}','${conversation}','${boardId}',1) as receipt`)).rows[0] as { receipt: { digest: string; content: unknown } };
  expect(derived.receipt.digest).not.toBe(receipt.digest);
  expect(derived.receipt.content).not.toHaveProperty('designSnapshot');
  await db.exec(`insert into public.architect_origin_projects(id,person_id) values('${projectId}','${owner}')`);
  await asUser(owner, `select public.architect_apps_retain_design('${requestId}','${projectId}','${receipt.digest}',${literal(receipt)},'talk-authorized',true)`);
  const retained = (await asUser(owner, `select verified from public.architect_design_directions where request_id='${requestId}'`)).rows[0] as { verified: boolean };
  expect(retained.verified).toBe(false);
  await expect(asUser(owner, `select public.ai_talk_record_direction_transfer('${requestId}','${conversation}','${boardId}',1,'direction-b','${receipt.identity.directionId}','${projectId}','${receipt.digest}',${literal(receipt)})`)).rejects.toThrow(/acknowledgment missing/i);
});
