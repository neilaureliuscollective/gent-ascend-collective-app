'use client';
import Image from 'next/image';
import type { TalkCreation, TalkImageJob } from '@/domains/talk-creation/schema';
import { PaletteSwatches } from './palette-swatches';
import './creation.css';

export function CreationCard({
  creation,
  selected,
  onOpen,
}: {
  creation: TalkCreation;
  selected?: boolean;
  onOpen: (id: string) => void;
}) {
  const title = 'title' in creation.content ? creation.content.title : creation.kind;
  const kind =
    creation.kind === 'brief'
      ? 'Brief'
      : creation.kind === 'plan'
        ? 'Plan'
        : creation.kind === 'palette'
          ? 'Palette'
          : 'Architect package';
  return (
    <article className="talk-creation-card" data-kind={creation.kind} data-selected={selected || undefined}>
      <header>
        <p className="eyebrow">
          {creation.candidate ? 'Proposal · not applied' : `${kind} · v${creation.version}`}
          {selected && !creation.candidate ? ' · selected' : ''}
        </p>
      </header>
      <h3>{title}</h3>
      {creation.kind === 'brief' && 'purpose' in creation.content && (
        <p>{creation.content.purpose || 'Purpose still open.'}</p>
      )}
      {creation.kind === 'plan' && 'summary' in creation.content && <p>{creation.content.summary}</p>}
      {creation.kind === 'palette' && 'swatches' in creation.content && (
        <PaletteSwatches palette={creation.content} />
      )}
      {creation.candidate && (
        <p className="talk-creation-status">
          A newer version was already saved. Review this proposal before keeping it.
        </p>
      )}
      {creation.kind === 'handoff' && 'imported' in creation.content && (
        <p className="talk-creation-status">
          {creation.content.imported
            ? 'Architect accepted this package.'
            : 'Prepared for Architect. Import is pending the destination contract.'}
        </p>
      )}
      <div className="talk-creation-actions">
        <button type="button" className="text-button" onClick={() => onOpen(creation.id)}>
          Open
        </button>
      </div>
    </article>
  );
}

export function TalkImageCard({
  image,
  selected,
  canApprove,
  busy,
  onOpen,
  onApprove,
  onSelect,
}: {
  image: TalkImageJob;
  selected?: boolean;
  canApprove: boolean;
  busy: boolean;
  onOpen: (id: string) => void;
  onApprove: (id: string, approve: boolean) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <article className="talk-creation-card" data-kind="image" data-selected={selected || undefined}>
      <header>
        <p className="eyebrow">
          Image · {image.operation === 'image.edit' ? 'edit' : 'create'} · {image.status}
          {selected ? ' · selected' : ''}
        </p>
      </header>
      <h3>{image.prompt.slice(0, 80)}</h3>
      <p className="talk-creation-status">
        {image.status === 'approval'
          ? 'Queued for your approval. Studio usage is reserved only after you confirm cost.'
          : image.status === 'running'
            ? 'Generating the image through Studio.'
            : image.status === 'complete'
              ? 'Saved in Studio.'
              : image.status === 'uncertain'
                ? 'Completion is unverified. Retrying would risk a second paid job.'
                : image.status === 'failed'
                  ? 'Generation failed. The reservation was consumed.'
                  : 'Declined.'}
      </p>
      {image.status === 'complete' && image.version_id && (
        <Image
          className="talk-creation-image"
          alt=""
          src={`/api/studio/image?id=${image.version_id}&kind=version`}
          width={1024}
          height={1024}
          unoptimized
        />
      )}
      <div className="talk-creation-actions">
        {image.status === 'approval' && canApprove && (
          <>
            <button type="button" className="button" disabled={busy} onClick={() => onApprove(image.id, true)}>
              Approve and generate
            </button>
            <button type="button" className="text-button" disabled={busy} onClick={() => onApprove(image.id, false)}>
              Decline
            </button>
          </>
        )}
        {image.status === 'complete' && (
          <button type="button" className="text-button" disabled={busy} onClick={() => onSelect(image.id)}>
            {selected ? 'Selected for edits' : 'Use for edits'}
          </button>
        )}
        <button type="button" className="text-button" onClick={() => onOpen(image.id)}>
          Open
        </button>
      </div>
    </article>
  );
}
