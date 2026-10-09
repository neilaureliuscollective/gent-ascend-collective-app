'use client';
import Link from 'next/link';
import { parseWebsiteProposal, planningVersion } from '@/domains/technology/planning';
import { parseRitualSuggestion } from '@/domains/grooming/ritual-model';
import { memo } from 'react';
import { councilFromVersion, councilLabel } from '@/domains/intelligence/council';
import Markdown from 'react-markdown';
import type { Turn } from '@/domains/intelligence/types';
import type { ActionProposal } from '@/domains/intelligence/types';
import { ActionReview } from './action-review';
export const ConversationTurn = memo(function ConversationTurn({
  turn,
  onFeedback,
  disabled,
  action,
  versions,
  onCopy,
  onRevise,
  companyWork = false,
}: {
  turn: Turn;
  companyWork?: boolean;
  onFeedback?: (id: string, feedback: 'helpful' | 'needs_work') => void;
  disabled: boolean;
  action?: { proposal?: ActionProposal; onChanged: () => Promise<void> };
  versions?: Turn[];
  onCopy?: () => void;
  onRevise?: (kind: 'retry' | 'regenerate' | 'edit') => void;
}) {
  const websitePlanning = !companyWork && turn.prompt_version?.endsWith(`:${planningVersion}`);
  const website =
    websitePlanning && turn.status === 'complete'
      ? parseWebsiteProposal(turn.assistant_text)
      : null;
  const replyText = websitePlanning
    ? turn.assistant_text.replace(/```aethelios-website\s*\n[\s\S]*?(?:\n```|$)/g, '')
    : turn.assistant_text;
  const ritual =
    !companyWork && turn.status === 'complete' ? parseRitualSuggestion(turn.assistant_text) : null;
  return (
    <article className="conversation-turn">
      <div className="user-message">
        <span className="message-author">You</span>
        <p>{turn.user_text}</p>
      </div>
      <div className="assistant-message">
        <span className="message-author">
          <span className="small-orb" aria-hidden="true" />
          {councilLabel(councilFromVersion(turn.prompt_version))}
        </span>
        <div className="message-markdown">
          <Markdown
            skipHtml
            components={{
              img: () => <span>[Image omitted]</span>,
              a: ({ href, children }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  referrerPolicy="no-referrer"
                >
                  {children}
                </a>
              ),
            }}
          >
            {ritual
              ? turn.assistant_text.replace(/```grooming-ritual\s*\n[\s\S]*?```/g, '')
              : companyWork
                ? turn.assistant_text.replace(/```company-work\n[\s\S]*?\n```/g, '')
                : replyText}
          </Markdown>
        </div>
        {website && (
          <div className="ritual-chat-proposal">
            <strong>{website.name} · Proposed website</strong>
            <p>{website.headline}</p>
            <p>
              {website.services
                .map((s) => `${s.name}${s.price ? ` · ${s.price}` : ''}`)
                .join(' / ')}
            </p>
            <small>
              Suggested brief saved in this reply. Review it through the website planning controls
              before creating a project.
            </small>
          </div>
        )}
        {versions?.map((previous) => (
          <details className="message-version" key={previous.id}>
            <summary>Previous version</summary>
            <div className="message-markdown">
              <Markdown
                skipHtml
                components={companyWork ? { img: () => <span>[Image omitted]</span> } : undefined}
              >
                {(companyWork
                  ? previous.assistant_text.replace(/```company-work\n[\s\S]*?\n```/g, '')
                  : previous.assistant_text) || 'No completed reply.'}
              </Markdown>
            </div>
          </details>
        ))}
        {turn.status !== 'complete' && (
          <p className="message-state">
            {turn.status === 'pending'
              ? 'Reply in progress or interrupted. Reload to check its saved state.'
              : turn.status === 'cancelled'
                ? 'Stopped · partial reply'
                : 'Incomplete reply · not included in future conversation context'}
          </p>
        )}
        {turn.status === 'complete' && onFeedback && (
          <div className="message-feedback" aria-label="Rate this reply">
            <button
              disabled={disabled}
              aria-pressed={turn.feedback === 'helpful'}
              onClick={() => onFeedback(turn.id, 'helpful')}
            >
              Helpful
            </button>
            <button
              disabled={disabled}
              aria-pressed={turn.feedback === 'needs_work'}
              onClick={() => onFeedback(turn.id, 'needs_work')}
            >
              Needs work
            </button>
          </div>
        )}
        {ritual && (
          <div className="ritual-chat-proposal">
            <p>{ritual.title} · Proposed ritual</p>
            <Link href={`/app/grooming?ritualSuggestion=${turn.id}`}>Review routine change ↗</Link>
            <small>
              Review the steps in Presence’s grooming tools. Nothing is saved from this reply.
            </small>
          </div>
        )}
        <div className="message-tools">
          {turn.status === 'complete' && (
            <button type="button" onClick={onCopy}>
              Copy
            </button>
          )}
          {onRevise &&
            !disabled &&
            (turn.status === 'complete' ? (
              <>
                <button type="button" onClick={() => onRevise('regenerate')}>
                  Regenerate
                </button>
                <button type="button" onClick={() => onRevise('edit')}>
                  Edit and resend
                </button>
              </>
            ) : turn.status !== 'pending' ? (
              <button type="button" onClick={() => onRevise('retry')}>
                Retry reply
              </button>
            ) : null)}
        </div>
        {turn.status === 'complete' && action && (
          <ActionReview
            key={action.proposal?.id ?? 'new'}
            turnId={turn.id}
            proposal={action.proposal}
            onChanged={action.onChanged}
            disabled={disabled}
          />
        )}
      </div>
    </article>
  );
});
