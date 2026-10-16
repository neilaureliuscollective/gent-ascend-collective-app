'use client';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
import { creationTitle } from '@/domains/talk-creation/schema';
import { PaletteSwatches } from './palette-swatches';
import { DesignBoardView } from './design-board';
import { premiumDirectionTransferBlocker, type DesignBoardContent } from '@/domains/talk-creation/design-board';
import {
  compileTalkDocument,
  compareTalkRevisions,
  describeTalkDestination,
  exportTalkDocument,
  talkDocumentViews,
} from '@/domains/work-items';
import Image from 'next/image';
import ReactMarkdown from 'react-markdown';
import './creation.css';

function FieldTarget({
  field,
  label,
  targetField,
  onTargetField,
}: {
  field: string;
  label: string;
  targetField?: string | null;
  onTargetField?: (field: string | null) => void;
}) {
  return (
    <span className="talk-field-heading">
      {label}
      {onTargetField ? (
        <button
          type="button"
          className="text-button"
          aria-pressed={targetField === field}
          onClick={() => onTargetField(targetField === field ? null : field)}
        >
          Change {label}
        </button>
      ) : null}
    </span>
  );
}

const markdownGuards = {
  img: () => null,
  a: ({ href, children }: { href?: string; children?: ReactNode }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

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
  targetField = null,
  onTargetField,
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
  targetField?: string | null;
  onTargetField?: (field: string | null) => void;
}) {
  const brief = creation?.kind === 'brief' ? (creation.content as BriefContent) : null;
  const plan = creation?.kind === 'plan' ? (creation.content as PlanContent) : null;
  const palette = creation?.kind === 'palette' ? (creation.content as PaletteContent) : null;
  const board = creation?.kind === 'board' ? (creation.content as DesignBoardContent) : null;
  const directionTransferBlocker = board ? premiumDirectionTransferBlocker(board) : null;
  const handoff = creation?.kind === 'handoff' ? (creation.content as HandoffContent) : null;
  const [draft, setDraft] = useState(creation?.content);
  const [idea, setIdea] = useState(
    creation && 'title' in creation.content ? creation.content.title : '',
  );
  const [decisions, setDecisions] = useState('');
  const [history, setHistory] = useState<TalkCreation[]>([]);
  const [directionReview, setDirectionReview] = useState<{
    receipt?: { digest: string; content: { name: string; summary: string; copy: { title: string } } };
    unsupported: string[];
    imported: boolean;
    projectId: string | null;
    requestId: string | null;
    digest?: string;
    boardVersion?: number;
    selectedDirectionId?: string;
    selectedDirectionName?: string;
    destinationValid?: boolean;
    error?: string;
  } | null>(null);
  const [directionBusy, setDirectionBusy] = useState<'review' | 'transfer' | null>(null);
  const [directionRequestId] = useState(() => crypto.randomUUID());
  const [documentView, setDocumentView] = useState<(typeof talkDocumentViews)[number]>('Preview');
  const [compareId, setCompareId] = useState<string | null>(null);
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
  const documentExport = useMemo(
    () => (creation ? exportTalkDocument(creation.kind, draft ?? creation.content) : null),
    [creation, draft],
  );
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
      {(brief || plan) && (
        <div className="talk-document-views" role="group" aria-label="Document view">
          {talkDocumentViews.map((view) => (
            <button
              key={view}
              type="button"
              className="text-button"
              aria-pressed={documentView === view}
              onClick={() => setDocumentView(view)}
            >
              {view}
            </button>
          ))}
        </div>
      )}
      <div
        className="talk-document-split"
        data-view={(brief || plan) ? documentView.toLowerCase() : undefined}
      >
      {brief && draft && 'purpose' in draft && documentView !== 'Preview' && (
        <div className="field">
          {(
            [
              ['title', 'Title'],
              ['purpose', 'Purpose'],
              ['audience', 'Audience'],
              ['visualDirection', 'Visual direction'],
            ] as const
          ).map(([key, label]) => (
            <div key={key} className="field">
              <FieldTarget
                field={key}
                label={label}
                targetField={targetField}
                onTargetField={onTargetField}
              />
              <textarea
                aria-label={label}
                value={String(draft[key] ?? '')}
                disabled={!canEdit || busy}
                onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
              />
            </div>
          ))}
          <div className="field">
            <FieldTarget
              field="requirements"
              label="Requirements"
              targetField={targetField}
              onTargetField={onTargetField}
            />
            <textarea
              aria-label="Requirements"
              value={draft.requirements.join('\n')}
              disabled={!canEdit || busy}
              onChange={(event) =>
                setDraft({ ...draft, requirements: event.target.value.split('\n').filter(Boolean) })
              }
            />
          </div>
          <div className="field">
            <FieldTarget
              field="unresolved"
              label="Unresolved decisions"
              targetField={targetField}
              onTargetField={onTargetField}
            />
            <textarea
              aria-label="Unresolved decisions"
              value={draft.unresolved.join('\n')}
              disabled={!canEdit || busy}
              onChange={(event) =>
                setDraft({ ...draft, unresolved: event.target.value.split('\n').filter(Boolean) })
              }
            />
          </div>
        </div>
      )}
      {plan && draft && 'steps' in draft && documentView !== 'Preview' && (
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
      {(brief || plan) && creation && documentView !== 'Edit' && (
        <article className="talk-document-preview" aria-label="Document preview">
          <ReactMarkdown components={markdownGuards}>
            {compileTalkDocument(creation.kind, draft ?? creation.content) ?? ''}
          </ReactMarkdown>
        </article>
      )}
      </div>
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
          <div className="talk-origin-review">
            {directionTransferBlocker && <p role="status">{directionTransferBlocker}</p>}
            <p className="talk-creation-status" data-adapter="talk-architect-direction">
              {creation
                ? describeTalkDestination({
                    kind: 'architect-direction',
                    sourceId: creation.id,
                    sourceKind: 'board',
                    sourceVersion: directionReview?.boardVersion ?? creation.version,
                    sourceTitle: directionReview?.selectedDirectionName ?? creationTitle(creation),
                    destination: 'Private Architect project',
                    unsupported: directionReview?.unsupported ?? [],
                    status: directionReview?.imported
                      ? 'ready'
                      : directionReview?.receipt
                        ? 'reviewable'
                        : 'unavailable',
                    snapshotBound: Boolean(directionReview?.imported || directionReview?.digest),
                  })
                : null}
            </p>
            <p className="talk-creation-status">
              {directionBusy === 'review'
                ? 'Reviewing the selected direction. Chat stays usable.'
                : directionBusy === 'transfer'
                  ? 'Confirming transfer. Chat stays usable.'
                  : directionReview?.imported
                    ? 'Received in Architect. Build approval is still required.'
                    : directionReview?.receipt && directionReview.destinationValid === false
                      ? 'A previous Talk receipt has no matching Architect destination. Review again.'
                      : directionReview?.receipt
                        ? 'Reviewed. Confirm only this version and direction. Chat stays usable.'
                        : 'Review the selected direction first. Confirm writes only after Architect retains it.'}
            </p>
            {directionReview?.unsupported?.map((item) => (
              <p key={item} className="talk-creation-status">
                {item}
              </p>
            ))}
            {directionReview?.receipt && (
              <dl className="talk-origin-preview">
                <div>
                  <dt>Selected direction</dt>
                  <dd>
                    {directionReview.selectedDirectionName ?? directionReview.receipt.content.name} · v
                    {directionReview.boardVersion ?? creation?.version}
                  </dd>
                </div>
                <div>
                  <dt>Destination</dt>
                  <dd>Private Architect project for this exact reviewed version</dd>
                </div>
                <div>
                  <dt>Transfers</dt>
                  <dd>
                    Mapped color roles, display/body tokens, layout tokens, approved copy and labelled
                    asset references.
                  </dd>
                </div>
                <div>
                  <dt>Stays in Talk</dt>
                  <dd>
                    Typeface names, scale, shape, material, surface and border roles, and unprovided image pixels remain in Talk for this historical transfer.
                  </dd>
                </div>
                <div>
                  <dt>Digest</dt>
                  <dd className="talk-direction-digest">{directionReview.receipt.digest}</dd>
                </div>
              </dl>
            )}
            {directionReview?.error && <p role="alert">{directionReview.error}</p>}
            <button
              type="button"
              className="button"
              disabled={!creation || directionBusy !== null || Boolean(directionReview?.imported) || Boolean(directionTransferBlocker)}
              onClick={() => {
                if (!creation) return;
                setDirectionBusy('review');
                void (async () => {
                  try {
                    const reviewed = await fetch(`/api/aurelius/creations?direction=${creation.id}`, {
                      cache: 'no-store',
                    });
                    const body = (await reviewed.json()) as {
                      receipt?: {
                        digest: string;
                        content: { name: string; summary: string; copy: { title: string } };
                      };
                      unsupported?: string[];
                      imported?: boolean;
                      destinationValid?: boolean;
                      projectId?: string | null;
                      requestId?: string | null;
                      digest?: string;
                      boardVersion?: number;
                      selectedDirectionId?: string;
                      selectedDirectionName?: string;
                      error?: string;
                    };
                    if (!reviewed.ok || !body.receipt) {
                      setDirectionReview({
                        unsupported: body.unsupported ?? [],
                        imported: false,
                        projectId: null,
                        requestId: null,
                        destinationValid: false,
                        error: body.error ?? 'This design could not be reviewed.',
                      });
                      return;
                    }
                    setDirectionReview({
                      receipt: body.receipt,
                      unsupported: body.unsupported ?? [],
                      imported: Boolean(body.imported),
                      destinationValid: Boolean(body.destinationValid),
                      projectId: body.projectId ?? null,
                      requestId: body.requestId ?? directionRequestId,
                      digest: body.digest ?? body.receipt.digest,
                      boardVersion: body.boardVersion,
                      selectedDirectionId: body.selectedDirectionId,
                      selectedDirectionName: body.selectedDirectionName,
                    });
                  } finally {
                    setDirectionBusy(null);
                  }
                })();
              }}
            >
              {directionReview?.imported ? 'Imported' : directionBusy === 'review' ? 'Reviewing…' : 'Review design transfer'}
            </button>
            {directionReview?.receipt && !directionReview.imported && (
              <button
                type="button"
                className="button"
                disabled={!creation || !directionReview.digest || directionBusy !== null}
                onClick={() => {
                  if (!creation || !directionReview.digest) return;
                  setDirectionBusy('transfer');
                  void (async () => {
                    const requestId = directionReview.requestId ?? directionRequestId;
                    try {
                      const transferred = await fetch('/api/aurelius/creations', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          action: 'transfer-direction',
                          id: requestId,
                          conversationId: creation.conversation_id,
                          boardId: creation.id,
                          reviewedDigest: directionReview.digest,
                        }),
                      });
                      const result = (await transferred.json()) as {
                        imported?: boolean;
                        projectId?: string;
                        digest?: string;
                        error?: string;
                      };
                      if (!transferred.ok || !result.imported)
                        setDirectionReview({
                          ...directionReview,
                          imported: false,
                          destinationValid: false,
                          projectId: null,
                          requestId,
                          error:
                            result.error ??
                            (/changed|review/i.test(result.error ?? '')
                              ? 'This design changed. Review it again before transfer.'
                              : 'Architect did not acknowledge this direction.'),
                        });
                      else
                        setDirectionReview({
                          ...directionReview,
                          imported: true,
                          destinationValid: true,
                          projectId: result.projectId ?? null,
                          requestId,
                          error: undefined,
                        });
                    } catch {
                      setDirectionReview({
                        ...directionReview,
                        imported: false,
                        requestId,
                        error:
                          'The destination may already be saved. Confirm again to recover the receipt.',
                      });
                    } finally {
                      setDirectionBusy(null);
                    }
                  })();
                }}
              >
                {directionBusy === 'transfer' ? 'Confirming…' : 'Confirm transfer'}
              </button>
            )}
            {directionReview?.imported && directionReview.projectId && (
              <a className="button" href={`/app/architect?project=${directionReview.projectId}`}>
                Open in Architect
              </a>
            )}
          </div>
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
          {creation && (
            <div className="talk-revision-compare">
              <label>
                Compare with
                <select
                  value={compareId ?? ''}
                  onChange={(event) => setCompareId(event.target.value || null)}
                >
                  <option value="">Choose a saved version</option>
                  {versions
                    .filter((version) => version.id !== creation.id)
                    .map((version) => (
                      <option key={version.id} value={version.id}>
                        v{version.version}
                      </option>
                    ))}
                </select>
              </label>
              {compareId
                ? compareTalkRevisions(
                    versions.find((version) => version.id === compareId)?.content,
                    draft ?? creation.content,
                  ).map((change) => (
                    <p key={change.field} className="talk-revision-change">
                      {change.field}: “{change.from || 'empty'}” → “{change.to || 'empty'}”
                    </p>
                  ))
                : null}
              {compareId &&
              !compareTalkRevisions(
                versions.find((version) => version.id === compareId)?.content,
                draft ?? creation.content,
              ).length ? (
                <p className="quiet-label">These versions match.</p>
              ) : null}
            </div>
          )}
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
          Copy JSON
        </button>
        {documentExport && (
          <a
            className="text-button"
            href={`data:${documentExport.mime};charset=utf-8,${encodeURIComponent(documentExport.body)}`}
            download={documentExport.filename}
          >
            {documentExport.label}
          </a>
        )}
        <button type="button" className="text-button" onClick={() => window.print()}>
          Print / PDF
        </button>
        {image?.status === 'complete' && image.version_id && (
          <a className="text-button" href={`/api/studio/image?id=${image.version_id}&kind=version`} download>
            Download image
          </a>
        )}
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
