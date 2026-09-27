'use client';
import { useEffect, useId, useState } from 'react';
import type { Conversation } from '@/domains/intelligence/types';

export function ConversationLibrary({
  conversations,
  selected,
  disabled,
  preview,
  onSelect,
  onNew,
  onRename,
  onArchive,
  nextCursor,
  onMore,
}: {
  conversations: Conversation[];
  selected: string | null;
  disabled: boolean;
  preview: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename?: (id: string, title: string) => Promise<void>;
  onArchive?: (id: string, archived: boolean) => Promise<void>;
  nextCursor?: string | null;
  onMore?: () => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [archived, setArchived] = useState(false);
  const [results, setResults] = useState<Array<Pick<Conversation,'id'|'title'|'updated_at'> & {excerpt?:string;archived_at?:string|null}> | null>(null);
  const [searchError, setSearchError] = useState('');
  const [editing, setEditing] = useState<string|null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const id = useId();
  useEffect(() => {
    if (!archived && query.trim().length < 2) return;
    const controller=new AbortController();
    const timer=setTimeout(async () => {
      try {
        const response=await fetch('/api/aurelius'+(archived && !query.trim() ? '?archive=1' : `?search=${encodeURIComponent(query.trim())}`),{signal:controller.signal,cache:'no-store'});
        if (!response.ok) throw new Error('Search could not be loaded.');
        const data=await response.json();
        if(!controller.signal.aborted) {setResults(Array.isArray(data.results)?data.results:null);setSearchError('');}
      } catch {if(!controller.signal.aborted) setSearchError('Search could not be loaded. Try again.');}
    },250);
    return () => {clearTimeout(timer);controller.abort();};
  },[query,archived]);
  const matches = archived ? (results??[]).filter(item=>Boolean(item.archived_at)) : ((query.trim().length>=2 ? results?.filter(item=>!item.archived_at) : null) ?? conversations.filter((item) =>
    item.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  ));
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
            AETHELIOS <small>DIGITAL CO-FOUNDER</small>
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
          Search conversations
        </label>
        <input
          id={`${id}-search`}
          type="search"
          value={query}
          onChange={(e) => {setQuery(e.target.value);setResults(null);}}
          placeholder="Search conversations"
        />
        <div className="library-section-heading">
          <button type="button" aria-pressed={!archived} onClick={()=>{setArchived(false);setResults(null);}}>Conversations</button>
          <button type="button" aria-pressed={archived} onClick={()=>{setArchived(true);setResults(null);}}>Archive</button>
        </div>
        {searchError && (archived || query.trim().length>=2) && <p role="alert" className="form-feedback error">{searchError}</p>}
        <ul className="conversation-list">
          {matches.map((item) => (
            <li key={item.id}>
              {editing===item.id ? <form className="conversation-rename" onSubmit={async e=>{
                e.preventDefault();
                try {if(editedTitle.trim() && onRename) await onRename(item.id,editedTitle.trim());setEditing(null);} catch {/* parent displays the save error */}
              }}>
                <label className="sr-only" htmlFor={`${id}-rename`}>Conversation title</label>
                <input id={`${id}-rename`} autoFocus maxLength={80} value={editedTitle} onChange={e=>setEditedTitle(e.target.value)} />
                <button type="submit" disabled={!editedTitle.trim()}>Save</button>
                <button type="button" onClick={()=>setEditing(null)}>Cancel</button>
              </form> : <>
              <button
                disabled={disabled}
                aria-current={selected === item.id ? 'true' : undefined}
                onClick={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
              >
                <span>{item.title}</span>
                {'excerpt' in item && item.excerpt && <small className="conversation-excerpt">{item.excerpt}</small>}
                <time dateTime={item.updated_at}>
                  {new Intl.DateTimeFormat('en', {
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(item.updated_at))}
                </time>
              </button>
              {(onRename || onArchive) && <div className="conversation-item-actions">
                {onRename && <button type="button" aria-label={`Rename ${item.title}`} disabled={disabled} onClick={async ()=>{
                  setEditedTitle(item.title);setEditing(item.id);
                }}>Rename</button>}
                {onArchive && <button type="button" disabled={disabled} onClick={async()=>{try {await onArchive(item.id,!archived);setResults(previous=>previous?.filter(result=>result.id!==item.id)??null);} catch {/* parent displays the save error */}}}>{archived?'Restore':'Archive'}</button>}
              </div>}
              </>}
            </li>
          ))}
        </ul>
        {!archived && !query && nextCursor && onMore && <button type="button" className="library-more" disabled={disabled} onClick={()=>void onMore()}>Load more conversations</button>}
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
