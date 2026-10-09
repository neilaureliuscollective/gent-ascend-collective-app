// Browser-only component fixture; not an application route or identity bypass.
import { createServer } from 'vite';
import { resolve } from 'node:path';
const port = Number(process.env.PLAYWRIGHT_COMPONENT_PORT ?? 3102);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('Invalid component-test port');
const server = await createServer({
  root: resolve('tests/component-fixture'),
  configFile: false,
  publicDir: resolve('public'),
  resolve: {
    alias: {
      '@': resolve('src'),
      'next/link': resolve('tests/component-fixture/link.tsx'),
      'next/image': resolve('tests/component-fixture/image.tsx'),
      'next/navigation': resolve('tests/component-fixture/navigation.ts'),
    },
  },
  css: { postcss: resolve('.') },
  server: { host: '127.0.0.1', port, strictPort: true, fs: { allow: [resolve('.')] } },
});
await server.listen();
