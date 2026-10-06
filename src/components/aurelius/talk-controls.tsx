'use client';
import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import './talk.css';

/** Native modal focus/escape behavior; draft and transcript stay mounted behind it. */
export function TalkDrawer({
  label,
  children,
  disabled = false,
}: {
  label: string;
  children: ReactNode | ((close: () => void) => ReactNode);
  disabled?: boolean;
}) {
  const [dialog, setDialog] = useState<HTMLDialogElement | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  function close() {
    dialog?.close();
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="talk-tool"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          dialog?.showModal();
          setOpen(true);
        }}
      >
        {label}
      </button>
      <dialog
        ref={setDialog}
        id={id}
        className="talk-drawer"
        aria-labelledby={`${id}-title`}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            const r = e.currentTarget.getBoundingClientRect();
            if (
              e.clientX < r.left ||
              e.clientX > r.right ||
              e.clientY < r.top ||
              e.clientY > r.bottom
            )
              close();
          }
        }}
      >
        <header>
          <h2 id={`${id}-title`}>{label}</h2>
          <button type="button" aria-label={`Close ${label}`} onClick={close}>
            ×
          </button>
        </header>
        <div className="talk-drawer-body">
          {typeof children === 'function' ? children(close) : children}
        </div>
      </dialog>
    </>
  );
}

export function TalkInput({
  value,
  onChange,
  inputRef,
  id,
  disabled,
  placeholder,
  maxLength = 6000,
  label,
}: {
  value: string;
  onChange: (text: string) => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  id: string;
  disabled: boolean;
  placeholder: string;
  maxLength?: number;
  label?: string;
}) {
  const editor = useRef<HTMLDialogElement>(null);
  const expanded = useRef<HTMLTextAreaElement>(null);
  const caret = useRef({ start: 0, end: 0 });
  useEffect(() => {
    const resize = () => {
      const field = inputRef.current;
      if (!field) return;
      const vp = window.visualViewport;
      const height = vp?.scale === 1 ? vp.height : window.innerHeight;
      field.style.height = '0px';
      field.style.height = `${Math.max(44, Math.min(field.scrollHeight, 200, height * 0.24))}px`;
    };
    resize();
    window.visualViewport?.addEventListener('resize', resize);
    window.addEventListener('resize', resize);
    return () => {
      window.visualViewport?.removeEventListener('resize', resize);
      window.removeEventListener('resize', resize);
    };
  }, [value, inputRef]);
  return (
    <>
      <label className="sr-only" htmlFor={id}>
        {label || placeholder}
      </label>
      <textarea
        className="talk-input"
        id={id}
        ref={inputRef}
        rows={1}
        value={value}
        disabled={disabled}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' &&
            !e.nativeEvent.isComposing &&
            !e.shiftKey &&
            (e.metaKey || e.ctrlKey || window.matchMedia('(pointer:fine)').matches)
          ) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button
        type="button"
        className="talk-expand"
        disabled={disabled}
        aria-label="Expand writing space"
        onClick={() => {
          caret.current = {
            start: inputRef.current?.selectionStart ?? value.length,
            end: inputRef.current?.selectionEnd ?? value.length,
          };
          editor.current?.showModal();
          expanded.current?.focus();
          expanded.current?.setSelectionRange(caret.current.start, caret.current.end);
        }}
      >
        ↗
      </button>
      <dialog
        ref={editor}
        className="talk-drawer talk-editor"
        aria-label="Expanded writing space"
        onClose={() => {
          inputRef.current?.focus();
          inputRef.current?.setSelectionRange(caret.current.start, caret.current.end);
        }}
      >
        <header>
          <h2>Writing space</h2>
          <button
            type="button"
            onClick={() => {
              caret.current = {
                start: expanded.current?.selectionStart ?? value.length,
                end: expanded.current?.selectionEnd ?? value.length,
              };
              editor.current?.close();
            }}
          >
            Done
          </button>
        </header>
        <textarea
          ref={expanded}
          aria-label="Expanded message"
          value={value}
          maxLength={maxLength}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onSelect={(e) => {
            caret.current = {
              start: e.currentTarget.selectionStart,
              end: e.currentTarget.selectionEnd,
            };
          }}
        />
      </dialog>
    </>
  );
}
