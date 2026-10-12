import type { VisualSource } from '@/domains/artifacts/evidence';
import type { z } from 'zod';
import type { evidenceSchema } from '@/domains/artifacts/evidence';
export function EvidenceLinks({
  evidence,
  sources,
}: {
  evidence: z.infer<typeof evidenceSchema>;
  sources: VisualSource[];
}) {
  return (
    <div className="live-evidence">
      <span>
        {evidence.basis === 'reported'
          ? 'Source-linked extraction'
          : evidence.basis === 'inference'
            ? 'AI inference'
            : 'Not available'}
      </span>{' '}
      {evidence.sourceIds.map((id) => {
        const source = sources.find((item) => item.id === id);
        return source ? (
          <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">
            [{id}]
          </a>
        ) : null;
      })}
      {evidence.quote && (
        <details>
          <summary>Research excerpt</summary>
          <blockquote>{evidence.quote}</blockquote>
          <p>Excerpt from the returned AI research response; review the original sources.</p>
        </details>
      )}
    </div>
  );
}
