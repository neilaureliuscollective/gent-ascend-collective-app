import { it, expect } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { createLabelDocument } from '../src/domains/studio/label/document';
import { readBrandKit } from '../src/domains/studio/brand';
import { readFile } from 'node:fs/promises';
it('database trigger preserves label provenance, geometry and protected content through direct updates', async () => {
  const db = new PGlite();
  try {
    await db.exec(
      'create role anon;create role authenticated;create table public.ai_studio_designs(id integer primary key,document jsonb);',
    );
    await db.exec(
      await readFile('supabase/migrations/20261020010000_studio_label_protection.sql', 'utf8'),
    );
    const doc = createLabelDocument({
      id: 'b0000000-0000-4000-8000-000000000001',
      profile: JSON.parse(await readFile('tests/fixtures/labels/supplier-profile.json', 'utf8')),
      brief: JSON.parse(await readFile('tests/fixtures/labels/talk-brief.json', 'utf8')),
      logo: await readFile('tests/fixtures/labels/approved-fixture-logo.svg', 'utf8'),
      brand: readBrandKit({}),
      generation: 'deterministic',
      layout: { alignment: 'center', titleSize: 16, logoFraction: 0.32, accent: 'rule' },
    });
    await db.query('insert into public.ai_studio_designs values(1,$1)', [doc]);
    const update = (value: unknown) =>
      db.query('update public.ai_studio_designs set document=$1 where id=1', [value]);
    const edited = structuredClone(doc);
    const title = edited.layers.find((layer) => layer.name === 'Product name');
    if (!title || title.type !== 'text') throw new Error('Missing fixture title');
    title.content = 'Changed title';
    await update(edited);
    const damaged = structuredClone(edited);
    damaged.layers.pop();
    await expect(update(damaged)).rejects.toThrow(/LABEL_COPY_PROTECTED/);
    const removed = structuredClone(edited);
    delete removed.label;
    await expect(update(removed)).rejects.toThrow(/LABEL_PROFILE_IMMUTABLE/);
    const geometry = structuredClone(edited);
    geometry.page.width = 1;
    await expect(update(geometry)).rejects.toThrow(/LABEL_PROFILE_IMMUTABLE/);
    const saved = await db.query<{ document: unknown }>(
      'select document from public.ai_studio_designs',
    );
    expect(saved.rows[0]!.document).toEqual(edited);
  } finally {
    await db.close();
  }
});
