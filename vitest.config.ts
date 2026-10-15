import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts', 'tests/talk-import-recovery-target.test.mjs'],
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
