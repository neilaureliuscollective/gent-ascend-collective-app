// Standalone review artifact. The gallery is never imported by application routes.
import { build } from 'vite';
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
const integration = process.argv.includes('--integration');
const identity = process.argv.includes('--identity');
const result = await build({
  configFile: false,
  publicDir: false,
  resolve: {
    alias: {
      '@': resolve('src'),
      'next/link': resolve('tests/component-fixture/link.tsx'),
      'next/image': resolve('tests/component-fixture/image.tsx'),
      'next/navigation': resolve('tests/component-fixture/navigation.ts'),
    },
  },
  build: {
    write: false,
    lib: {
      entry: resolve(
        identity
          ? 'tests/component-fixture/identity-studies.tsx'
          : integration
            ? 'tests/component-fixture/motion-integration.tsx'
            : 'tests/component-fixture/motion-gallery.tsx',
      ),
      name: 'AetheliosMotionReview',
      formats: ['iife'],
    },
    cssCodeSplit: false,
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => item.output);
const script = outputs
  .filter((item) => item.type === 'chunk')
  .map((item) => item.code)
  .join('\n');
const css = outputs
  .filter((item) => item.type === 'asset' && item.fileName.endsWith('.css'))
  .map((item) => item.source)
  .join('\n');
const crest = await readFile('public/brand/aethelios-human-ascendance-20261015-crest.webp');
const emblem = await readFile('public/brand/aethelios-official-20261015-192.png');
// Embed the official, unmodified artwork for a network-free visual review.
const embedded = script
  .replaceAll(
    '/brand/aethelios-human-ascendance-20261015-crest.webp',
    `data:image/webp;base64,${crest.toString('base64')}`,
  )
  .replaceAll(
    '/brand/aethelios-official-20261015-192.png',
    `data:image/png;base64,${emblem.toString('base64')}`,
  );
const destination =
  process.argv.slice(2).find((value) => !value.startsWith('--')) ??
  (integration
    ? '/tmp/aethelios-motion-integration-review.html'
    : '/tmp/aethelios-motion-review.html');
await writeFile(
  destination,
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aethelios Intelligence Motion · ${identity ? 'Identity studies · Synthetic preview' : integration ? 'Phase 2 synthetic integration' : 'Phase 1 review'}</title><style>${css}</style></head><body><div id="root"></div><script>${embedded.replaceAll('</script', '<\\/script')}</script></body></html>`,
);
console.log(`Standalone visual review: ${destination}`);
