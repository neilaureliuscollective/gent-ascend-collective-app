import type { VisualBoard } from '@/domains/artifacts/visual';
import { specialist } from '@/domains/intelligence/council';
export function CoworkerReview({
  board,
  onReturn,
  busy = false,
}: {
  board: Extract<VisualBoard, { kind: 'review' }>;
  onReturn?: () => void;
  busy?: boolean;
}) {
  const member = specialist(board.coworker);
  return (
    <section className="live-coworker-review" aria-label="Coworker contribution">
      <p className="eyebrow">COUNCIL / {member.name.toUpperCase()}</p>
      <h4>{member.role}</h4>
      <p>
        Read-only AI suggestion ·{' '}
        {board.contextScope === 'task-only' ? 'standalone task' : 'approved visual snapshot'}. No
        research, record changes or external actions were performed.
      </p>
      <div className="live-coworker-text">{board.text}</div>
      {onReturn && board.sourceArtifactId && (
        <button type="button" disabled={busy} onClick={onReturn}>
          Select original reviewed part
        </button>
      )}
    </section>
  );
}
export function SharedReviewContext({
  scope,
  snapshot,
}: {
  scope?: string | null;
  snapshot?: Record<string, unknown> | null;
}) {
  if (scope !== 'selected-part')
    return (
      <p>
        Only this standalone task is shared. Profile, memory and unrelated conversation are
        excluded.
      </p>
    );
  const part =
    snapshot?.part && typeof snapshot.part === 'object'
      ? (snapshot.part as Record<string, unknown>)
      : {};
  const value = (item: unknown) =>
    typeof item === 'string' || typeof item === 'number' ? String(item) : '';
  return (
    <div className="live-review-context">
      <p>
        Shared selection: {value(snapshot?.title)} · {value(part.label)}
      </p>
      <p>{value(part.detail)}</p>
      {'value' in part && (
        <p>
          Original: {part.value === null ? 'Not available' : value(part.value)} {value(part.unit)} ·{' '}
          {value(part.period)}. Hypothetical change: {value(snapshot?.scenarioPercent)}%.
        </p>
      )}
      <details>
        <summary>Inspect the exact shared snapshot</summary>
        <pre>{JSON.stringify(snapshot, null, 2)}</pre>
      </details>
      <p>
        This snapshot stays fixed after approval. No profile, memory, unrelated history or image
        pixels are included. No search or write tools are available.
      </p>
    </div>
  );
}
