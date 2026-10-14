import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';
import { initialProject, projectContentSchema } from '@/domains/architect-origin/schema';
import {
  boundText,
  describeHandoffTransfer,
  originImportNote,
  projectFromResolvedHandoff,
  uniqueKindSelectionMessage,
  utf16Length,
  type ResolvedArchitectPackage,
} from '@/domains/talk-creation/origin-import';
import { originProjectIdentity, originSaveIdentity } from '@/domains/talk-creation/persist';

const db = new PGlite({ extensions: { pgcrypto } });
const owner = '00000000-0000-4000-8000-000000000001';
const foreign = '00000000-0000-4000-8000-000000000002';
const conversation = '00000000-0000-4000-8000-000000000003';
const briefId = '00000000-0000-4000-8000-000000000005';
const planId = '00000000-0000-4000-8000-000000000006';
const paletteId = '00000000-0000-4000-8000-000000000015';
const handoffId = '00000000-0000-4000-8000-000000000007';
const importId = '00000000-0000-4000-8000-000000000008';
const wrongHandoff = '00000000-0000-4000-8000-000000000017';
const wrongBrief = '00000000-0000-4000-8000-000000000018';
const wrongImport = '00000000-0000-4000-8000-000000000019';
const rollbackHandoff = '00000000-0000-4000-8000-00000000001a';
const rollbackBrief = '00000000-0000-4000-8000-00000000001b';
const rollbackImport = '00000000-0000-4000-8000-00000000001c';
const imageId = '00000000-0000-4000-8000-00000000001d';
const imageVersion = '00000000-0000-4000-8000-00000000001e';
const studioProject = '00000000-0000-4000-8000-00000000001f';
const projectId = originProjectIdentity(owner, handoffId);
const saveId = originSaveIdentity(owner, handoffId);
const brief = {
  title: 'Reserve site',
  purpose: 'A premium brand and website.',
  audience: 'Founders',
  visualDirection: 'Obsidian and gold',
  requirements: ['Phone first'],
  unresolved: ['Typeface'],
};
const plan = {
  title: 'Launch plan',
  summary: 'Ship the reserve site.',
  steps: [{ id: 'review', title: 'Review', detail: 'Confirm the brief.', dependsOn: [] }],
};
const palette = {
  title: 'Imperial palette',
  notes: 'Exact hex roles.',
  swatches: [
    { hex: '#080D0D', name: 'Obsidian', role: 'background' as const },
    { hex: '#C4912F', name: 'Reserve Gold', role: 'accent' as const },
  ],
  contrast: [
    { foreground: '#C4912F', background: '#080D0D', ratio: 7, pair: 'Gold on obsidian', passesAa: true },
  ],
};
const handoff = {
  schema: 'talk-architect-handoff/v1' as const,
  conversationId: conversation,
  preparedAt: '2026-10-14T00:00:00.000Z',
  discipline: 'business' as const,
  idea: 'A premium brand and website.',
  description: '',
  decisions: 'Keep emerald restrained.',
  selections: [
    { kind: 'brief' as const, lineageId: briefId, versionId: briefId, version: 1, title: 'Reserve site' },
    { kind: 'plan' as const, lineageId: planId, versionId: planId, version: 1, title: 'Launch plan' },
    { kind: 'palette' as const, lineageId: paletteId, versionId: paletteId, version: 1, title: 'Imperial palette' },
  ],
  images: [
    { artifactId: imageId, versionId: imageVersion, projectId: studioProject, prompt: 'Crest on obsidian' },
  ],
  imported: false,
};
const briefOnly = {
  ...handoff,
  selections: [
    { kind: 'brief' as const, lineageId: briefId, versionId: briefId, version: 1, title: 'Reserve site' },
  ],
  images: [] as typeof handoff.images,
};
const literal = (value: unknown) => "'" + JSON.stringify(value).replace(/'/g, "''") + "'::jsonb";

function resolvedPackage(): ResolvedArchitectPackage {
  return {
    handoff,
    sourceTurnId: null,
    brief,
    plan,
    palette,
    selections: [
      { kind: 'brief', lineageId: briefId, versionId: briefId, version: 1, title: 'Reserve site', content: brief },
      { kind: 'plan', lineageId: planId, versionId: planId, version: 1, title: 'Launch plan', content: plan },
      {
        kind: 'palette',
        lineageId: paletteId,
        versionId: paletteId,
        version: 1,
        title: 'Imperial palette',
        content: palette,
      },
    ],
    images: [{ artifactId: imageId, versionId: imageVersion, projectId: studioProject, prompt: 'Crest on obsidian' }],
  };
}

async function asUser(id: string, sql: string) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${id}',false)`);
  try {
    return await db.query(sql);
  } finally {
    await db.exec('reset role');
  }
}

