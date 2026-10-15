/**
 * Local opt-in Aethelios behavior evaluation.
 *
 * Layer 1 — Deterministic: `npx vitest run tests/intelligence-collaborator.test.ts tests/intelligence-conversation-path.test.ts tests/product-knowledge-conversation.test.ts tests/intelligence-behavior.test.ts tests/live-product-lookup.test.ts`
 * Layer 2 — Optional model-quality: `AETHELIOS_BEHAVIOR_EVAL=1` records approval.
 *            `AETHELIOS_BEHAVIOR_EVAL_EXECUTE=1` actually scores returned model answers.
 * Layer 3 — Human voice-naturalness review, scored separately.
 *
 * Cost controls: AETHELIOS_BEHAVIOR_EVAL_MODEL, AETHELIOS_BEHAVIOR_EVAL_BUDGET_USD (default 1),
 * AETHELIOS_BEHAVIOR_EVAL_MAX_REQUESTS (default 24), AETHELIOS_BEHAVIOR_EVAL_MAX_OUTPUT_TOKENS (default 800),
 * AETHELIOS_BEHAVIOR_EVAL_COMPARE=1 for baseline vs current.
 *
 * Official references: OpenAI prompt engineering and evaluation best practices.
 * Do not run paid calls without founder approval.
 */
import { existsSync } from 'node:fs';
import { dirname, extname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    const trySpecifier = (value: string) => nextResolve(value, context);
    if (specifier.startsWith('@/')) {
      const mapped = resolvePath(
        fileURLToPath(new URL('../src/', import.meta.url)),
        specifier.slice(2),
      );
      const withTs = extname(mapped) ? mapped : `${mapped}.ts`;
      if (existsSync(withTs)) return trySpecifier(pathToFileURL(withTs).href);
    }
    if (specifier.startsWith('.') && !extname(specifier) && context.parentURL) {
      const candidate = `${resolvePath(dirname(fileURLToPath(context.parentURL)), specifier)}.ts`;
      if (existsSync(candidate)) return trySpecifier(pathToFileURL(candidate).href);
    }
    return trySpecifier(specifier);
  },
});

const { runBehaviorEval } = await import('../src/domains/intelligence/behavior-eval-run.ts');
const report = await runBehaviorEval();
console.log(JSON.stringify(report, null, 2));
if (report.status === 'missing-key') process.exitCode = 2;
