// Browser-only component fixture; not an application route or identity bypass.
import { createServer } from 'vite';
import { resolve } from 'node:path';
const server = await createServer({
  root: resolve('tests/component-fixture'),
  configFile: false,
  publicDir: resolve('public'),
  // Shell is a Server Component in the app. This isolated browser fixture has
  // no server environment; keep its feature flag closed without exposing env.
  // The dedicated Live fixtures explicitly enable their mocked provider.
  define: { 'process.env.AETHELIOS_LIVE_ENABLED': 'undefined' },
  resolve: {
    alias: {
      '@': resolve('src'),
      'next/link': resolve('tests/component-fixture/link.tsx'),
      'next/image': resolve('tests/component-fixture/image.tsx'),
      'next/navigation': resolve('tests/component-fixture/navigation.ts'),
    },
  },
  css: { postcss: resolve('.') },
  server: {
    host: '127.0.0.1',
    port: Number(process.env.PLAYWRIGHT_FIXTURE_PORT || 3102),
    strictPort: true,
    fs: { allow: [resolve('.')] },
  },
});
await server.listen();
