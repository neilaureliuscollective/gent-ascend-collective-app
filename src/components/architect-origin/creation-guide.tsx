import type { CreationTeach } from '@/domains/architect-origin/creation-journey';

export function CreationGuide({
  teach,
  open,
  onToggle,
}: {
  teach: CreationTeach;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <aside className="origin-guide" aria-label="What this is">
      <button type="button" aria-expanded={open} onClick={onToggle}>
        Why this matters
      </button>
      {open ? (
        <dl>
          <div>
            <dt>What this is</dt>
            <dd>{teach.what}</dd>
          </div>
          <div>
            <dt>Why it matters here</dt>
            <dd>{teach.why}</dd>
          </div>
          <div>
            <dt>What changing it affects</dt>
            <dd>{teach.affects}</dd>
          </div>
          <div>
            <dt>The next useful action</dt>
            <dd>{teach.next}</dd>
          </div>
        </dl>
      ) : null}
    </aside>
  );
}
