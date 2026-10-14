import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { initialProject } from '@/domains/architect-origin/schema';
import { calculateEstimator, sampleEstimatorConfig } from '@/domains/architect-tools/engine';
import { sameJsonValue } from '@/domains/architect-tools/json';

const db = new PGlite();
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const project = '00000000-0000-4000-8000-000000000003';
const tool = '00000000-0000-4000-8000-000000000030';
const receipt = '00000000-0000-4000-8000-000000000031';
const invokeId = '00000000-0000-4000-8000-000000000032';
const content = initialProject('Synthetic estimator host project', 'custom');
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
  await db.exec(`create role authenticated; create role anon; create schema auth; create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated;
 create table public.persons(id uuid primary key,auth_user_id uuid); insert into public.persons values('${owner}','${owner}'),('${foreign}','${foreign}');
 grant select on public.persons to authenticated; create table public.ai_conversations(id uuid primary key,person_id uuid,title text);`);
  await db.exec(await readFile('supabase/migrations/20261012230000_architect_origin.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014080000_architect_origin_tools.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014190000_architect_origin_tool_authority.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014203000_architect_origin_tool_precision.sql', 'utf8'));
  await asUser(
    owner,
    `select public.architect_origin_save('${project}','00000000-0000-4000-8000-000000000004',0,${literal(content)},'Host project')`,
  );
});
afterAll(() => db.close());

