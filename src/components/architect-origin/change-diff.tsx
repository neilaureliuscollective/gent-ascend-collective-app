'use client';
import { lineDiff } from '@/domains/architect-construct/review-diff';

export type ReviewPatch = {
  path: string;
  before: string;
  after: string;
  intent?: string;
  warning?: string;
};

export function ChangeDiff({
  patches,
  selectedPath,
  onSelect,
  summary,
  notes,
  mocked,
  heading,
}: {
  patches: ReviewPatch[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  summary: string;
  notes?: string;
  mocked?: boolean;
  heading?: string;
}) {
  const selected = patches.find((file) => file.path === selectedPath) ?? patches[0] ?? null;
  const lines = selected ? lineDiff(selected.before, selected.after) : [];
  return (
    <section className="origin-change-diff" aria-labelledby="architect-proposed-change">
      <h4 id="architect-proposed-change">{heading ?? 'Proposed change awaiting approval'}</h4>
      <p>{summary}</p>
      {mocked && <p>Labelled mocked provider. This is not a paid OpenAI call.</p>}
      {notes && <p>{notes}</p>}
      <ul className="origin-change-files">
        {patches.map((file) => (
          <li key={file.path}>
            <button
              type="button"
              aria-current={selected?.path === file.path ? 'true' : undefined}
              onClick={() => onSelect(file.path)}
            >
              {file.path}
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <article aria-label={`Diff ${selected.path}`}>
          <p>
            <strong>{selected.path}</strong>
            {selected.intent ? ` — ${selected.intent}` : ''}
          </p>
          {selected.warning && <p className="origin-understand-warning">{selected.warning}</p>}
          <pre className="origin-diff" tabIndex={0}>
            {lines.map((line, index) => (
              <span key={`${selected.path}:${index}`} data-diff={line.kind}>
                {line.kind === 'add' ? '+' : line.kind === 'remove' ? '-' : ' '}
                {line.text}
                {'\n'}
              </span>
            ))}
          </pre>
        </article>
      )}
    </section>
  );
}
