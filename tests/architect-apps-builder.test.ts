import { expect, it } from 'vitest';
import { resolveTrustedToolchain, buildGeneratedApp } from '@/domains/architect-apps/builder';
import { trackerSourceFiles } from '@/domains/architect-apps/tracker-fixture';
import { applyFileOperations, overlaySealedFiles } from '@/domains/architect-apps/tree';
import { trackerPriorityOperations } from '@/domains/architect-apps/tracker-fixture';
import { isSealedAppPath } from '@/domains/architect-apps/catalog';
import { assemblePreviewDocument, previewCsp, APP_PREVIEW_SANDBOX } from '@/domains/architect-apps/preview';

it('rejects sealed-path operations and preserves unchanged files on a priority revision', () => {
  const base = trackerSourceFiles();
  expect(() =>
    applyFileOperations(base, [
      { op: 'update', path: 'package.json', content: '{"hack":true}', baseHash: 'a'.repeat(64) },
    ]),
  ).toThrow(/sealed toolchain/i);
  const revised = applyFileOperations(base, trackerPriorityOperations(base));
  expect(revised.files.find((file) => file.path === 'src/calc.ts')?.content).toBe(
    base.find((file) => file.path === 'src/calc.ts')?.content,
  );
  expect(revised.files.find((file) => file.path === 'src/types.ts')?.content).toMatch(/priority/);
  expect(overlaySealedFiles(revised.files).filter((file) => isSealedAppPath(file.path))).toHaveLength(4);
});

it('assembles a script-enabled preview without parent cookies or service workers', () => {
  const preview = assemblePreviewDocument({
    artifacts: [
      { path: 'index.html', content: '<!doctype html><html><head></head><body><div id="root"></div></body></html>' },
      { path: 'assets/app.js', content: 'window.__ready=true' },
    ],
    session: 'session-token-value-1234',
    parentOrigin: 'http://127.0.0.1:3100',
  });
  expect(preview.sandbox).toBe(APP_PREVIEW_SANDBOX);
  expect(preview.sandbox).not.toMatch(/same-origin/);
  expect(preview.csp).toBe(previewCsp());
  expect(preview.srcDoc).toMatch(/__AETHELIOS_APP_SESSION__/);
  expect(preview.srcDoc).toMatch(/serviceWorker/);
  expect(preview.serviceWorkers).toBe(false);
});

it('typechecks and bundles the tracker with the pinned trusted toolchain when present', async () => {
  const host = resolveTrustedToolchain();
  if (!host.typecheckBin || !host.viteBin) {
    expect(host.isolation).toBe('unavailable');
    return;
  }
  const built = await buildGeneratedApp(trackerSourceFiles(), { host, timeoutMs: 90000 });
  expect(built.result.typecheck.ok, built.result.typecheck.log).toBe(true);
  expect(built.result.bundle.ok, built.result.bundle.log).toBe(true);
  expect(built.artifacts.some((file) => file.path === 'index.html' || file.path.endsWith('.js'))).toBe(true);
  expect(built.manifestHash).toMatch(/^[0-9a-f]{64}$/);
}, 120000);
