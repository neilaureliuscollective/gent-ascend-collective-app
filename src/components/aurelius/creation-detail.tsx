'use client';
import { useEffect, useMemo, useState } from 'react';
import type {
  BriefContent,
  HandoffContent,
  PaletteContent,
  PlanContent,
  TalkCreation,
  TalkImageJob,
} from '@/domains/talk-creation/schema';
import { PaletteSwatches } from './palette-swatches';
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
  onHandoff,
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
  onHandoff: (input: { idea: string; discipline: HandoffContent['discipline']; decisions: string }) => void;
  onOpenVersion?: (id: string) => void;
  onHistory?: (versions: TalkCreation[]) => void;
}) {
  const brief = creation?.kind === 'brief' ? (creation.content as BriefContent) : null;
  const plan = creation?.kind === 'plan' ? (creation.content as PlanContent) : null;
  const palette = creation?.kind === 'palette' ? (creation.content as PaletteContent) : null;
  const handoff = creation?.kind === 'handoff' ? (creation.content as HandoffContent) : null;
  const [draft, setDraft] = useState(creation?.content);
  const [idea, setIdea] = useState(
    creation && 'title' in creation.content ? creation.content.title : '',
  );
  const [decisions, setDecisions] = useState('');
  const [history, setHistory] = useState<TalkCreation[]>([]);
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
  const versions = creation?.lineage_id ? history : [];
  if (!creation && !image) return null;
  return (
    <div className="talk-creation-detail">
      <header>
        <p className="eyebrow">
          {creation
            ? `${creation.kind === 'handoff' ? 'Prepared for Architect' : creation.kind} · v${creation.version}`
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
      {handoff && (
        <p className="talk-creation-status">
          {handoff.imported
            ? 'Architect accepted this package.'
            : 'Prepared for Architect. Navigating away does not import this package.'}
        </p>
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
                  {version.superseded_by ? '' : ' · current'}
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
            <button type="button" className="text-button" disabled={busy} onClick={onSelect}>
              Keep this version
            </button>
          </>
        )}
        <button type="button" className="text-button" onClick={() => onCopy(exportText)}>
          Copy
        </button>
      </div>
      {creation && creation.kind !== 'handoff' && (
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
            This saves a reviewable package labeled Prepared for Architect. Import is shown only
            after the destination acknowledges it. Completed images:{' '}
            {images.filter((item) => item.status === 'complete').length}.
          </p>
        </div>
      )}
    </div>
  );
}
