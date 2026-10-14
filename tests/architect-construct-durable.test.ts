import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { initialProject } from '@/domains/architect-origin/schema';
import { fixtureScope, importedFixtureSource } from '@/domains/architect-construct/fixture';
import { DatabaseConstructStore, type ConstructPersistenceClient } from '@/domains/architect-construct/database-store';
import { processConstructOnce } from '@/domains/architect-construct/worker';
import { memoryConstructStoreAllowed } from '@/domains/architect-construct/database-store';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const project = '00000000-0000-4000-8000-000000000003';
const request = '00000000-0000-4000-8000-000000000054';
const content = initialProject('Synthetic durable construct', 'application');
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";
const quote = (value: string | null | undefined) =>
  value == null ? 'null' : "'" + String(value).replace(/'/g, "''") + "'";

function rpcSql(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'architect_construct_import_source':
      return `select public.architect_construct_import_source(${quote(String(args.p_id))},${quote(String(args.p_kind))},${quote(args.p_repository as string | null)},${quote(args.p_commit as string | null)},${quote(String(args.p_label))},${quote(String(args.p_tree))},${literal(args.p_files)}) as value`;
    case 'architect_construct_approve_brief':
      return `select public.architect_construct_approve_brief(${quote(String(args.p_id))},${quote(String(args.p_project))},${Number(args.p_expected)},${quote(String(args.p_source))},${quote(String(args.p_hash))},${literal(args.p_scope)}) as value`;
    case 'architect_construct_start':
      return `select public.architect_construct_start(${quote(String(args.p_project))},${quote(String(args.p_request))},${quote(String(args.p_brief))},${Number(args.p_expected)}) as value`;
    case 'architect_construct_cancel':
      return `select public.architect_construct_cancel(${quote(String(args.p_project))},${quote(String(args.p_run))}) as value`;
    case 'architect_construct_invalidate_briefs':
      return `select public.architect_construct_invalidate_briefs(${quote(String(args.p_project))},${quote(String(args.p_reason))}) as value`;
    case 'architect_construct_claim':
      return `select public.architect_construct_claim(${quote(String(args.p_worker))},${Number(args.p_lease)}) as value`;
    case 'architect_construct_finish':
      return `select public.architect_construct_finish(${quote(String(args.p_worker))},${quote(String(args.p_run))},${quote(String(args.p_token))},${quote(String(args.p_status))},${literal(args.p_result)}) as value`;
    case 'architect_construct_timeout':
      return `select public.architect_construct_timeout() as value`;
    case 'architect_construct_heartbeat':
      return `select public.architect_construct_heartbeat(${quote(String(args.p_worker))},${quote(String(args.p_run))},${quote(String(args.p_token))},${Number(args.p_lease)}) as value`;
    case 'architect_construct_mark_running':
      return `select public.architect_construct_mark_running(${quote(String(args.p_worker))},${quote(String(args.p_run))},${quote(String(args.p_token))}) as value`;
    case 'architect_construct_append_event':
      return `select public.architect_construct_append_event(${quote(String(args.p_worker))},${quote(String(args.p_run))},${quote(String(args.p_token))},${quote(String(args.p_kind))},${quote(String(args.p_detail))}) as value`;
    default:
      throw new Error(`Unknown RPC ${name}`);
  }
}

class PgliteQuery {
  private filters: Array<[string, unknown]> = [];
  private sort: [string, boolean] | null = null;
  private take: number | null = null;
  constructor(
    private readonly db: PGlite,
    private readonly table: string,
    private readonly mode: 'owner' | 'worker',
    private readonly authUserId: string,
  ) {}
  select(columns: string) {
    void columns;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order(column: string, options?: { ascending?: boolean }) {
    this.sort = [column, options?.ascending !== false];
    return this;
  }
  limit(count: number) {
    this.take = count;
    return this;
  }
  async maybeSingle() {
    const rows = await this.rows();
    return { data: rows[0] ?? null, error: null };
  }
  then<TResult1 = { data: unknown; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: unknown; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return this.rows()
      .then((data) => ({ data, error: null as null }))
      .then(onfulfilled, onrejected);
  }
  private async rows() {
    if (this.mode === 'owner')
      await this.db.exec(
        `set role authenticated; select set_config('request.jwt.claim.sub','${this.authUserId}',false)`,
      );
    try {
      const where = this.filters
        .map(([column, value]) => `${column}=${typeof value === 'number' ? value : quote(String(value))}`)
        .join(' and ');
      const order = this.sort ? ` order by ${this.sort[0]} ${this.sort[1] ? 'asc' : 'desc'}` : '';
      const limit = this.take ? ` limit ${this.take}` : '';
      const sql = `select * from public.${this.table}${where ? ` where ${where}` : ''}${order}${limit}`;
      return (await this.db.query(sql)).rows as unknown[];
    } finally {
      if (this.mode === 'owner') await this.db.exec('reset role');
    }
  }
}

function pgliteClient(mode: 'owner' | 'worker', authUserId = owner): ConstructPersistenceClient {
  return {
    rpc: async (name: string, args: Record<string, unknown> = {}) => {
      if (mode === 'worker') await db.exec(`select set_config('architect.construct_worker','1',false)`);
      else
        await db.exec(
          `set role authenticated; select set_config('request.jwt.claim.sub','${authUserId}',false)`,
        );
      try {
        const result = await db.query(rpcSql(name, args ?? {}));
        const row = result.rows[0] as Record<string, unknown> | undefined;
        return { data: row ? row.value : null, error: null };
      } catch (error) {
        return { data: null, error: { message: error instanceof Error ? error.message : 'rpc failed' } };
      } finally {
        if (mode === 'owner') await db.exec('reset role');
        if (mode === 'worker') await db.exec(`select set_config('architect.construct_worker','',false)`);
      }
    },
    from(table: string) {
      return new PgliteQuery(db, table, mode, authUserId);
    },
  } as unknown as ConstructPersistenceClient;
}

beforeAll(async () => {
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''), current_user)$$;
grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid(),auth.role() to authenticated,anon;
create table public.persons(id uuid primary key,auth_user_id uuid); insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
grant select on public.persons to authenticated; create table public.ai_conversations(id uuid primary key,person_id uuid,title text);`);
  await db.exec(await readFile('supabase/migrations/20261012230000_architect_origin.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013160000_architect_construct.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013180000_architect_construct_worker_plane.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013193000_architect_construct_isolation.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013220000_architect_construct_lease_freshness.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013230000_architect_construct_finish_event.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014220000_architect_construct_repair.sql', 'utf8'));
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${owner}',false); select public.architect_origin_save('${project}','${request}',0,${literal({ ...content, name: 'Synthetic durable construct' })},'Synthetic durable'); reset role;`,
  );
});
afterAll(() => db.close());

