import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { APP_TOOLCHAIN_VERSION } from './catalog';
import { artifactManifestHash } from './hash';
import type { AppFile, AppJobResult } from './schema';
import { overlaySealedFiles } from './tree';

export type AppBuildHost = {
  toolchain: typeof APP_TOOLCHAIN_VERSION;
  isolation: AppJobResult['isolation'];
  sandbox: boolean;
  typecheckBin?: string;
  viteBin?: string;
  nodePath?: string;
};

export function resolveTrustedToolchain(cwd = process.cwd()): AppBuildHost {
  const nodePath = join(cwd, 'node_modules');
  const typecheckBin = join(nodePath, 'typescript/bin/tsc');
  const viteBin = join(nodePath, 'vite/bin/vite.js');
  if (!existsSync(typecheckBin) || !existsSync(viteBin)) {
    return {
      toolchain: APP_TOOLCHAIN_VERSION,
      isolation: 'unavailable',
      sandbox: false,
    };
  }
  return {
    toolchain: APP_TOOLCHAIN_VERSION,
    isolation: 'host-trusted',
    sandbox: false,
    typecheckBin,
    viteBin,
    nodePath,
  };
}

export function appBuildHostRequirement() {
  return {
    image: process.env.ARCHITECT_APPS_IMAGE || 'aethelios-architect-apps:2026-10-14.1',
    toolchain: APP_TOOLCHAIN_VERSION,
    requirement:
      'Isolated builds need a versioned image with pinned React 19.3.0, TypeScript 6.0.3 and Vite 8.3.0 preinstalled. The worker invokes only trusted typecheck and vite build entry points. Model-defined package scripts, Dockerfiles and plugins are never executed. Docker socket, host secrets and privileged execution stay closed. This host currently offers a trusted in-process toolchain adapter when those binaries are already installed for the platform.',
  };
}

function runTrusted(
  file: string,
  args: string[],
  cwd: string,
  extra: Record<string, string | undefined>,
  timeoutMs: number,
) {
  return new Promise<{ ok: boolean; log: string }>((resolve) => {
    const child = spawn(process.execPath, [file, ...args], {
      cwd,
      env: {
        PATH: '/usr/bin:/bin',
        HOME: cwd,
        NODE_ENV: 'production',
        NODE_PATH: extra.NODE_PATH,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let log = '';
    const append = (chunk: Buffer) => {
      if (log.length > 12000) return;
      log += chunk.toString('utf8');
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({ ok: false, log: `${log}\nTrusted build timed out.`.trim() });
    }, timeoutMs);
    child.on('error', (error) => {
      clearTimeout(timer);
      resolve({ ok: false, log: error.message });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, log: log.trim() });
    });
  });
}

async function collectArtifacts(dist: string): Promise<AppFile[]> {
  const files: AppFile[] = [];
  async function walk(dir: string, prefix: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(join(dir, entry.name), relative);
        continue;
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.name) && !entry.name.includes('.')) continue;
      const content = await readFile(join(dir, entry.name));
      if (content.length > 400000) throw new Error(`Artifact ${relative} exceeds the bound.`);
      files.push({
        path: relative,
        content: content.toString(relative.endsWith('.css') || relative.endsWith('.js') || relative.endsWith('.html') || relative.endsWith('.map') ? 'utf8' : 'base64'),
      });
    }
  }
  await walk(dist, '');
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function buildGeneratedApp(
  files: AppFile[],
  options: { host?: AppBuildHost; timeoutMs?: number; onStage?: (kind: 'typecheck' | 'bundle', detail: string) => Promise<void> } = {},
) {
  const host = options.host ?? resolveTrustedToolchain();
  const timeoutMs = options.timeoutMs ?? 90000;
  const stages: AppJobResult['stages'] = [];
  const record = async (kind: AppJobResult['stages'][number]['kind'], detail: string) => {
    stages.push({ kind, at: new Date().toISOString(), detail });
    if ((kind === 'typecheck' || kind === 'bundle') && options.onStage) await options.onStage(kind, detail);
  };
  if (!host.typecheckBin || !host.viteBin) {
    await record('failed', appBuildHostRequirement().requirement);
    return {
      result: {
        ok: false,
        isolation: host.isolation,
        sandbox: false,
        typecheck: { ok: false, log: '' },
        bundle: { ok: false, log: '' },
        blocker: appBuildHostRequirement().requirement,
        stages,
      } satisfies AppJobResult,
      artifacts: [] as AppFile[],
      manifestHash: null as string | null,
    };
  }
  const work = await mkdtemp(join(tmpdir(), 'architect-apps-'));
  try {
    const tree = overlaySealedFiles(files);
    for (const file of tree) {
      const target = join(work, file.path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, file.content, 'utf8');
    }
    const modules = join(work, 'node_modules');
    await mkdir(join(modules, '@types'), { recursive: true });
    for (const name of ['react', 'react-dom', 'scheduler', 'vite', 'typescript', '@types/react', '@types/react-dom']) {
      const source = join(host.nodePath ?? '', name);
      const destination = join(modules, name);
      if (existsSync(source) && !existsSync(destination)) await symlink(source, destination, 'dir');
    }
    const typecheck = await runTrusted(
      host.typecheckBin,
      ['--noEmit', '-p', 'tsconfig.json'],
      work,
      {},
      Math.floor(timeoutMs / 2),
    );
    await record('typecheck', typecheck.ok ? 'Trusted TypeScript noEmit passed.' : 'Trusted TypeScript noEmit failed.');
    if (!typecheck.ok) {
      return {
        result: {
          ok: false,
          isolation: host.isolation,
          sandbox: host.sandbox,
          typecheck,
          bundle: { ok: false, log: '' },
          blocker: 'Typecheck failed. The last successful application is retained.',
          stages,
        } satisfies AppJobResult,
        artifacts: [],
        manifestHash: null,
      };
    }
    const bundle = await runTrusted(
      host.viteBin,
      ['build'],
      work,
      { NODE_PATH: [join(work, 'node_modules'), host.nodePath].filter(Boolean).join(':') },
      Math.floor(timeoutMs / 2),
    );
    await record('bundle', bundle.ok ? 'Trusted Vite production bundle passed.' : 'Trusted Vite production bundle failed.');
    if (!bundle.ok) {
      return {
        result: {
          ok: false,
          isolation: host.isolation,
          sandbox: host.sandbox,
          typecheck,
          bundle,
          blocker: 'Production bundle failed. The last successful application is retained.',
          stages,
        } satisfies AppJobResult,
        artifacts: [],
        manifestHash: null,
      };
    }
    const artifacts = await collectArtifacts(join(work, 'dist'));
    return {
      result: {
        ok: true,
        isolation: host.isolation,
        sandbox: host.sandbox,
        typecheck,
        bundle,
        blocker: host.isolation === 'host-trusted' ? 'Host-trusted toolchain. Isolated image execution remains the production requirement.' : null,
        stages,
      } satisfies AppJobResult,
      artifacts,
      manifestHash: artifactManifestHash(artifacts),
    };
  } finally {
    await rm(work, { recursive: true, force: true });
  }
}
