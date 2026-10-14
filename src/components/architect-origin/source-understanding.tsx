'use client';
import type { SourceContextManifest, SourceManifestEntry } from '@/domains/architect-construct/source-context';

const inclusionLabel: Record<SourceManifestEntry['inclusion'], string> = {
  complete: 'Complete exact file',
  excerpt: 'Excerpt — not the full original',
  'too-large': 'Too large for a whole-file edit',
  missing: 'Missing from this snapshot',
  omitted: 'Not included in this pass',
};

export function SourceUnderstanding({
  context,
  selectedPath,
  onSelect,
  onToggleFile,
}: {
  context: SourceContextManifest;
  selectedPath: string | null;
  onSelect: (path: string) => void;
  onToggleFile?: (path: string) => void;
}) {
  const selected = context.entries.find((entry) => entry.path === selectedPath) ?? null;
  return (
    <section className="origin-understand" aria-labelledby="architect-understands">
      <h4 id="architect-understands">What Architect understands</h4>
      <p className="origin-understand-outcome">{context.outcome || 'No requested outcome yet.'}</p>
      <p>
        This is a bounded snapshot, not complete repository knowledge.
        {context.missing.length
          ? ` Missing imports or configuration: ${context.missing.join(', ')}.`
          : ' No missing imports were detected in the selected files.'}
      </p>
      {context.refusal && <p className="origin-understand-warning">{context.refusal}</p>}
      <ul className="origin-understand-list">
        {context.entries.map((entry) => (
          <li key={entry.path}>
            <button
              type="button"
              aria-current={selectedPath === entry.path ? 'true' : undefined}
              onClick={() => onSelect(entry.path)}
            >
              <strong className="origin-understand-file">{entry.path}</strong>
              <span className="origin-understand-inclusion">{inclusionLabel[entry.inclusion]}</span>
            </button>
            {onToggleFile && entry.inclusion !== 'missing' && (
              <button type="button" className="origin-understand-adjust" onClick={() => onToggleFile(entry.path)}>
                Adjust
              </button>
            )}
          </li>
        ))}
      </ul>
      {selected && (
        <article className="origin-understand-inspect" aria-label={`Inspect ${selected.path}`}>
          <p>
            <strong>{selected.path}</strong> · {inclusionLabel[selected.inclusion]}
            {selected.content_hash ? ` · ${selected.content_hash.slice(0, 12)}` : ''}
          </p>
          <p>{selected.reason}</p>
          {selected.complete ? (
            <p>Complete content is available for a whole-file edit.</p>
          ) : selected.excerpt ? (
            <pre>{selected.excerpt}</pre>
          ) : (
            <p>No excerpt is available. Add this file through the authorized source path.</p>
          )}
        </article>
      )}
    </section>
  );
}
