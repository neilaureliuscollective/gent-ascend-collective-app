import 'server-only';
import { Worker } from 'node:worker_threads';
import { resolve } from 'node:path';
/** Separate V8 heap, input/output bounds, memory ceiling and enforced timeout. */
export function extractExchangePdf(bytes: Uint8Array): Promise<string | null> {
  if (!bytes.length || bytes.length > 8388608)
    return Promise.reject(new Error('PDF input exceeds limits.'));
  return new Promise((resolveResult, reject) => {
    const worker = new Worker(resolve(process.cwd(), 'scripts/health-pdf-worker.mjs'), {
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
      execArgv: [],
    });
    let settled = false;
    const done = (text: string | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      void worker.terminate();
      if (error) reject(error);
      else resolveResult(text);
    };
    const timer = setTimeout(
      () => done(null, new Error('PDF processing exceeded its safe limit.')),
      10000,
    );
    worker.on('message', (message: { text?: string | null; failed?: boolean }) => {
      if (
        message.failed ||
        (message.text !== null &&
          (typeof message.text !== 'string' || message.text.length > 200000))
      )
        done(null, new Error('PDF could not be safely processed.'));
      else done(message.text ?? null);
    });
    worker.on('error', () => done(null, new Error('PDF processing unavailable.')));
    worker.on('exit', () => {
      if (!settled) done(null, new Error('PDF processing was interrupted.'));
    });
    worker.postMessage(bytes);
  });
}
