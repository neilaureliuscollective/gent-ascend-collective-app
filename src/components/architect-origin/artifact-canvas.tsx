import {
  previewCaption,
  type PreviewDecision,
  type TrustedPreview,
} from '@/domains/architect-origin/preview-contract';
import { isolateStaticHtml } from '@/domains/architect-origin/static-preview';
import ReactMarkdown from 'react-markdown';
import { useMemo } from 'react';

const markdownComponents = { img: () => <span>[External image omitted]</span> };

export function ArtifactCanvas({
  decision,
  stale,
  title,
}: {
  decision: PreviewDecision | null;
  stale?: boolean;
  title?: string;
}) {
  if (!decision || decision.kind === 'unavailable') {
    return (
      <div className="origin-artifact origin-artifact-empty" aria-label="Artifact canvas">
        <p className="origin-kicker">Artifact</p>
        <h3>{title || 'Your work takes shape here'}</h3>
        <p>
          {decision?.reason ||
            'No compatible website artifact is attached yet. Origin documents and the approved brief remain available. A running application preview requires Construct execution.'}
        </p>
      </div>
    );
  }
  return (
    <div className="origin-artifact" aria-label="Artifact canvas">
      <p className="origin-artifact-caption">{previewCaption(decision, { stale })}</p>
      {decision.srcDoc ? (
        <IsolatedFrame preview={decision} />
      ) : (
        <article className="origin-artifact-markdown" aria-label="Isolated document artifact">
          <ReactMarkdown skipHtml components={markdownComponents}>
            {decision.markdown || ''}
          </ReactMarkdown>
        </article>
      )}
    </div>
  );
}

function IsolatedFrame({ preview }: { preview: TrustedPreview }) {
  const isolated = useMemo(() => isolateStaticHtml(preview.srcDoc || ''), [preview.srcDoc]);
  return (
    <iframe
      title={
        preview.labelledDemonstration
          ? 'Labelled demonstration preview'
          : 'Isolated artifact preview'
      }
      className="origin-artifact-frame"
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={isolated.srcDoc}
    />
  );
}
