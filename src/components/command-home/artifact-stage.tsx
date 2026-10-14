'use client';
import { useState } from 'react';
import Link from 'next/link';
import { isolateStaticHtml } from '@/domains/architect-origin/static-preview';
import { PREVIEW_SANDBOX } from '@/domains/architect-origin/preview-contract';
import { sourceLabel, type CommandArtifact, type CommandItem } from '@/domains/command-home/model';

export function CommandArtifactStage({
  selected,
  artifact,
}: {
  selected: CommandItem | null;
  artifact: CommandArtifact;
}) {
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const artifactKey = `${selected?.key ?? 'none'}:${artifact.imageHref ?? ''}:${artifact.htmlPreview ? 'html' : 'text'}`;
  const showPreview = previewFor === artifactKey;
  const imageFailed = failedFor === artifactKey;

  const isolated =
    showPreview && artifact.htmlPreview ? isolateStaticHtml(artifact.htmlPreview) : null;

  return (
    <section className="command-stage" aria-labelledby="command-stage-title">
      <header>
        <p className="eyebrow">
          {selected ? `${sourceLabel(selected.source)} · ${selected.status}` : 'Saved work'}
        </p>
        <h2 id="command-stage-title">{artifact.title}</h2>
        <p className="command-provenance">{artifact.provenance}</p>
      </header>
      {artifact.imageHref && !imageFailed ? (
        // Authorized account image route. Home never starts a running Studio session.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className="command-artifact-image"
          src={artifact.imageHref}
          alt=""
          onError={() => setFailedFor(artifactKey)}
        />
      ) : artifact.excerpt ? (
        <div className="command-artifact-excerpt">
          <pre>{artifact.excerpt}</pre>
        </div>
      ) : (
        <p className="command-artifact-fallback">{artifact.fallback}</p>
      )}
      {imageFailed && (
        <p className="command-artifact-fallback" role="status">
          The saved image could not be opened. The link may have expired or access was revoked.
        </p>
      )}
      {isolated && (
        <iframe
          className="command-artifact-preview"
          title="Saved isolated preview"
          sandbox={PREVIEW_SANDBOX}
          srcDoc={isolated.srcDoc}
        />
      )}
      <div className="command-stage-actions">
        {selected && (
          <Link className="command-action" href={selected.resumeHref}>
            {selected.source === 'talk' ? 'Resume conversation' : 'Continue / Review'}
          </Link>
        )}
        {selected?.resumeLimitation && <small>{selected.resumeLimitation}</small>}
        {artifact.htmlPreview && (
          <button
            type="button"
            className="text-button"
            onClick={() => setPreviewFor((value) => (value === artifactKey ? null : artifactKey))}
          >
            {showPreview ? 'Hide saved preview' : 'Show saved preview'}
          </button>
        )}
      </div>
    </section>
  );
}
