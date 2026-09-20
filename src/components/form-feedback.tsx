'use client';
import { useEffect, useRef } from 'react';
import type { FormState } from '@/domains/shared/form-state';
export function FormFeedback({ state }: { state: FormState }) {
  const message = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === 'error' || state.status === 'conflict') message.current?.focus();
  }, [state]);
  if (!state.message) return null;
  return (
    <div
      className={`form-feedback ${state.status}`}
      ref={message}
      tabIndex={-1}
      role={state.status === 'saved' ? 'status' : 'alert'}
    >
      <p>{state.message}</p>
      {state.status === 'conflict' && (
        <>
          <p className="muted">Keep a copy of any unsaved edits before reloading.</p>
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.location.reload()}
          >
            Reload latest version
          </button>
        </>
      )}
    </div>
  );
}
export function FieldError({ state, name, id }: { state: FormState; name: string; id: string }) {
  return state.errors?.[name]?.length ? (
    <span id={id} className="field-error">
      {state.errors[name]?.[0]}
    </span>
  ) : null;
}
