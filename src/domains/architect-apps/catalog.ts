export const APP_PROFILE = 'react-ts-vite' as const;
export const APP_PROFILE_VERSION = '2026-10-14.1';
export const APP_TOOLCHAIN_VERSION = 'vite-8.3.0+react-19.3.0+typescript-6.0.3';

export const approvedDependencies = {
  react: '19.3.0',
  'react-dom': '19.3.0',
  typescript: '6.0.3',
  vite: '8.3.0',
  '@types/react': '19',
  '@types/react-dom': '19',
} as const;

export const sealedPaths = [
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'index.html',
] as const;

export const generatedRoot = 'src/';

export const protectedAppPaths = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'vite.config.js',
  'Dockerfile',
  '.env',
  '.env.local',
  'node_modules',
] as const;

export function isSealedAppPath(path: string) {
  return (sealedPaths as readonly string[]).includes(path) || path === 'package-lock.json';
}

export function isGeneratedAppPath(path: string) {
  return path === 'src' || path.startsWith(generatedRoot);
}

export function sealedManifest() {
  return {
    name: 'aethelios-generated-app',
    private: true,
    type: 'module',
    dependencies: {
      react: approvedDependencies.react,
      'react-dom': approvedDependencies['react-dom'],
    },
    devDependencies: {
      typescript: approvedDependencies.typescript,
      vite: approvedDependencies.vite,
    },
  };
}

export function sealedPackageJson() {
  return `${JSON.stringify(sealedManifest(), null, 2)}\n`;
}

export function sealedTsconfig() {
  return `${JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        lib: ['ES2022', 'DOM', 'DOM.Iterable'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        jsx: 'react-jsx',
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: [],
      },
      include: ['src'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2,
  )}\n`;
}

export function sealedViteConfig() {
  return `import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  esbuild: { jsx: 'automatic', jsxImportSource: 'react' },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    emptyOutDir: true,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      output: {
        format: 'iife',
        name: 'AetheliosGeneratedApp',
        inlineDynamicImports: true,
        entryFileNames: 'assets/app.js',
        chunkFileNames: 'assets/app.js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
});
`;
}

export function sealedIndexHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Generated application</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
}

export function sealedFiles(): { path: string; content: string }[] {
  return [
    { path: 'package.json', content: sealedPackageJson() },
    { path: 'tsconfig.json', content: sealedTsconfig() },
    { path: 'vite.config.ts', content: sealedViteConfig() },
    { path: 'index.html', content: sealedIndexHtml() },
  ];
}