async function saveCreation(id: string, kind: string, content: unknown, predecessor: string | null = null) {
  return asUser(
    owner,
    `select public.ai_talk_save_creation('${id}','${conversation}',null,'${kind}',${
      predecessor ? `'${predecessor}'` : 'null'
    },${literal(content)}) as receipt`,
  );
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
 create table public.ai_turns(id uuid primary key, person_id uuid, conversation_id uuid);`);
  await db.exec(await readFile('supabase/migrations/20261012230000_architect_origin.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013240000_talk_creation.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261013260000_talk_creation_candidates.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014010000_talk_origin_import.sql', 'utf8'));
  await db.exec('create extension if not exists pgcrypto');
  await db.exec(await readFile('supabase/migrations/20261014020000_talk_origin_import_bind.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014030000_talk_origin_import_atomic.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014040000_talk_origin_import_consistency.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/20261014100000_talk_design_board.sql', 'utf8'));
  await db.exec(`
    create function public.talk_import_fail_receipt() returns trigger
    language plpgsql as $$
    begin
      if current_setting('talk.fail_receipt', true) = '1' then
        raise exception 'synthetic receipt failure';
      end if;
      return NEW;
    end $$;
    create trigger talk_import_fail_receipt
      before insert on public.ai_talk_origin_imports
      for each row execute function public.talk_import_fail_receipt();
  `);
});
afterAll(() => db.close());

describe('Talk Origin atomic import SQL (PGlite; not Supabase Auth)', () => {
  it('maps the same bounded project as TypeScript and imports atomically', async () => {
    const mapped = await db.query(
      `select public.ai_talk_origin_mapped_project(${literal(handoff)},${literal(brief)},${literal(plan)},${literal(palette)},${literal(handoff.images)}) as mapped`,
    );
    const sqlProject = projectContentSchema.parse(
      (mapped.rows[0] as { mapped: { content: unknown } }).mapped.content,
    );
    expect(sqlProject).toEqual(projectFromResolvedHandoff(resolvedPackage()));
    expect((mapped.rows[0] as { mapped: { mappingVersion: string; provenance: unknown } }).mapped.provenance).toEqual(
      describeHandoffTransfer(resolvedPackage()),
    );
    expect((mapped.rows[0] as { mapped: { mappingVersion: string } }).mapped.mappingVersion).toBe(
      'talk-origin-import/v1',
    );

    expect((await saveCreation(briefId, 'brief', brief)).rows[0]).toMatchObject({
      receipt: { id: briefId, version: 1 },
    });
    expect((await saveCreation(planId, 'plan', plan)).rows[0]).toMatchObject({
      receipt: { id: planId, version: 1 },
    });
    expect((await saveCreation(paletteId, 'palette', palette)).rows[0]).toMatchObject({
      receipt: { id: paletteId, version: 1 },
    });
    expect((await saveCreation(handoffId, 'handoff', briefOnly)).rows[0]).toMatchObject({
      receipt: { id: handoffId, version: 1 },
    });

    const first = `select public.ai_talk_import_origin('${importId}','${handoffId}','${conversation}') as receipt`;
    expect((await asUser(owner, first)).rows[0]).toMatchObject({
      receipt: {
        id: importId,
        handoffId,
        projectId,
        saveId,
        mappingVersion: 'talk-origin-import/v1',
        recovered: false,
      },
    });
    expect((await asUser(owner, first)).rows[0]).toMatchObject({
      receipt: { id: importId, projectId, saveId, recovered: true },
    });
    expect(
      (
        await asUser(
          owner,
          `select public.ai_talk_import_origin('00000000-0000-4000-8000-00000000000b','${handoffId}','${conversation}') as receipt`,
        )
      ).rows[0],
    ).toMatchObject({ receipt: { handoffId, projectId, saveId, recovered: true } });
    expect(
      (await asUser(owner, `select count(*)::int as count from public.ai_talk_origin_imports`)).rows,
    ).toEqual([{ count: 1 }]);
    const stored = await asUser(
      owner,
      `select content, note from public.architect_origin_versions where id='${saveId}'`,
    );
    expect(stored.rows[0]).toMatchObject({ note: originImportNote });
    expect(projectContentSchema.parse((stored.rows[0] as { content: unknown }).content)).toEqual(
      projectFromResolvedHandoff({
        ...resolvedPackage(),
        handoff: briefOnly,
        plan: undefined,
        palette: undefined,
        selections: [resolvedPackage().selections[0]!],
        images: [],
      }),
    );
    expect((await asUser(foreign, `select id from public.ai_talk_origin_imports`)).rows).toEqual([]);
  });

  it('rejects retired acknowledgement, revoked identity, foreign and changed identities', async () => {
    await expect(
      asUser(
        owner,
        `select public.ai_talk_record_origin_import('${importId}','${handoffId}','${projectId}','${saveId}','${conversation}','2026-10-14T00:00:00.000Z')`,
      ),
    ).rejects.toThrow(/does not exist|could not find|function/i);
    await expect(
      asUser(
        owner,
        `select public.ai_talk_record_origin_import('${importId}','${handoffId}','${projectId}','${saveId}','${conversation}','2026-10-14T00:00:00.000Z','{"imagesCopied":false}'::jsonb)`,
      ),
    ).rejects.toThrow(/does not exist|could not find|function/i);
    await expect(
      asUser(owner, `select public.ai_talk_scoped_identity('talk-origin-project:${owner}:${handoffId}')`),
    ).rejects.toThrow(/permission denied|does not exist/i);
    await expect(
      asUser(
        owner,
        `select public.ai_talk_import_origin('${importId}','00000000-0000-4000-8000-000000000099','${conversation}')`,
      ),
    ).rejects.toThrow(/reused with different inputs/i);
    await expect(
      asUser(
        foreign,
        `select public.ai_talk_import_origin('00000000-0000-4000-8000-00000000000c','${handoffId}','${conversation}')`,
      ),
    ).rejects.toThrow(/unavailable|Sign in required/i);
    await db.exec('set role anon');
    await expect(
      db.query(`select public.ai_talk_import_origin('${importId}','${handoffId}','${conversation}')`),
    ).rejects.toThrow(/permission denied|Sign in required/i);
    await expect(db.query(`select * from public.ai_talk_origin_imports`)).rejects.toThrow(/permission denied/);
    await db.exec('reset role');
  });

  it('rejects expected IDs that already hold different valid content and does not overwrite', async () => {
    expect((await saveCreation(wrongBrief, 'brief', { ...brief, title: 'Wrong package' })).rows[0]).toMatchObject({
      receipt: { id: wrongBrief, version: 1 },
    });
    const occupiedHandoff = {
      ...briefOnly,
      idea: 'A quieter luxury brand.',
      selections: [
        { kind: 'brief', lineageId: wrongBrief, versionId: wrongBrief, version: 1, title: 'Wrong package' },
      ],
    };
    expect((await saveCreation(wrongHandoff, 'handoff', occupiedHandoff)).rows[0]).toMatchObject({
      receipt: { id: wrongHandoff, version: 1 },
    });
    const expectedProject = originProjectIdentity(owner, wrongHandoff);
    const expectedSave = originSaveIdentity(owner, wrongHandoff);
    const wrongContent = initialProject('Wrong valid content', 'business');
    expect(
      (
        await asUser(
          owner,
          `select public.architect_origin_save('${expectedProject}','${expectedSave}',0,${literal(wrongContent)},'${originImportNote}') as revision`,
        )
      ).rows[0],
    ).toEqual({ revision: 1 });
    await expect(
      asUser(
        owner,
        `select public.ai_talk_import_origin('${wrongImport}','${wrongHandoff}','${conversation}')`,
      ),
    ).rejects.toThrow(/Project unavailable/i);
    const after = await asUser(
      owner,
      `select content, note from public.architect_origin_versions where id='${expectedSave}'`,
    );
    expect(after.rows[0]).toMatchObject({ note: originImportNote });
    expect(projectContentSchema.parse((after.rows[0] as { content: unknown }).content)).toEqual(wrongContent);
    expect(
      (
        await asUser(
          owner,
          `select count(*)::int as count from public.ai_talk_origin_imports where handoff_id='${wrongHandoff}'`,
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
  });

  it('rolls the Origin write back when the receipt cannot be recorded', async () => {
    expect((await saveCreation(rollbackBrief, 'brief', brief)).rows[0]).toMatchObject({
      receipt: { id: rollbackBrief, version: 1 },
    });
    const rollbackPackage = {
      ...briefOnly,
      selections: [
        { kind: 'brief', lineageId: rollbackBrief, versionId: rollbackBrief, version: 1, title: 'Reserve site' },
      ],
    };
    expect((await saveCreation(rollbackHandoff, 'handoff', rollbackPackage)).rows[0]).toMatchObject({
      receipt: { id: rollbackHandoff, version: 1 },
    });
    const rollbackProject = originProjectIdentity(owner, rollbackHandoff);
    await db.exec(`select set_config('talk.fail_receipt','1',false)`);
    await expect(
      asUser(
        owner,
        `select public.ai_talk_import_origin('${rollbackImport}','${rollbackHandoff}','${conversation}')`,
      ),
    ).rejects.toThrow(/synthetic receipt failure/i);
    await db.exec(`select set_config('talk.fail_receipt','0',false)`);
    expect(
      (
        await asUser(
          owner,
          `select count(*)::int as count from public.architect_origin_projects where id='${rollbackProject}'`,
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
    expect(
      (
        await asUser(
          owner,
          `select count(*)::int as count from public.ai_talk_origin_imports where handoff_id='${rollbackHandoff}'`,
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
    expect(
      (
        await asUser(
          owner,
          `select public.ai_talk_import_origin('${rollbackImport}','${rollbackHandoff}','${conversation}') as receipt`,
        )
      ).rows[0],
    ).toMatchObject({
      receipt: { id: rollbackImport, handoffId: rollbackHandoff, recovered: false },
    });
  });

  it('matches TypeScript UTF-16 bounds, provenance flags and rejects two of one kind before mutation', async () => {
    const diamond = '💎';
    const combining = 'e\u0301';
    const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
    const lengthSql = async (value: string) =>
      ((await db.query(`select public.talk_utf16_length(${quote(value)}) as n`)).rows[0] as { n: number }).n;
    const boundSql = async (value: string, max: number) =>
      ((await db.query(`select public.talk_bound_text(${quote(value)},${max}) as n`)).rows[0] as { n: string }).n;
    for (const [value, max] of [
      ['A'.repeat(100), 100],
      ['A'.repeat(101), 100],
      [diamond.repeat(50), 100],
      [diamond.repeat(51), 100],
      [`${diamond.repeat(50)}${diamond}`, 101],
      [combining.repeat(50), 100],
      [combining.repeat(51), 100],
      [`${'x'.repeat(99)}\ny`, 100],
      [`${'x'.repeat(2000)}Y`, 2000],
      [`${'x'.repeat(1999)}\ny`, 2000],
      [`${'x'.repeat(3000)}Y`, 3000],
      [`${'x'.repeat(2999)}\ny`, 3000],
      [diamond.repeat(1501), 3000],
    ] as Array<[string, number]>) {
      expect(await lengthSql(value)).toBe(utf16Length(value));
      expect(await boundSql(value, max)).toBe(boundText(value, max));
    }
    await expect(asUser(owner, `select public.talk_utf16_length('A')`)).rejects.toThrow(
      /permission denied/i,
    );
    await expect(asUser(owner, `select public.talk_bound_text('A',100)`)).rejects.toThrow(
      /permission denied/i,
    );

    const longTitle = `${diamond.repeat(51)} Reserve`;
    const longPurpose = `${diamond.repeat(1001)} purpose`;
    const longVision = `${'Keep the reserve site exact.\n'.repeat(80)}${diamond.repeat(40)}`;
    const boundedBrief = {
      ...brief,
      title: longTitle,
      purpose: longPurpose,
    };
    const boundedHandoff = {
      ...handoff,
      idea: longVision,
      description: '',
      selections: [{ ...handoff.selections[0]!, title: longTitle }],
      images: [],
    };
    const resolvedBounded = {
      ...resolvedPackage(),
      handoff: boundedHandoff,
      brief: boundedBrief,
      plan: undefined,
      palette: undefined,
      selections: [{ ...resolvedPackage().selections[0]!, title: longTitle, content: boundedBrief }],
      images: [],
    };
    const mapped = await db.query(
      `select public.ai_talk_origin_mapped_project(${literal(boundedHandoff)},${literal(boundedBrief)},null,null,'[]'::jsonb) as mapped`,
    );
    const sqlMapped = (mapped.rows[0] as { mapped: { content: unknown; provenance: unknown } }).mapped;
    expect(projectContentSchema.parse(sqlMapped.content)).toEqual(projectFromResolvedHandoff(resolvedBounded));
    expect(sqlMapped.provenance).toEqual(describeHandoffTransfer(resolvedBounded));
    expect(
      (sqlMapped.provenance as { copied: Array<{ into: string; truncated: boolean | null }> }).copied.find(
        (field) => field.into === 'name',
      ),
    ).toEqual({ into: 'name', from: 'brief.title', truncated: true });
    expect(
      (sqlMapped.provenance as { copied: Array<{ truncated: boolean | null }> }).copied.every(
        (field) => field.truncated === true || field.truncated === false,
      ),
    ).toBe(true);

    const secondBrief = '00000000-0000-4000-8000-000000000021';
    const secondPlan = '00000000-0000-4000-8000-000000000022';
    const secondPalette = '00000000-0000-4000-8000-000000000023';
    const ambiguousHandoff = '00000000-0000-4000-8000-000000000024';
    const ambiguousImport = '00000000-0000-4000-8000-000000000025';
    const otherBrief = { ...brief, title: 'Other reserve brief' };
    const otherPlan = { ...plan, title: 'Other launch plan' };
    const otherPalette = { ...palette, title: 'Other imperial palette' };
    expect((await saveCreation(secondBrief, 'brief', otherBrief)).rows[0]).toMatchObject({
      receipt: { id: secondBrief, version: 1 },
    });
    expect((await saveCreation(secondPlan, 'plan', otherPlan)).rows[0]).toMatchObject({
      receipt: { id: secondPlan, version: 1 },
    });
    expect((await saveCreation(secondPalette, 'palette', otherPalette)).rows[0]).toMatchObject({
      receipt: { id: secondPalette, version: 1 },
    });
    const ambiguousPackage = {
      ...briefOnly,
      selections: [
        { kind: 'brief', lineageId: secondBrief, versionId: secondBrief, version: 1, title: 'Other reserve brief' },
        { kind: 'brief', lineageId: briefId, versionId: briefId, version: 1, title: 'Reserve site' },
        { kind: 'plan', lineageId: secondPlan, versionId: secondPlan, version: 1, title: 'Other launch plan' },
        { kind: 'plan', lineageId: planId, versionId: planId, version: 1, title: 'Launch plan' },
        { kind: 'palette', lineageId: secondPalette, versionId: secondPalette, version: 1, title: 'Other imperial palette' },
        { kind: 'palette', lineageId: paletteId, versionId: paletteId, version: 1, title: 'Imperial palette' },
      ],
    };
    expect((await saveCreation(ambiguousHandoff, 'handoff', ambiguousPackage)).rows[0]).toMatchObject({
      receipt: { id: ambiguousHandoff, version: 1 },
    });
    await expect(
      asUser(
        owner,
        `select public.ai_talk_import_origin('${ambiguousImport}','${ambiguousHandoff}','${conversation}')`,
      ),
    ).rejects.toThrow(new RegExp(uniqueKindSelectionMessage.replace(/\./g, '\\.')));
    expect(
      (
        await asUser(
          owner,
          `select count(*)::int as count from public.ai_talk_origin_imports where handoff_id='${ambiguousHandoff}'`,
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
    expect(
      (
        await asUser(
          owner,
          `select count(*)::int as count from public.architect_origin_projects where id='${originProjectIdentity(owner, ambiguousHandoff)}'`,
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
  });
});