describe('Architect tool SQL ownership and versioning (PGlite; not Supabase Auth)', () => {
  it('saves an estimator revision with exact replay and stale-edit rejection', async () => {
    const config = sampleEstimatorConfig();
    expect(
      (await asUser(
        owner,
        `select public.architect_origin_tool_save('${tool}','${project}','${receipt}',0,'Plywood estimator',${literal(config)},'First tool save') as revision`,
      )).rows,
    ).toEqual([{ revision: 1 }]);
    expect(
      (await asUser(
        owner,
        `select public.architect_origin_tool_save('${tool}','${project}','${receipt}',0,'Plywood estimator',${literal(config)},'First tool save') as revision`,
      )).rows,
    ).toEqual([{ revision: 1 }]);
    await expect(
      asUser(
        owner,
        `select public.architect_origin_tool_save('${tool}','${project}','${receipt}',0,'Forged',${literal(config)},'First tool save')`,
      ),
    ).rejects.toThrow(/Replay mismatch/);
    await expect(
      asUser(
        owner,
        `select public.architect_origin_tool_save('${tool}','${project}','00000000-0000-4000-8000-000000000033',0,'Stale',${literal(config)},'Stale create')`,
      ),
    ).rejects.toThrow(/changed|unavailable/);
  });

  it('denies foreign reads, anonymous access and unknown revisions', async () => {
    expect((await asUser(foreign, `select id from public.architect_origin_tools`)).rows).toEqual([]);
    expect((await asUser(foreign, `select id from public.architect_origin_tool_versions`)).rows).toEqual(
      [],
    );
    await expect(
      asUser(
        foreign,
        `select public.architect_origin_tool_save('00000000-0000-4000-8000-000000000034','${project}','00000000-0000-4000-8000-000000000035',0,'Foreign',${literal(sampleEstimatorConfig())},'Foreign save')`,
      ),
    ).rejects.toThrow(/unavailable/);
    await db.exec('set role anon');
    await expect(db.query(`select * from public.architect_origin_tools`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });

  it('rejects forged results and records only the authoritative calculation', async () => {
    await expect(
      asUser(
        owner,
        `select public.architect_origin_tool_record_invocation('${invokeId}','${tool}',1,${literal({ quantities: {} })},${literal({ total: '1.00' })},'architect')`,
      ),
    ).rejects.toThrow(/server-authoritative|permission denied|denied/);
    const first = await asUser(
      owner,
      `select public.architect_origin_tool_invoke('${invokeId}','${project}','${tool}',1,${literal({ quantities: {} })},'architect') as result`,
    );
    expect((first.rows[0] as { result: { total: string } }).result.total).toBe('392.15');
    const replay = await asUser(
      owner,
      `select public.architect_origin_tool_invoke('${invokeId}','${project}','${tool}',1,${literal({ quantities: {} })},'architect') as result`,
    );
    expect((replay.rows[0] as { result: { total: string } }).result.total).toBe('392.15');
    await expect(
      asUser(
        owner,
        `select public.architect_origin_tool_invoke('00000000-0000-4000-8000-000000000036','${project}','${tool}',9,${literal({ quantities: {} })},'architect')`,
      ),
    ).rejects.toThrow(/Revision unavailable/);
    const computed = await db.query(
      `select public.architect_origin_tool_calculate(${literal(sampleEstimatorConfig())},'{}'::jsonb) as result`,
    );
    expect((computed.rows[0] as { result: { total: string; lines: Array<{ line_total: string }> } }).result.total).toBe(
      '392.15',
    );
    const halfCent = {
      ...sampleEstimatorConfig(),
      waste_percent: '100',
      markup_percent: null,
      items: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          name: 'Washer',
          quantity: '0.5',
          unit: 'each',
          unit_cost: '0.01',
        },
      ],
    };
    const line = await db.query(
      `select public.architect_origin_tool_calculate(${literal(halfCent)},'{}'::jsonb) as result`,
    );
    expect((line.rows[0] as { result: { total: string; lines: Array<{ line_total: string; effective_quantity: string }> } }).result).toMatchObject({
      total: '0.01',
      lines: [expect.objectContaining({ effective_quantity: '1.0000', line_total: '0.01', waste: '0.00' })],
    });
    const fine = {
      ...sampleEstimatorConfig(),
      waste_percent: '50',
      markup_percent: null,
      items: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          name: 'Fine cut',
          quantity: '0.0001',
          unit: 'tonne',
          unit_cost: '10000',
        },
      ],
    };
    const precision = await db.query(
      `select public.architect_origin_tool_calculate(${literal(fine)},'{}'::jsonb) as result`,
    );
    const sqlFine = (precision.rows[0] as { result: unknown }).result;
    expect(sameJsonValue(sqlFine, calculateEstimator(fine))).toBe(true);
    expect((sqlFine as { total: string }).total).toBe('1.50');
    const jsSample = calculateEstimator(sampleEstimatorConfig());
    const sqlSample = (computed.rows[0] as { result: unknown }).result;
    expect(JSON.stringify(sqlSample) === JSON.stringify(jsSample)).toBe(false);
    expect(sameJsonValue(sqlSample, jsSample)).toBe(true);
    for (const currency of ['USD', 'EUR', 'GBP'] as const) {
      const priced = {
        ...sampleEstimatorConfig(),
        currency,
        waste_percent: null,
        markup_percent: null,
        items: [
          {
            id: '00000000-0000-4000-8000-000000000111',
            name: 'Sheet',
            quantity: '2',
            unit: 'sheet',
            unit_cost: '10.00',
          },
        ],
      };
      const row = await db.query(
        `select public.architect_origin_tool_calculate(${literal(priced)},'{}'::jsonb) as result`,
      );
      const sql = (row.rows[0] as { result: unknown }).result;
      expect(sameJsonValue(sql, calculateEstimator(priced))).toBe(true);
      expect((sql as { total: string }).total).toBe('20.00');
    }
    const yen = {
      ...sampleEstimatorConfig(),
      currency: 'JPY' as const,
      waste_percent: null,
      markup_percent: null,
      items: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          name: 'Bracket',
          quantity: '2',
          unit: 'each',
          unit_cost: '10',
        },
      ],
    };
    const yenRow = await db.query(
      `select public.architect_origin_tool_calculate(${literal(yen)},'{}'::jsonb) as result`,
    );
    expect(sameJsonValue((yenRow.rows[0] as { result: unknown }).result, calculateEstimator(yen))).toBe(true);
    const ceiling = {
      ...sampleEstimatorConfig(),
      waste_percent: '100',
      markup_percent: '1000',
      items: [
        {
          id: '00000000-0000-4000-8000-000000000111',
          name: 'Ceiling',
          quantity: '1000000000',
          unit: 'unit',
          unit_cost: '1000000000',
        },
      ],
    };
    const maxRow = await db.query(
      `select public.architect_origin_tool_calculate(${literal(ceiling)},'{}'::jsonb) as result`,
    );
    const sqlMax = (maxRow.rows[0] as { result: { total: string } }).result;
    expect(sqlMax.total).toBe('22000000000000000000.00');
    expect(sameJsonValue(sqlMax, calculateEstimator(ceiling))).toBe(true);
  });

  it('rejects JSON-null identity fields and invalid overrides', async () => {
    for (const field of ['kind', 'currency', 'rounding'] as const) {
      expect(
        (
          await db.query(
            `select public.architect_origin_tool_valid(${literal({ ...sampleEstimatorConfig(), [field]: null })}) as ok`,
          )
        ).rows,
      ).toEqual([{ ok: false }]);
    }
    await expect(
      db.query(
        `select public.architect_origin_tool_calculate(${literal(sampleEstimatorConfig())}, ${literal({
          [sampleEstimatorConfig().items[0]!.id]: null,
        })})`,
      ),
    ).rejects.toThrow(/Invalid invocation/);
    await expect(
      db.query(
        `select public.architect_origin_tool_calculate(${literal(sampleEstimatorConfig())}, ${literal({
          [sampleEstimatorConfig().items[0]!.id]: 12,
        })})`,
      ),
    ).rejects.toThrow(/Invalid invocation/);
    await expect(
      db.query(
        `select public.architect_origin_tool_calculate(${literal(sampleEstimatorConfig())}, ${literal({
          [sampleEstimatorConfig().items[0]!.id]: '1000000001',
        })})`,
      ),
    ).rejects.toThrow(/Invalid invocation/);
  });

  it('rejects invalid configuration at the persistence boundary', async () => {
    const invalid = {
      ...sampleEstimatorConfig(),
      items: [{ ...sampleEstimatorConfig().items[0]!, quantity: '0' }],
    };
    await expect(
      asUser(
        owner,
        `select public.architect_origin_tool_save('00000000-0000-4000-8000-000000000038','${project}','00000000-0000-4000-8000-000000000039',0,'Zero quantity',${literal(invalid)},'Invalid save')`,
      ),
    ).rejects.toThrow(/Invalid tool/);
  });

  it('keeps existing Origin project validation unchanged', async () => {
    const extra = { ...content, extra: true };
    await expect(
      asUser(
        owner,
        `select public.architect_origin_save('${project}','00000000-0000-4000-8000-000000000037',1,${literal(extra)},'Illegal extra key')`,
      ),
    ).rejects.toThrow(/Invalid project/);
  });
});
