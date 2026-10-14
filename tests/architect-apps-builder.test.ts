import { expect, it } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolveTrustedToolchain, buildGeneratedApp } from '@/domains/architect-apps/builder';
import { trackerSourceFiles } from '@/domains/architect-apps/tracker-fixture';
import { notesSourceFiles } from '@/domains/architect-apps/notes-fixture';
import { applyFileOperations, overlaySealedFiles } from '@/domains/architect-apps/tree';
import { trackerPriorityOperations } from '@/domains/architect-apps/tracker-fixture';
import { isSealedAppPath } from '@/domains/architect-apps/catalog';
import { assemblePreviewDocument, previewCsp, resetPreviewSessions, signPreviewSession, APP_PREVIEW_SANDBOX } from '@/domains/architect-apps/preview';
import { APP_BUNDLE_ENTRY } from '@/domains/architect-apps/bundle';

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

it('inserts the compiled IIFE without interpolating String.replace patterns', () => {
  const preview = assemblePreviewDocument({
    artifacts: [
      { path: 'index.html', content: '<!doctype html><html><head></head><body><div id="root"></div></body></html>' },
      {
        path: 'assets/app.js',
        content: 'replace(ce,`$&/`)+`/`); const captured=$1; const dollars=$$; window.__ready=true',
      },
    ],
    session: 'v1.aaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    parentOrigin: 'http://127.0.0.1:3100',
    revision: 1,
    revisionId: '00000000-0000-4000-8000-000000000009',
  });
  expect(preview.srcDoc).toContain('replace(ce,`$&/`)+`/`)');
  expect(preview.srcDoc).toContain('const captured=$1');
  expect(preview.srcDoc).toContain('const dollars=$$');
  expect(preview.srcDoc).not.toContain('</body>/');
});

it('does not let compiled JS close the preview document', () => {
  const preview = assemblePreviewDocument({
    artifacts: [
      { path: 'index.html', content: '<!doctype html><html><head></head><body><div id="root"></div></body></html>' },
      { path: 'assets/app.js', content: 'const html="</body></html>"; window.__ready=true' },
    ],
    session: 'v1.aaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    parentOrigin: 'http://127.0.0.1:3100',
    revision: 1,
    revisionId: '00000000-0000-4000-8000-000000000009',
  });
  expect(preview.srcDoc).toMatch(/<\\\/body><\\\/html>/);
  expect(preview.srcDoc.match(/<\/body>/g)?.length).toBe(1);
  expect(preview.revision).toBe(1);
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
  expect(preview.csp).toMatch(/sandbox allow-scripts/);
  expect(preview.csp).not.toMatch(/allow-same-origin/);
  expect(preview.entry).toBe(APP_BUNDLE_ENTRY);
  expect(preview.sameOriginStorage).toBe(false);
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
  expect(built.result.isolation).toBe('host-fixture');
  expect(built.result.sandbox).toBe(false);
}, 120000);

it('compiles Field Notes with the labelled host-fixture runner and does not claim isolation', async () => {
  const host = resolveTrustedToolchain();
  if (!host.typecheckBin || !host.viteBin) {
    expect(host.isolation).toBe('unavailable');
    return;
  }
  const built = await buildGeneratedApp(notesSourceFiles(), { host, timeoutMs: 90000 });
  expect(built.result.typecheck.ok, built.result.typecheck.log).toBe(true);
  expect(built.result.bundle.ok, built.result.bundle.log).toBe(true);
  expect(built.result.isolation).toBe('host-fixture');
  expect(built.result.sandbox).toBe(false);
  resetPreviewSessions();
  const session = signPreviewSession({
    personId: '00000000-0000-4000-8000-000000000001',
    projectId: '00000000-0000-4000-8000-000000000003',
    revisionId: '00000000-0000-4000-8000-000000000009',
    secret: 'builder-preview-secret-key',
  });
  const preview = assemblePreviewDocument({
    artifacts: built.artifacts,
    session,
    parentOrigin: 'http://127.0.0.1:3100',
    title: 'Field notes',
    revision: 1,
    revisionId: '00000000-0000-4000-8000-000000000009',
  });
  await mkdir('test-results', { recursive: true });
  await writeFile('test-results/architect-apps-notes-host-fixture.html', preview.srcDoc, 'utf8');
  expect(preview.srcDoc).toMatch(/Field notes|Aethelios generated application/i);
  expect(preview.revision).toBe(1);
  expect(preview.entry).toBe(APP_BUNDLE_ENTRY);
  expect(built.artifacts.filter((file) => file.path.endsWith('.js'))).toHaveLength(1);
  expect(built.artifacts.some((file) => file.path === APP_BUNDLE_ENTRY)).toBe(true);
}, 120000);
