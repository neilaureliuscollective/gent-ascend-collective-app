// Local/offline aggregation only. Never calls a provider or changes application records.
import { readFile, stat } from 'node:fs/promises';
import { summarizeDiagnostics } from '../src/domains/live/acceptance.ts';
const paths = process.argv.slice(2);
if (!paths.length || paths.length > 1000) {
  console.error('Usage: npm run live:report -- <diagnostic.json> [more diagnostic files]');
  process.exitCode = 1;
} else {
  try {
    const reports = [];
    for (const path of paths) {
      if ((await stat(path)).size > 131072)
        throw new Error('Diagnostic file exceeds the size limit.');
      reports.push(JSON.parse(await readFile(path, 'utf8')));
    }
    console.log(JSON.stringify(summarizeDiagnostics(reports), null, 2));
  } catch {
    // Never print malformed file content or schema error values, which may contain personal data.
    console.error(
      'Diagnostic report failed. Check file accessibility, size and the supported export schema.',
    );
    process.exitCode = 1;
  }
}
