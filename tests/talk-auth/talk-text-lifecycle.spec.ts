// Real disposable Auth/PostgREST and Next routes; deterministic model transport.
// No paid provider, microphone or hosted production acceptance.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env = Object.fromEntries(
  readFileSync('.env.development.local', 'utf8')
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at), line.slice(at + 1)];
    }),
);
if (new URL(env.NEXT_PUBLIC_SUPABASE_URL!).hostname !== '127.0.0.1')
  throw new Error('Disposable loopback Auth required');

for (const width of [390, 690])
  test(`real text send, stop, retry and reopen at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const owner = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    expect(
      (
        await owner.auth.signInWithPassword({
          email: 'founder@aurelius.test',
          password: env.AURELIUS_FOUNDER_PASSWORD!,
        })
      ).error,
    ).toBeNull();
    await page.goto('/enter');
    await page.getByLabel('Email').fill('founder@aurelius.test');
    await page.getByLabel('Password').fill(env.AURELIUS_FOUNDER_PASSWORD!);
    await page.getByRole('button', { name: 'Enter Aethelios', exact: true }).click();
    await expect(page).toHaveURL(/\/app(?:\/|$|\?)/, { timeout: 30000 });
    await page.goto('/app/aethelios');
    const composer = page.getByLabel('Message Aethelios', { exact: true });
    const text = `[slow-stream] synthetic text lifecycle ${width}`;
    await composer.fill(text);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText(/Labelled deterministic Talk fixture: streaming/)).toBeVisible();
    await expect(composer).toHaveValue('');
    await page.getByRole('button', { name: 'Stop reply', exact: true }).click();
    const conversation = new URL(page.url()).searchParams.get('conversation');
    expect(conversation).toMatch(/^[a-f0-9-]{36}$/i);
    const rows = async () => {
      const result = await owner
        .from('ai_turns')
        .select('id,status,user_text,assistant_text,parent_turn_id')
        .eq('conversation_id', conversation!)
        .order('created_at');
      expect(result.error).toBeNull();
      return result.data!;
    };
    await expect.poll(async () => (await rows())[0]?.status).toBe('cancelled');
    expect(await rows()).toHaveLength(1);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Retry reply', exact: true }).click();
    await expect
      .poll(async () => (await rows()).filter((row) => row.status === 'complete').length)
      .toBe(1);
    const saved = await rows();
    expect(saved).toHaveLength(2);
    expect(saved[1]?.parent_turn_id).toBe(saved[0]?.id);
    expect(saved[1]?.user_text).toBe(text);
    await expect(composer).toHaveValue('');
    await page.setViewportSize({ width, height: 420 });
    await composer.focus();
    const box = await composer.boundingBox();
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(420);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(composer).toHaveValue('');
    await expect(page.getByText(text, { exact: true })).toHaveCount(1);
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await page.goto(`/app/aethelios?conversation=${conversation}`);
    await expect(page.getByText(text, { exact: true })).toHaveCount(1);
    expect(await rows()).toHaveLength(2);
    await owner.from('ai_conversations').delete().eq('id', conversation!);
  });
