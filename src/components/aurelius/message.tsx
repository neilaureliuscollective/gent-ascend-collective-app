'use client';
import Link from 'next/link';
import { parseRitualSuggestion } from '@/domains/grooming/ritual-model';
import { memo } from 'react';
import { councilFromVersion, councilLabel } from '@/domains/intelligence/council';
import Markdown from 'react-markdown';
import type { Turn } from '@/domains/intelligence/types';
import type { ActionProposal } from '@/domains/intelligence/types';
import { ActionReview } from './action-review';
import { IntelligenceResponse } from '@/components/intelligence-motion/presence';
import type { IntelligenceOperation } from '@/platform/visual/intelligence-motion';
import type { StreamCreation } from '@/domains/intelligence/types';
import type { TalkCreation, TalkImageJob } from '@/domains/talk-creation/schema';
import { CreationCard, TalkImageCard, InFlightCreationCard } from './creation-card';
import { stripCreationFences } from '@/domains/talk-creation/intent';
import { stabilizeStreamingMarkdown } from './stream-markdown';

// Stable saved answers do not reparse Markdown when the composer or active turn updates.
const ReplyMarkdown = memo(function ReplyMarkdown({ text }: { text: string }) {
  return (
    <Markdown
      skipHtml
      components={{
        img: () => <span>[Image omitted]</span>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">
            {children}
          </a>
        ),
      }}
    >
      {text}
    </Markdown>
  );
});
export const ConversationTurn = memo(function ConversationTurn({
  turn,
  onFeedback,
  disabled,
  action,
  versions,
  onCopy,
  onRevise,
  companyWork = false,
  operation,
  artifacts,
  creations,
  images,
  selectedCreationId,
  selectedImageId,
  canApproveImages,
  onOpenCreation,
  onApproveImage,
  onSelectImage,
  onBoardCommit,
  boardStatus,
}: {
  turn: Turn;
  operation?: IntelligenceOperation;
  artifacts?: StreamCreation[];
  companyWork?: boolean;
  onFeedback?: (id: string, feedback: 'helpful' | 'needs_work') => void;
  disabled: boolean;
  action?: { proposal?: ActionProposal; onChanged: () => Promise<void> };
  versions?: Turn[];
  onCopy?: () => void;
  onRevise?: (kind: 'retry' | 'regenerate' | 'edit') => void;
  creations?: TalkCreation[];
  images?: TalkImageJob[];
  selectedCreationId?: string | null;
  selectedImageId?: string | null;
  canApproveImages?: boolean;
  onOpenCreation?: (id: string) => void;
  onApproveImage?: (id: string, approve: boolean) => void;
  onSelectImage?: (id: string) => void;
  onBoardCommit?: (
    id: string,
    board: import('@/domains/talk-creation/design-board').DesignBoardContent,
  ) => void;
  boardStatus?: { id: string; state: 'pending' | 'saved' | 'failed' | 'stale' };
}) {
  const ritual =
    !companyWork && turn.status === 'complete' ? parseRitualSuggestion(turn.assistant_text) : null;
  const replySource = ritual
    ? turn.assistant_text.replace(/```grooming-ritual\s*\n[\s\S]*?```/g, '')
    : companyWork
      ? turn.assistant_text.replace(/```company-work\n[\s\S]*?\n```/g, '')
      : stripCreationFences(turn.assistant_text) || turn.assistant_text;
  const replyText =
    operation || turn.status !== 'complete' ? stabilizeStreamingMarkdown(replySource) : replySource;
  return (
    <article className="conversation-turn" data-turn-id={turn.id}>
      <div className="user-message">
        <span className="message-author">You</span>
        <p>{turn.user_text}</p>
      </div>
      <div className="assistant-message">
        {operation ? (
          <IntelligenceResponse
            operation={operation}
            name={councilLabel(councilFromVersion(turn.prompt_version))}
            artifacts={artifacts}
          />
        ) : (
          <span className="message-author">
            <span className="small-orb" aria-hidden="true" />
            {councilLabel(councilFromVersion(turn.prompt_version))}
          </span>
        )}
        <div className="message-markdown">
          <ReplyMarkdown text={replyText} />
        </div>
        {artifacts
          ?.filter(
            (artifact) =>
              !creations?.some((creation) => creation.id === artifact.id) &&
              !images?.some((image) => image.id === artifact.id),
          )
          .map((artifact) => (
            <InFlightCreationCard key={`${artifact.kind}-${artifact.id}`} artifact={artifact} />
          ))}
        {creations?.map((creation) => (
          <CreationCard
            key={creation.id}
            creation={creation}
            selected={creation.id === selectedCreationId}
            onOpen={onOpenCreation ?? (() => {})}
            onBoardCommit={onBoardCommit}
            boardStatus={boardStatus?.id === creation.id ? boardStatus.state : undefined}
          />
        ))}
        {images?.map((image) => (
          <TalkImageCard
            key={image.id}
            image={image}
            selected={image.id === selectedImageId}
            canApprove={!!canApproveImages}
            busy={disabled}
            onOpen={onOpenCreation ?? (() => {})}
            onApprove={onApproveImage ?? (() => {})}
            onSelect={onSelectImage ?? (() => {})}
          />
        ))}
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
        {turn.status !== 'complete' && !operation && (
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
