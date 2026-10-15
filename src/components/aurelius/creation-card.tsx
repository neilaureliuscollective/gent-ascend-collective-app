'use client';
import Image from 'next/image';
import type { TalkCreation, TalkImageJob } from '@/domains/talk-creation/schema';
import { PaletteSwatches } from './palette-swatches';
import { DesignBoardView } from './design-board';
import type { DesignBoardContent } from '@/domains/talk-creation/design-board';
import type { StreamCreation } from '@/domains/intelligence/types';
import {
  conversationArtifactReady,
  conversationArtifactTerminal,
} from '@/platform/visual/conversation-motion';
import './creation.css';

const kindLabel = (kind: StreamCreation['kind']) =>
  kind === 'brief'
    ? 'Brief'
    : kind === 'plan'
      ? 'Plan'
      : kind === 'palette'
        ? 'Palette'
        : kind === 'board'
          ? 'Design board'
          : kind === 'image'
            ? 'Image'
            : 'Architect package';

function inFlightEyebrow(artifact: StreamCreation): string {
  if (artifact.status === 'approval') return 'needs approval';
  if (artifact.status === 'stopped') return 'stopped';
  if (artifact.status === 'failed') return 'failed';
  if (artifact.status === 'uncertain') return 'unconfirmed';
  if (conversationArtifactReady(artifact)) return 'ready';
  return 'in progress';
}

function inFlightBody(artifact: StreamCreation): string {
  const kind = kindLabel(artifact.kind);
  if (artifact.kind === 'image') {
    if (artifact.status === 'approval')
      return 'Queued for your approval. It is not a saved image yet.';
    if (artifact.status === 'running' || artifact.status === 'generating') return 'Creating an image';
    if (artifact.status === 'stopped') return 'Image stopped.';
    if (artifact.status === 'failed') return 'Image could not be completed.';
    if (artifact.status === 'uncertain') return 'Image completion is unconfirmed.';
    if (conversationArtifactReady(artifact)) return 'Image is ready.';
    return 'Image proposal received.';
  }
  if (artifact.status === 'stopped') return `${kind} stopped.`;
  if (artifact.status === 'failed') return `${kind} could not be completed.`;
  if (artifact.status === 'uncertain') return `${kind} completion is unconfirmed.`;
  if (conversationArtifactReady(artifact)) return `${kind} is ready.`;
  return `${kind} is being prepared.`;
}

export function InFlightCreationCard({ artifact }: { artifact: StreamCreation }) {
  const title = artifact.title?.trim() || kindLabel(artifact.kind);
  const ready = conversationArtifactReady(artifact);
  const terminal = conversationArtifactTerminal(artifact.status);
  return (
    <article
      className={`talk-creation-card${ready || terminal ? '' : ' is-active'}`}
      data-kind={artifact.kind}
      data-in-flight=""
      data-status={artifact.status || 'proposed'}
      data-ready={ready || undefined}
    >
      <header>
        <p className="eyebrow">
          {kindLabel(artifact.kind)} · {inFlightEyebrow(artifact)}
        </p>
      </header>
      <h3>{title}</h3>
      <p className="talk-creation-status">{inFlightBody(artifact)}</p>
    </article>
  );
}

export function CreationCard({
  creation,
  selected,
  onOpen,
  onBoardCommit,
  boardStatus,
}: {
  creation: TalkCreation;
  selected?: boolean;
  onOpen: (id: string) => void;
  onBoardCommit?: (id: string, board: DesignBoardContent) => void;
  boardStatus?: 'pending' | 'saved' | 'failed' | 'stale';
}) {
  const title = 'title' in creation.content ? creation.content.title : creation.kind;
  const kind =
    creation.kind === 'brief'
      ? 'Brief'
      : creation.kind === 'plan'
        ? 'Plan'
        : creation.kind === 'palette'
          ? 'Palette'
          : creation.kind === 'board'
            ? 'Design board'
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
      {creation.kind === 'board' && 'directions' in creation.content && (
        <>
          <DesignBoardView
            board={creation.content as DesignBoardContent}
            editable={Boolean(onBoardCommit)}
            onCommit={
              onBoardCommit ? (next) => onBoardCommit(creation.id, next) : undefined
            }
          />
          {boardStatus && boardStatus !== 'saved' && (
            <p className="talk-creation-status" data-board-status={boardStatus}>
              {boardStatus === 'pending'
                ? 'Saving the selected direction…'
                : boardStatus === 'stale'
                  ? 'This board changed. Reload the saved work before selecting again.'
                  : 'The selected direction could not be saved.'}
            </p>
          )}
        </>
      )}
      {creation.candidate && (
        <p className="talk-creation-status">
          A newer version was already saved. Review this proposal before keeping it.
        </p>
      )}
      {creation.kind === 'handoff' && 'imported' in creation.content && (
        <p className="talk-creation-status">
          {creation.content.imported
            ? 'Saved in Architect.'
            : 'Prepared for Architect. Review the package, then create the project.'}
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
    <article
      className={`talk-creation-card${image.status === 'running' || image.status === 'approval' ? ' is-active' : ''}`}
      data-kind="image"
      data-selected={selected || undefined}
      data-ready={image.status === 'complete' && image.version_id ? '' : undefined}
    >
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
