'use client';
import { memo } from 'react';
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
}: {
  turn: Turn;
  onFeedback: (id: string, feedback: 'helpful' | 'needs_work') => void;
  disabled: boolean;
  action?: {proposal?:ActionProposal;onChanged:()=>Promise<void>};
  versions?:Turn[];
  onCopy?:()=>void;
  onRevise?:(kind:'retry'|'regenerate'|'edit')=>void;
}) {
  return (
    <article className="conversation-turn">
      <div className="user-message">
        <span className="message-author">You</span>
        <p>{turn.user_text}</p>
      </div>
      <div className="assistant-message">
        <span className="message-author">
          <span className="small-orb" aria-hidden="true" />
          Aethelios
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
            {turn.assistant_text}
          </Markdown>
        </div>
        {versions?.map(previous=><details className="message-version" key={previous.id}><summary>Previous version</summary><div className="message-markdown"><Markdown skipHtml>{previous.assistant_text || 'No completed reply.'}</Markdown></div></details>)}
        {turn.status !== 'complete' && (
          <p className="message-state">
            {turn.status === 'pending'
              ? 'Reply in progress or interrupted. Reload to check its saved state.'
              : turn.status === 'cancelled'
                ? 'Stopped · partial reply'
                : 'Incomplete reply · not included in future conversation context'}
          </p>
        )}
        {turn.status === 'complete' && (
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
        <div className="message-tools">
          {turn.status==='complete' && <button type="button" onClick={onCopy}>Copy</button>}
          {onRevise && !disabled && (turn.status==='complete' ? <>
            <button type="button" onClick={()=>onRevise('regenerate')}>Regenerate</button>
            <button type="button" onClick={()=>onRevise('edit')}>Edit and resend</button>
          </> : turn.status!=='pending' ? <button type="button" onClick={()=>onRevise('retry')}>Retry reply</button> : null)}
        </div>
        {turn.status==='complete'&&action&&<ActionReview turnId={turn.id} proposal={action.proposal} onChanged={action.onChanged} disabled={disabled} />}
      </div>
    </article>
  );
});
