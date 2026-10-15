import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile } from 'node:fs/promises';

const diagnosticSql = await readFile('docs/releases/TALK_RELEASE_DIAGNOSTIC.sql', 'utf8');
const unsafeGrantSql = `select has_function_privilege(
  'authenticated',
  'public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)',
  'execute'
)`;

type Diagnostic = {
  readsUserContent: boolean;
  classificationCeiling: string;
  rolesPresent: boolean;
  contracts: {
    intendedTurn: string;
    originImport: string;
    retainProvenance: string;
  };
  functions: Record<
    string,
    {
      present: boolean;
      authenticatedExecute: boolean | null;
      serviceRoleExecute: boolean | null;
      hasIntendedTurnAuthority: boolean;
      hasDerivedReceipt: boolean;
    }
  >;
  columns: { table: string; column: string }[];
  policies: { table: string; name: string; command: string }[];
  requiredPolicies: Record<string, boolean>;
  requiredConstraints: Record<string, boolean>;
};

async function bootstrap(db: PGlite) {
  await db.exec(`create role authenticated; create role anon; create role service_role; create schema auth;
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),(nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'role'))$$;
 grant usage on schema public,auth to authenticated,anon,service_role;
 grant execute on function auth.uid() to authenticated,anon,service_role;
 grant execute on function auth.role() to authenticated,anon,service_role;
 create extension if not exists pgcrypto;
 create table public.persons(id uuid primary key, auth_user_id uuid);
 create table public.ai_conversations(id uuid primary key, person_id uuid not null, title text, company_id uuid, archived_at timestamptz, unique(person_id,id));
 create table public.ai_turns(id uuid primary key, person_id uuid, conversation_id uuid, status text default 'complete', finished_at timestamptz default now());
 create table public.ai_live_sessions(id uuid primary key, person_id uuid not null, conversation_id uuid);
 create table public.architect_origin_projects(id uuid not null, person_id uuid not null, primary key(id, person_id));
 create table public.architect_design_directions(
   request_id uuid primary key, person_id uuid not null, project_id uuid not null,
   revision integer default 1, digest text not null, receipt jsonb, started boolean default false,
   source_kind text not null default 'pending', verified boolean not null default false, created_at timestamptz default now()
 );
 grant select, insert on public.persons, public.ai_live_sessions, public.architect_design_directions, public.architect_origin_projects to authenticated;`);
}

async function apply(db: PGlite, files: string[]) {
  for (const file of files) {
    await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'));
  }
}

async function diagnose(db: PGlite) {
  const row = (await db.query(diagnosticSql)).rows[0] as { talk_release_diagnostic: Diagnostic };
  return row.talk_release_diagnostic;
}

const observeThroughAuthority = [
  '20261013240000_talk_creation.sql',
  '20261013260000_talk_creation_candidates.sql',
  '20261014100000_talk_design_board.sql',
  '20261014120000_talk_live_bindings.sql',
  '20261014130000_talk_direction_transfers.sql',
  '20261014140000_talk_live_bind_authority.sql',
  '20261015160000_architect_apps_retain_authority.sql',
];

describe('Talk release diagnostic (PGlite; not hosted schema)', () => {
  it('reports missing functions without aborting, unlike text-signature privilege checks', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(`create role authenticated; create role anon; create role service_role;`);
    await expect(db.query(unsafeGrantSql)).rejects.toThrow();
    const report = await diagnose(db);
    expect(report.readsUserContent).toBe(false);
    expect(report.classificationCeiling).toBe('equivalent-candidate');
    expect(report.contracts.intendedTurn).toBe('missing');
    expect(report.contracts.originImport).toBe('missing');
    expect(report.contracts.retainProvenance).toBe('missing');
    expect(report.policies).toEqual([]);
    expect(report.requiredPolicies.ai_live_observed_items_owner).toBe(false);
    expect(report.requiredConstraints.ai_talk_origin_imports_mapping_version).toBe(false);
    expect(
      report.functions['public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)']?.present,
    ).toBe(false);
    expect(
      report.functions['public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)']
        ?.authenticatedExecute,
    ).toBeNull();
    await db.close();
  });

  it('classifies the 4-arg observe / pre-intended-turn bind as older, not equivalent', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    await bootstrap(db);
    await apply(db, [
      ...observeThroughAuthority,
      '20261015180000_talk_live_trusted_observe.sql',
    ]);
    const report = await diagnose(db);
    expect(report.contracts.intendedTurn).toBe('older');
    expect(
      report.functions['public.ai_live_observe_trusted_item(uuid,uuid,text,text)']?.present,
    ).toBe(true);
    expect(
      report.functions['public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)']?.present,
    ).toBe(false);
    expect(
      report.functions['public.ai_live_bind_finished_turn(uuid,uuid,text,text,uuid)']?.present,
    ).toBe(true);
    expect(
      report.functions['public.ai_live_bind_finished_turn(uuid,uuid,text,text,uuid)']
        ?.hasIntendedTurnAuthority,
    ).toBe(false);
    expect(report.columns.some((column) => column.column === 'intended_turn_id')).toBe(false);
    expect(report.contracts.retainProvenance).toBe('older');
    await db.close();
  });

  it('classifies the final intended-turn and retain contracts only after definition and ACL match', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    await bootstrap(db);
    await apply(db, [
      ...observeThroughAuthority,
      '20261015170000_architect_apps_retain_provenance.sql',
      '20261015180000_talk_live_trusted_observe.sql',
      '20261015190000_talk_live_bind_intended_turn.sql',
    ]);
    const report = await diagnose(db);
    expect(report.contracts.intendedTurn).toBe('equivalent-candidate');
    expect(report.contracts.retainProvenance).toBe('equivalent-candidate');
    expect(
      report.functions['public.ai_live_observe_trusted_item(uuid,uuid,text,text)']?.present,
    ).toBe(false);
    expect(
      report.functions['public.ai_live_observe_trusted_item(uuid,uuid,text,text,uuid)'],
    ).toMatchObject({
      present: true,
      authenticatedExecute: false,
      serviceRoleExecute: true,
      hasIntendedTurnAuthority: true,
    });
    expect(
      report.functions['public.ai_live_bind_finished_turn(uuid,uuid,text,text,uuid)'],
    ).toMatchObject({
      present: true,
      authenticatedExecute: true,
      hasIntendedTurnAuthority: true,
    });
    expect(report.columns.some((column) => column.column === 'intended_turn_id')).toBe(true);
    expect(report.requiredPolicies.ai_live_observed_items_owner).toBe(true);
    expect(report.requiredPolicies.ai_live_turn_bindings_owner).toBe(true);
    expect(
      report.policies.some(
        (policy) => policy.name === 'ai_live_observed_items_owner' && policy.command === 'r',
      ),
    ).toBe(true);
    await db.close();
  });

  it('downgrades intended-turn to partial when owner RLS policy is absent', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    await bootstrap(db);
    await apply(db, [
      ...observeThroughAuthority,
      '20261015170000_architect_apps_retain_provenance.sql',
      '20261015180000_talk_live_trusted_observe.sql',
      '20261015190000_talk_live_bind_intended_turn.sql',
    ]);
    await db.exec('drop policy ai_live_observed_items_owner on public.ai_live_observed_items');
    const report = await diagnose(db);
    expect(report.contracts.intendedTurn).toBe('partial');
    expect(report.requiredPolicies.ai_live_observed_items_owner).toBe(false);
    expect(report.classificationCeiling).toBe('equivalent-candidate');
    await db.close();
  });
});
