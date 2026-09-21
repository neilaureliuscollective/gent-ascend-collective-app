'use client';
import { useId, useState } from 'react';
import type { Conversation } from '@/domains/intelligence/types';

export function ConversationLibrary({
  conversations,
  selected,
  disabled,
  preview,
  onSelect,
  onNew,
}: {
  conversations: Conversation[];
  selected: string | null;
  disabled: boolean;
  preview: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const id = useId();
  const matches = conversations.filter((item) =>
    item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <aside className="conversation-library" aria-label="Conversation library" data-open={open}>
      <button
        className="library-toggle"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        <span>
          Conversations <span className="library-count">{conversations.length}</span>
        </span>
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <div className="library-body" id={id}>
        <div className="library-brand">
          <span className="small-orb" aria-hidden="true" />
          <span>
            AURELIUS <small>YOUR PERSONAL INTELLIGENCE</small>
          </span>
        </div>
        <button
          className="library-new"
          disabled={disabled}
          onClick={() => {
            onNew();
            setOpen(false);
          }}
        >
          <span aria-hidden="true">+</span> Start a conversation
        </button>
        <label className="sr-only" htmlFor={`${id}-search`}>
          Search conversation titles
        </label>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search conversations"
        />
        <div className="library-section-heading">
          <span>Saved conversations</span>
          <span>{conversations.length}</span>
        </div>
        <ul className="conversation-list">
          {matches.map((item) => (
            <li key={item.id}>
              <button
                disabled={disabled}
                aria-current={selected === item.id ? 'true' : undefined}
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
              >
                <span>{item.title}</span>
                <time dateTime={item.updated_at}>
                  {new Intl.DateTimeFormat('en', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(item.updated_at))}
                </time>
              </button>
            </li>
          ))}
        </ul>
        {!matches.length && (
          <div className="library-empty">
            <span aria-hidden="true">◇</span>
            <p>{query.trim() ? 'No matching titles.' : 'Room for your next chapter.'}</p>
            <small>
              {query.trim()
                ? 'Try a different word.'
                : preview
                  ? 'Sign in to save and revisit your conversations.'
                  : 'Your conversations will collect here as you begin.'}
            </small>
          </div>
        )}
        <p className="library-footer">
          {preview
            ? 'Workspace preview · nothing is saved'
            : 'Your conversations, in your own space.'}
        </p>
      </div>
    </aside>
  );
}
