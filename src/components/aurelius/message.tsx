'use client';
import { memo } from 'react';
import Markdown from 'react-markdown';
import type { Turn } from '@/domains/intelligence/types';
export const ConversationTurn = memo(function ConversationTurn({
  turn,
  onFeedback,
  disabled,
}: {
  turn: Turn;
  onFeedback: (id: string, feedback: 'helpful' | 'needs_work') => void;
  disabled: boolean;
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
          Aurelius
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
      </div>
    </article>
  );
});
