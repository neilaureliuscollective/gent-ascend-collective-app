'use client';
import { useState, useTransition } from 'react';
import { ContextSheet } from '@/components/interaction/context-sheet';
type Profile = {
  preferred_look: string;
  hair_focus: string;
  beard_focus: string;
  sensitivities: string;
  dislikes: string;
};
type PassState = { code: string; error: string };
const fields = [
  ['direction', 'preferred_look', 'Preferred look'],
  ['hair', 'hair_focus', 'Hair direction'],
  ['beard', 'beard_focus', 'Beard direction'],
  ['preferences', 'sensitivities', 'Preferences / sensitivities'],
  ['avoid', 'dislikes', 'What to avoid'],
] as const;
export function ProfessionalPassForm({
  looks,
  profile,
  saveAction,
}: {
  looks: { id: string; title: string; style_id: string; note?: string }[];
  profile: Profile | null;
  saveAction: (state: PassState, form: FormData) => Promise<PassState>;
}) {
  const [open, setOpen] = useState(false),
    [review, setReview] = useState(false),
    [selected, setSelected] = useState<string[]>(
      fields
        .filter(([key, field]) => ['direction', 'hair', 'beard'].includes(key) && profile?.[field])
        .map(([key]) => key),
    ),
    [label, setLabel] = useState('My next appointment'),
    [targetId, setTargetId] = useState(''),
    [note, setNote] = useState(''),
    [state, setState] = useState<PassState>({ code: '', error: '' }),
    [pending, startTransition] = useTransition();
  function create() {
    startTransition(async () => {
      const f = new FormData();
      f.set('label', label);
      f.set('targetId', targetId);
      f.set('note', note);
      selected.forEach((k) => f.set(k, 'on'));
      try {
        setState(await saveAction(state, f));
      } catch {
        setState({ code: '', error: 'Could not prepare the pass. Your selection is still here.' });
      }
    });
  }
  return (
    <>
      <button className="button" onClick={() => setOpen(true)}>
        Prepare a handoff
      </button>
      <ContextSheet
        open={open}
        title="Your professional brief"
        busy={pending}
        onClose={() => setOpen(false)}
      >
        <div className="groom-form">
          {state.code ? (
            <div className="groom-code" role="status">
              <strong>Give this one-time code to your intended professional in person.</strong>
              <code>{state.code}</code>
              <p>
                A signed-in account can redeem it once. Expires in seven days; revoke it from your
                passes.
              </p>
            </div>
          ) : review ? (
            <>
              <h3>{label}</h3>
              <dl className="groom-review">
                {fields
                  .filter(([key]) => selected.includes(key))
                  .map(([key, field, title]) => (
                    <div key={key}>
                      <dt>{title}</dt>
                      <dd>{profile?.[field]}</dd>
                    </div>
                  ))}
                {targetId && (
                  <div>
                    <dt>Target description</dt>
                    <dd>
                      {looks.find((l) => l.id === targetId)?.title ||
                        looks.find((l) => l.id === targetId)?.style_id}
                      <p>{looks.find((l) => l.id === targetId)?.note}</p>
                    </dd>
                  </div>
                )}
                {note && (
                  <div>
                    <dt>Your message</dt>
                    <dd>{note}</dd>
                  </div>
                )}
              </dl>
              <p>
                Stays private: photos, scans, product history and everything not included above.
              </p>
              <button className="button" disabled={pending} onClick={create}>
                {pending ? 'Preparing…' : 'Create seven-day pass'}
              </button>
              <button
                className="groom-text-action"
                disabled={pending}
                onClick={() => setReview(false)}
              >
                Adjust brief
              </button>
            </>
          ) : (
            <>
              <p>
                Your saved direction is proposed below. Tap an item to keep it private or include
                it.
              </p>
              <label>
                Appointment label
                <input value={label} maxLength={100} onChange={(e) => setLabel(e.target.value)} />
              </label>
              <div className="groom-share-options">
                {fields
                  .filter(([, field]) => profile?.[field])
                  .map(([key, field, title]) => (
                    <button
                      type="button"
                      key={key}
                      aria-pressed={selected.includes(key)}
                      onClick={() =>
                        setSelected((s) =>
                          s.includes(key) ? s.filter((k) => k !== key) : [...s, key],
                        )
                      }
                    >
                      <span>
                        {title}
                        <small>{profile?.[field]}</small>
                      </span>
                      <strong>{selected.includes(key) ? 'Include' : 'Private'}</strong>
                    </button>
                  ))}
              </div>
              {!profile && <p>No profile yet. Add a message or a saved target below.</p>}
              <label>
                Saved target description
                <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
                  <option value="">No target</option>
                  {looks.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.title || l.style_id}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Message · optional
                <textarea
                  value={note}
                  rows={3}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              <button className="button" disabled={!label.trim()} onClick={() => setReview(true)}>
                Review brief
              </button>
            </>
          )}
          {state.error && <p role="alert">{state.error}</p>}
        </div>
      </ContextSheet>
    </>
  );
}
