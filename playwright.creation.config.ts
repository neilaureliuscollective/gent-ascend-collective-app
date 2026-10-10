import { defineConfig } from '@playwright/test';
import { readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { localScope, stagingScope } from './scripts/creation-acceptance-scope';
export function creationSetup() {
  const tree = execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim(),
    commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  if (process.env.CREATION_ACCEPTANCE_MANIFEST) {
    if (
      execFileSync('git', ['status', '--porcelain', '--untracked-files=no'], {
        encoding: 'utf8',
      }).trim()
    )
      throw new Error('A clean committed candidate is required.');
    if (statSync(process.env.CREATION_ACCEPTANCE_MANIFEST).size > 10000)
      throw new Error('Manifest too large.');
    const bytes = readFileSync(process.env.CREATION_ACCEPTANCE_MANIFEST, 'utf8');
    if (Buffer.byteLength(bytes) > 10000) throw new Error('Manifest too large.');
    return {
      scope: stagingScope(JSON.parse(bytes), tree, commit),
      key: process.env.ACCEPTANCE_PUBLISHABLE_KEY!,
      logins: ['A', 'B'].map((l) => ({
        email: process.env[`ACCEPTANCE_${l}_EMAIL`]!,
        password: process.env[`ACCEPTANCE_${l}_PASSWORD`]!,
      })),
    };
  }
  if (process.env.CREATION_ACCEPTANCE_LOCAL !== 'true')
    throw new Error('Explicit creation acceptance scope required.');
  const env = Object.fromEntries(
    readFileSync('.env.development.local', 'utf8')
      .trim()
      .split(/\r?\n/)
      .map((l) => {
        const n = l.indexOf('=');
        return [l.slice(0, n), l.slice(n + 1)];
      }),
  );
  return {
    scope: localScope(env.NEXT_PUBLIC_SUPABASE_URL!, tree, commit),
    key: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    logins: ['founder@aurelius.test', 'member@aurelius.test'].map((email) => ({
      email,
      password: env.AURELIUS_FOUNDER_PASSWORD!,
    })),
  };
}
const setup = creationSetup();
export default defineConfig({
  testDir: 'tests/creation',
  workers: 1,
  retries: 0,
  timeout: 120000,
  expect: { timeout: 15000 },
  reporter: 'list',
  use: {
    baseURL: setup.scope.origin,
    headless: true,
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined },
  },
  webServer:
    setup.scope.scope === 'disposable-local'
      ? {
          command: 'npm run dev -- --port 3104',
          url: setup.scope.origin,
          reuseExistingServer: false,
          timeout: 60000,
        }
      : undefined,
});
