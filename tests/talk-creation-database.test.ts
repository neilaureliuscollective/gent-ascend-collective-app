import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';

const db = new PGlite();
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
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}

beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated;
 create table public.persons(id uuid primary key, auth_user_id uuid);
 insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
 grant select on public.persons to authenticated;
 create table public.ai_conversations(id uuid primary key, person_id uuid not null, title text, company_id uuid, archived_at timestamptz, unique(person_id,id));
 insert into public.ai_conversations(id,person_id,title) values('${conversation}','${owner}','Talk');
 create table public.ai_turns(id uuid primary key, person_id uuid, conversation_id uuid);
 insert into public.ai_turns values('${turn}','${owner}','${conversation}');`);
  await db.exec(await readFile('supabase/migrations/20261013240000_talk_creation.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013260000_talk_creation_candidates.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014100000_talk_design_board.sql', 'utf8'));
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
});
