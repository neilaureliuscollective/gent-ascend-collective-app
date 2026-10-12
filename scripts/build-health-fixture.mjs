// Offline-only browser acceptance bundle. No app route, Auth bypass or production fixture.
import { build } from 'vite';
import { resolve } from 'node:path';
await build({
  configFile: false,
  root: resolve('tests/health-browser-fixture'),
  publicDir: false,
  resolve: {
    alias: { '@': resolve('src'), 'next/link': resolve('tests/component-fixture/link.tsx') },
  },
  css: { postcss: resolve('.') },
  build: { outDir: resolve('validation/health/browser-bundle'), emptyOutDir: true },
});
