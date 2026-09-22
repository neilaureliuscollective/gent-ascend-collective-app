'use client';
import { useState } from 'react';
import type { Memory } from '@/domains/intelligence/types';
export async function jsonRequest(url: string, method: string, body: unknown) {
  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result.error === 'string' ? result.error : 'The change could not be confirmed.',
    );
  return result;
}
export function MemoryEditor({
  memories,
  onChanged,
  disabled = false,
  preview = false,
}: {
  memories: Memory[];
  onChanged: () => Promise<void>;
  disabled?: boolean;
  preview?: boolean;
}) {
  const [edit, setEdit] = useState<Memory | null>(null);
  const [content, setContent] = useState('');
  const [kind, setKind] = useState<'preference' | 'fact'>('preference');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [remove, setRemove] = useState<string | null>(null);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (pending || disabled || preview) return;
    setPending(true);
    setMessage('');
    try {
      await jsonRequest('/api/aurelius/memory', 'POST', {
        id: edit?.id ?? crypto.randomUUID(),
        content,
        kind,
        version: edit?.version ?? 0,
      });
      setContent('');
      setEdit(null);
      await onChanged();
      setMessage('Memory saved. It can inform future messages when personal context is on.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Memory could not be saved.');
    } finally {
      setPending(false);
    }
  }
  async function forget(memory: Memory) {
    if (pending || disabled || preview) return;
    setPending(true);
    setMessage('');
    try {
      await jsonRequest('/api/aurelius/memory', 'DELETE', {
        id: memory.id,
        version: memory.version,
      });
      if (edit?.id === memory.id) {
        setEdit(null);
        setContent('');
      }
      setRemove(null);
      await onChanged();
      setMessage('Memory removed from future personal context.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Memory could not be deleted.');
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="memory-space" aria-label="Aethelios memory">
      <p className="eyebrow">What you choose to carry forward</p>
      <h3>Memory, on your terms.</h3>
      <p>
        Only details you explicitly save here become durable memory. Chatting does not silently add
        facts.
      </p>
      {preview && (
        <p className="memory-preview-label">Preview · sign in to confirm and save memories.</p>
      )}
      {!memories.length && (
        <div className="memory-empty">
          <span aria-hidden="true">◇</span>
          <div>
            <h4>A considered beginning.</h4>
            <p>
              Start with how you like to think, what matters to you, or a preference that makes the
              conversation more useful.
            </p>
          </div>
        </div>
      )}
      <form className="editor-form" onSubmit={save}>
        <fieldset disabled={pending || disabled}>
          <label htmlFor="memory-kind">Type</label>
          <select
            id="memory-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as 'preference' | 'fact')}
          >
            <option value="preference">Preference</option>
            <option value="fact">Personal fact</option>
          </select>
          <label htmlFor="memory-content">
            {edit ? 'Correct this memory' : 'What should Aethelios remember?'}
          </label>
          <textarea
            id="memory-content"
            maxLength={500}
            rows={3}
            required
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="For example: I prefer direct answers with a clear next step."
          />
          <button type="submit" className="button" disabled={!content.trim()}>
            {pending ? 'Saving…' : edit ? 'Confirm correction' : 'Confirm and remember'}
          </button>
          {edit && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setEdit(null);
                setContent('');
              }}
            >
              Cancel edit
            </button>
          )}
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
      <p className="muted">{memories.length} / 24 memories · confirmed by you</p>
      <ul className="memory-list">
        {memories.map((memory) => (
          <li key={memory.id}>
            <span className="eyebrow">{memory.kind}</span>
            <p>{memory.content}</p>
            <div className="button-row">
              <button
                className="text-button"
                disabled={pending || disabled}
                onClick={() => {
                  setEdit(memory);
                  setContent(memory.content);
                  setKind(memory.kind);
                  setMessage('');
                }}
              >
                Edit memory
              </button>
              <button
                className="text-button"
                disabled={pending || disabled}
                onClick={() => setRemove(memory.id)}
              >
                Forget
              </button>
            </div>
            {remove === memory.id && (
              <div className="confirm-row">
                <p>Remove this memory from future context?</p>
                <button
                  className="secondary-button"
                  disabled={pending || disabled}
                  onClick={() => void forget(memory)}
                >
                  Confirm forget
                </button>
                <button className="text-button" onClick={() => setRemove(null)}>
                  Keep memory
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <p className="privacy-note">
        Corrections apply to future requests. Old conversations may still contain the original
        detail; delete those conversations too if you want them removed. A request already sent to a
        model cannot be recalled.
      </p>
    </section>
  );
}
