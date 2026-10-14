'use client';
import { useEffect, useMemo, useState } from 'react';
import type { ProjectContent } from '@/domains/architect-origin/schema';
import type { HandoffTransfer } from '@/domains/talk-creation/origin-import';
import type {
  BriefContent,
  HandoffContent,
  PaletteContent,
  PlanContent,
  TalkCreation,
  TalkImageJob,
} from '@/domains/talk-creation/schema';
import { PaletteSwatches } from './palette-swatches';
import { DesignBoardView } from './design-board';
import type { DesignBoardContent } from '@/domains/talk-creation/design-board';
import Image from 'next/image';
import './creation.css';

export function CreationDetail({
  creation,
  image,
  images,
  canEdit,
  busy,
  error,
  notice,
  onClose,
  onSave,
  onCopy,
  onSelect,
  onKeepProposal,
  onHandoff,
  onImport,
  onOpenVersion,
  onHistory,
}: {
  creation?: TalkCreation | null;
  image?: TalkImageJob | null;
  images: TalkImageJob[];
  canEdit: boolean;
  busy: boolean;
  error: string;
  notice: string;
  onClose: () => void;
  onSave: (kind: TalkCreation['kind'], content: unknown) => void;
  onCopy: (text: string) => void;
  onSelect: () => void;
  onKeepProposal?: () => void;
  onHandoff: (input: { idea: string; discipline: HandoffContent['discipline']; decisions: string }) => void;
  onImport?: (handoffId: string) => void;
  onOpenVersion?: (id: string) => void;
  onHistory?: (versions: TalkCreation[]) => void;
}) {
  const brief = creation?.kind === 'brief' ? (creation.content as BriefContent) : null;
  const plan = creation?.kind === 'plan' ? (creation.content as PlanContent) : null;
  const palette = creation?.kind === 'palette' ? (creation.content as PaletteContent) : null;
  const board = creation?.kind === 'board' ? (creation.content as DesignBoardContent) : null;
  const handoff = creation?.kind === 'handoff' ? (creation.content as HandoffContent) : null;
  const [draft, setDraft] = useState(creation?.content);
  const [idea, setIdea] = useState(
    creation && 'title' in creation.content ? creation.content.title : '',
  );
  const [decisions, setDecisions] = useState('');
  const [history, setHistory] = useState<TalkCreation[]>([]);
  const [review, setReview] = useState<{
    imported: boolean;
    projectId: string | null;
    originReady: boolean;
    project: ProjectContent | null;
    transfer: HandoffTransfer | null;
    selections: Array<{ kind: string; versionId: string; version: number; title: string }>;
    images: Array<{ artifactId: string; versionId: string; projectId: string }>;
    error?: string;
  } | null>(null);
  const historyCallback = onHistory;
  const exportText = useMemo(() => {
    if (image) return image.prompt;
    return JSON.stringify(draft ?? creation?.content ?? {}, null, 2);
  }, [creation, draft, image]);
  useEffect(() => {
    const lineage = creation?.lineage_id;
    if (!lineage) return;
    let ignore = false;
    void fetch(`/api/aurelius/creations?lineage=${lineage}`, { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : { versions: [] }))
      .then((body: { versions?: TalkCreation[] }) => {
        if (ignore) return;
        setHistory(body.versions ?? []);
        historyCallback?.(body.versions ?? []);
      })
      .catch(() => {
        if (!ignore) setHistory([]);
      });
    return () => {
      ignore = true;
    };
  }, [creation?.lineage_id, historyCallback]);
  useEffect(() => {
    if (creation?.kind !== 'handoff' || !creation.id) return;
    let ignore = false;
    void fetch(`/api/aurelius/creations?handoff=${creation.id}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = (await response.json()) as {
          imported?: boolean;
          projectId?: string | null;
          originReady?: boolean;
          project?: ProjectContent;
          transfer?: HandoffTransfer;
          selections?: Array<{ kind: string; versionId: string; version: number; title: string }>;
          images?: Array<{ artifactId: string; versionId: string; projectId: string }>;
          error?: string;
        };
        if (ignore) return;
        if (!response.ok || !body.project)
          setReview({
            imported: false,
            projectId: null,
            originReady: Boolean(body.originReady),
            project: null,
            transfer: null,
            selections: [],
            images: [],
            error: typeof body.error === 'string' ? body.error : 'This package could not be reviewed.',
          });
        else
          setReview({
            imported: Boolean(body.imported),
            projectId: body.projectId ?? null,
            originReady: Boolean(body.originReady),
            project: body.project,
            transfer: body.transfer ?? null,
            selections: body.selections ?? [],
            images: body.images ?? [],
          });
      })
      .catch(() => {
        if (!ignore)
          setReview({
            imported: false,
            projectId: null,
            originReady: false,
            project: null,
            transfer: null,
            selections: [],
            images: [],
            error: 'This package could not be reviewed.',
          });
      });
    return () => {
      ignore = true;
    };
  }, [creation?.id, creation?.kind]);
  const versions = creation?.lineage_id ? history : [];
  if (!creation && !image) return null;
  return (
    <div className="talk-creation-detail">
      <header>
        <p className="eyebrow">
          {creation
            ? `${creation.candidate ? 'Proposal · not applied' : creation.kind === 'handoff' ? 'Prepared for Architect' : creation.kind} · v${creation.version}`
            : `Image · ${image?.status}`}
        </p>
        <h2>{creation && 'title' in creation.content ? creation.content.title : image?.prompt.slice(0, 80)}</h2>
        <button type="button" className="text-button" onClick={onClose}>
          Close
        </button>
      </header>
      {brief && draft && 'purpose' in draft && (
        <div className="field">
          {(
            [
              ['title', 'Title'],
              ['purpose', 'Purpose'],
              ['audience', 'Audience'],
              ['visualDirection', 'Visual direction'],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                value={String(draft[key] ?? '')}
                disabled={!canEdit || busy}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              />
            </label>
          ))}
          <label>
            Requirements
            <textarea
              value={draft.requirements.join('\n')}
              disabled={!canEdit || busy}
              onChange={(event) =>
                setDraft({ ...draft, requirements: event.target.value.split('\n').filter(Boolean) })
              }
            />
          </label>
          <label>
            Unresolved decisions
            <textarea
              value={draft.unresolved.join('\n')}
              disabled={!canEdit || busy}
              onChange={(event) =>
                setDraft({ ...draft, unresolved: event.target.value.split('\n').filter(Boolean) })
              }
            />
          </label>
        </div>
      )}
      {plan && draft && 'steps' in draft && (
        <div className="field">
          <label>
            Title
            <input
              value={draft.title}
              disabled={!canEdit || busy}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            />
          </label>
          <label>
            Summary
            <textarea
              value={draft.summary}
              disabled={!canEdit || busy}
              onChange={(event) => setDraft({ ...draft, summary: event.target.value })}
            />
          </label>
          {draft.steps.map((step, index) => (
            <label key={step.id}>
              Step {index + 1}
              <textarea
                value={`${step.title}\n${step.detail}`}
                disabled={!canEdit || busy}
                onChange={(event) => {
                  const [title = '', ...rest] = event.target.value.split('\n');
                  const steps = draft.steps.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, title, detail: rest.join('\n') } : item,
                  );
                  setDraft({ ...draft, steps });
                }}
              />
            </label>
          ))}
        </div>
      )}
      {palette && draft && 'swatches' in draft && (
        <PaletteSwatches
          palette={draft}
          detailed
          canEdit={canEdit && !busy}
          onChange={(next) => setDraft(next)}
        />
      )}
      {board && draft && 'directions' in draft && (
        <>
          <DesignBoardView
            board={draft as DesignBoardContent}
            editable={canEdit && !busy}
            expanded
            onChange={(next) => setDraft(next)}
            onCommit={(next) => onSave('board', next)}
          />
          <p className="talk-creation-status" data-adapter="local-test">
            Architect has not published the design-direction receiver. This board stays in Talk.
            v1 text import remains available for brief, plan and palette. Transfer is not complete.
          </p>
        </>
      )}
      {handoff && (
        <div className="talk-origin-review">
          <p className="talk-creation-status">
            {handoff.imported || review?.imported
              ? 'Saved in Architect. This Talk package is linked to that project.'
              : 'Prepared for Architect. Review the project below, then create it. An existing unsent Architect draft is left untouched.'}
          </p>
          {review?.error && <p role="alert">{review.error}</p>}
          {review?.project && (
            <dl className="talk-origin-preview">
              <div>
                <dt>Project name</dt>
                <dd>{review.project.name}</dd>
              </div>
              <div>
                <dt>Discipline</dt>
                <dd>{review.project.discipline}</dd>
              </div>
              <div>
                <dt>Vision</dt>
                <dd>{review.project.blueprint.vision || handoff.idea}</dd>
              </div>
              {review.transfer && (
                <>
                  <div>
                    <dt>Copied into Architect</dt>
                    <dd>
                      {review.transfer.copied.length
                        ? review.transfer.copied
                            .map(
                              (field) =>
                                `${field.into} from ${field.from}${field.truncated ? ' (truncated)' : ''}`,
                            )
                            .join('; ')
                        : 'None.'}
                    </dd>
                  </div>
                  <div>
                    <dt>Referenced in Talk only</dt>
                    <dd>
                      {review.transfer.referenced.length
                        ? review.transfer.referenced
                            .map((asset) =>
                              asset.kind === 'image'
                                ? `image ${asset.artifactId} (pixels not copied)`
                                : `${asset.kind} v${asset.version} ${asset.title ?? asset.versionId}`,
                            )
                            .join('; ')
                        : 'None.'}{' '}
                      Palette roles, contrast pairs and images stay in Talk.
                    </dd>
                  </div>
                </>
              )}
              {review.selections.map((item) => (
                <div key={item.versionId}>
                  <dt>
                    {item.kind} v{item.version}
                  </dt>
                  <dd>
                    <button
                      type="button"
                      className="text-button"
                      onClick={() => onOpenVersion?.(item.versionId)}
                    >
                      Open {item.title}
                    </button>
                  </dd>
                </div>
              ))}
              {review.images.map((image) => (
                <div key={image.artifactId}>
                  <dt>Selected image</dt>
                  <dd>
                    Version {image.versionId}. Referenced from Talk only; not inserted into the Origin
                    project.
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {(handoff.imported || review?.imported) && (handoff.originProjectId || review?.projectId) ? (
            <a
              className="button"
              href={`/app/architect?project=${handoff.originProjectId ?? review?.projectId}`}
            >
              Open saved Architect project
            </a>
          ) : (
            <button
              type="button"
              className="button"
              disabled={busy || !creation || !review?.project || !review.originReady}
              onClick={() => creation && onImport?.(creation.id)}
            >
              Create Architect project
            </button>
          )}
          {!review?.imported && review && !review.originReady && !review.error && (
            <p className="quiet-label">
              Architect persistence is unavailable. The package stays prepared and was not imported.
            </p>
          )}
        </div>
      )}
      {image?.status === 'complete' && image.version_id && (
        <Image
          className="talk-creation-image"
          alt=""
          src={`/api/studio/image?id=${image.version_id}&kind=version`}
          width={1024}
          height={1024}
          unoptimized
        />
      )}
      {versions.length > 1 && (
        <details className="talk-creation-history">
          <summary>Saved versions</summary>
          <ol>
            {versions.map((version) => (
              <li key={version.id}>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy || version.id === creation?.id}
                  onClick={() => onOpenVersion?.(version.id)}
                >
                  v{version.version}
                  {version.id === creation?.id ? ' · this version' : ''}
                  {version.candidate ? ' · proposal' : version.superseded_by ? '' : ' · current'}
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}
      {error && <p role="alert">{error}</p>}
      {notice && <p className="talk-creation-status">{notice}</p>}
      <div className="talk-creation-actions">
        {creation && creation.kind !== 'handoff' && (
          <>
            <button
              type="button"
              className="button"
              disabled={!canEdit || busy}
              onClick={() => creation && draft && onSave(creation.kind, draft)}
            >
              Save new version
            </button>
            {creation.candidate ? (
              <button type="button" className="button" disabled={!canEdit || busy} onClick={onKeepProposal}>
                Keep as new version
              </button>
            ) : (
              <button type="button" className="text-button" disabled={busy} onClick={onSelect}>
                Keep this version
              </button>
            )}
          </>
        )}
        <button type="button" className="text-button" onClick={() => onCopy(exportText)}>
          Copy
        </button>
      </div>
      {creation && creation.kind !== 'handoff' && !creation.candidate && (
        <div className="field">
          <label>
            Architect idea
            <textarea value={idea} onChange={(event) => setIdea(event.target.value)} />
          </label>
          <label>
            Reviewed decisions
            <textarea value={decisions} onChange={(event) => setDecisions(event.target.value)} />
          </label>
          <button
            type="button"
            className="button"
            disabled={busy || !idea.trim()}
            onClick={() => onHandoff({ idea, discipline: 'business', decisions })}
          >
            Prepare for Architect
          </button>
          <p className="quiet-label">
            This saves a reviewable package from one selected brief, plan or palette of each kind.
            Creating the Architect project happens only after you review and confirm it. Completed
            images: {images.filter((item) => item.status === 'complete').length}.
          </p>
        </div>
      )}
    </div>
  );
}
