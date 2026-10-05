import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'public/mirror/vision-1.0.1/**', 'next-env.d.ts', 'playwright-report/**', 'test-results/**']),
]);