describe('Durable Construct store and separate worker plane (PGlite; not hosted Auth)', () => {
  it('does not treat the labelled memory store as the live default', () => {
    expect(memoryConstructStoreAllowed({ ARCHITECT_CONSTRUCT_STORE: 'memory', NODE_ENV: 'test' })).toBe(true);
    expect(memoryConstructStoreAllowed({ NODE_ENV: 'test' })).toBe(false);
    expect(
      memoryConstructStoreAllowed({
        ARCHITECT_CONSTRUCT_STORE: 'memory',
        APP_ENV: 'production',
        NODE_ENV: 'production',
        NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'publishable-key-value',
      }),
    ).toBe(false);
  });

  it('queues one owner request and lets only one worker claim and persist the fixture receipt', async () => {
    const ownerStore = new DatabaseConstructStore(pgliteClient('owner'), 'owner');
    const workerA = new DatabaseConstructStore(pgliteClient('worker'), 'worker');
    const workerB = new DatabaseConstructStore(pgliteClient('worker'), 'worker');
    const source = importedFixtureSource(owner, request);
    await expect(
      ownerStore.importSource({ ...source, id: '00000000-0000-4000-8000-000000000055', kind: 'fixture' }),
    ).rejects.toThrow(/Invalid source/i);
    await ownerStore.importSource(source);
    const brief = await ownerStore.approveBrief(
      owner,
      request,
      fixtureScope({
        projectId: project,
        projectRevision: 1,
        sourceId: source.id,
        sourceTreeHash: source.tree_hash,
      }),
    );
    const queued = await ownerStore.startRun({
      personId: owner,
      projectId: project,
      briefId: brief.id,
      requestId: request,
      expected: 1,
      sourceKind: source.kind,
      sourceTreeHash: source.tree_hash,
      approvalHash: brief.approval_hash,
      sourceId: source.id,
    });
    expect(queued.status).toBe('queued');
    const executed = await processConstructOnce(workerA, 'worker-a', new Date(), {
      probe: async () => ({
        available: false,
        backend: 'unavailable',
        code: 'not-installed',
        reason: 'PGlite unit test does not start Docker. Isolated execution is blocked.',
      }),
    });
    expect(executed?.status).toBe('blocked');
    expect(executed?.result?.sandbox).toBe(false);
    expect(executed?.result?.isolation).toBe('unavailable');
    expect(executed?.result?.blocker).toMatch(/does not start Docker|blocked/i);
    expect(await processConstructOnce(workerB, 'worker-b')).toBeNull();
    const reloaded = new DatabaseConstructStore(pgliteClient('owner'), 'owner');
    const recovered = await reloaded.readRun(owner, request);
    expect(recovered?.result?.diff).toBe(executed?.result?.diff);
    expect(recovered?.status).toBe('blocked');
    const events = await reloaded.listEvents(owner, request);
    expect(events.map((event) => event.kind)).toEqual(
      expect.arrayContaining(['queued', 'claimed', 'started', 'blocked']),
    );
    const foreignStore = new DatabaseConstructStore(pgliteClient('owner', foreign), 'owner');
    expect(await foreignStore.readRun(foreign, request)).toBeNull();
    await expect(foreignStore.cancelRun(foreign, request)).rejects.toThrow(/unavailable|not/i);
  });
});
