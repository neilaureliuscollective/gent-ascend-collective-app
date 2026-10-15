import type { AppFile } from './schema';

export class AppBundleError extends Error {}

export const APP_BUNDLE_ENTRY = 'assets/app.js';

export type ResolvedAppBundle = {
  html: AppFile;
  script: AppFile;
  styles: AppFile[];
  entry: string;
};

function htmlScriptSrc(html: string) {
  const match = html.match(/<script[^>]+src="([^"]+\.js)"[^>]*>/i);
  return match?.[1]?.replace(/^\.\//, '').replace(/^\//, '') ?? null;
}

export function resolveCompiledBundle(artifacts: AppFile[]): ResolvedAppBundle {
  const html =
    artifacts.find((file) => file.path === 'index.html') ??
    artifacts.find((file) => file.path.endsWith('/index.html'));
  if (!html) throw new AppBundleError('Compiled application is missing index.html.');
  const scripts = artifacts.filter((file) => file.path.endsWith('.js'));
  const referenced = htmlScriptSrc(html.content);
  const preferred =
    scripts.find((file) => file.path === APP_BUNDLE_ENTRY) ??
    (referenced ? scripts.find((file) => file.path === referenced || file.path.endsWith(referenced)) : undefined);
  if (!preferred)
    throw new AppBundleError(
      'Compiled application does not satisfy the single-bundle contract. Chunk and asset references must resolve to assets/app.js.',
    );
  const extra = scripts.filter((file) => file.path !== preferred.path);
  if (extra.length)
    throw new AppBundleError(
      'Compiled application emitted extra JavaScript chunks. Blindly inlining every emitted file is not a supported mount.',
    );
  if (referenced && preferred.path !== referenced && !preferred.path.endsWith(referenced))
    throw new AppBundleError('index.html does not reference the sealed single bundle.');
  return {
    html,
    script: preferred,
    styles: artifacts.filter((file) => file.path.endsWith('.css')),
    entry: preferred.path,
  };
}

export function assertSingleBundleArtifacts(artifacts: AppFile[]) {
  return resolveCompiledBundle(artifacts);
}
