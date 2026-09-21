// Browser-only component fixture; not an application route or identity bypass.
import { createServer } from 'vite';
import { resolve } from 'node:path';
const server = await createServer({
  root: resolve('tests/component-fixture'),
  configFile: false,
  resolve: {
    alias: { '@': resolve('src'), 'next/link': resolve('tests/component-fixture/link.tsx') },
  },
  css: { postcss: resolve('.') },
  server: { host: '127.0.0.1', port: 3102, strictPort: true, fs: { allow: [resolve('.')] } },
});
await server.listen();
