'use client';
import { useEffect, useState } from 'react';
import { DirectionCanvas } from '@/components/aurelius/design-board';
import { designDirectionSchema, type DesignDirection } from '@/domains/talk-creation/design-board';

type Snapshot = { product: string; direction: DesignDirection; version: number; digest: string };
/** Read-only receipt. Opening the build workspace never starts generation or a worker. */
export function RetainedDesign({
  projectId,
  onContinue,
}: {
  projectId: string;
  onContinue: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/architect-design-direction?project=${projectId}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok)
          throw new Error('The retained design could not be read. Retry before continuing.');
        const body = await response.json();
        const receipt = body.direction?.receipt;
        const saved = receipt?.content?.designSnapshot;
        if (!saved) {
          setSnapshot(null);
          setError('');
          return;
        }
        const direction = designDirectionSchema.parse(saved.direction);
        setSnapshot({
          product: saved.product,
          direction,
          version: receipt.identity.boardVersion,
          digest: body.direction.digest,
        });
        setError('');
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Retained design unavailable.');
      });
    return () => controller.abort();
  }, [projectId, attempt]);
  if (error)
    return (
      <aside role="alert" className="origin-notice">
        <p>{error}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>
          Retry design read
        </button>
      </aside>
    );
  if (!snapshot) return null;
  return (
    <section className="talk-retained-design" aria-label="Retained creative direction">
      <p className="eyebrow">Received · awaiting build approval</p>
      <h2>{snapshot.direction.name}</h2>
      <DirectionCanvas direction={snapshot.direction} product={snapshot.product} />
      <p>
        Your selected design is retained. Review the build brief next; generation and execution
        require their existing approvals.
      </p>
      <button type="button" className="button" onClick={onContinue}>
        Review build brief
      </button>
      <details>
        <summary>Details</summary>
        <p>Exact Talk source v{snapshot.version}</p>
        <code style={{ overflowWrap: 'anywhere' }}>{snapshot.digest}</code>
      </details>
    </section>
  );
}
