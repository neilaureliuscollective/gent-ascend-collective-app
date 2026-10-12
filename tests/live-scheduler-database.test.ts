// Execute the operator SQL against a stub HTTP transport; not actual hosting/Auth acceptance.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role;
    create schema live_private; create schema vault; create schema extensions;
    create table vault.decrypted_secrets(name text, decrypted_secret text);
    insert into vault.decrypted_secrets values ('aethelios_live_preview_cron',repeat('c',64)),('aethelios_live_preview_vercel',repeat('b',32));
    create type extensions.http_header as (field text,value text);
    create type extensions.http_request as (method text,uri text,headers extensions.http_header[],content_type text,content text);
    create type extensions.http_response as (status integer,content_type text,headers extensions.http_header[],content text);
    create table fixture_response(status integer,content_type text,content text);
    insert into fixture_response values(200,'application/json','{"claimed":0,"confirmed":0,"pending":0}');
    create function extensions.http_set_curlopt(text,text) returns boolean language sql as $$ select true $$;
    create function extensions.http(extensions.http_request) returns extensions.http_response language sql as $$
      select row(status,content_type,null,content)::extensions.http_response from public.fixture_response $$;`);
  await db.exec(await readFile('ops/preview-expiry-function.sql', 'utf8'));
});
afterAll(() => db.close());
it('accepts only an explicitly confirmed aggregate receipt', async () => {
  expect((await db.query('select live_private.run_preview_expiry() as receipt')).rows).toEqual([
    { receipt: { claimed: 0, confirmed: 0, pending: 0 } },
  ]);
  for (const content of [
    '{"claimed":1,"confirmed":0,"pending":1}',
    '{"claimed":0,"confirmed":0,"pending":0,"private":"SECRET"}',
    'SECRET',
    '{"claimed":6,"confirmed":6,"pending":0}',
  ]) {
    await db.query('update fixture_response set content=$1', [content]);
    await expect(db.query('select live_private.run_preview_expiry()')).rejects.toThrow(
      'Preview expiry delivery unconfirmed',
    );
  }
});
it('rejects HTTP failure and grants no operational authority to app roles', async () => {
  await db.query('update fixture_response set status=503');
  await expect(db.query('select live_private.run_preview_expiry()')).rejects.toThrow(
    'Preview expiry delivery unconfirmed',
  );
  for (const role of ['anon', 'authenticated', 'service_role']) {
    expect(
      (
        await db.query(
          `select has_function_privilege('${role}','live_private.run_preview_expiry()','EXECUTE') as allowed`,
        )
      ).rows,
    ).toEqual([{ allowed: false }]);
  }
});
