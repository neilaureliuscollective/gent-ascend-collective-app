'use client';
import { useState, useTransition } from 'react';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { ChoiceGroup } from '@/components/interaction/choice-group';
export type GroomingDirection = {
  hair_focus: string;
  beard_focus: string;
  skin_focus: string;
  preferred_look: string;
  effort: string;
  sensitivities: string;
  dislikes: string;
  version: number;
};
export type GroomingSaveResult = { error: string };
const fields = [
  ['hair_focus', 'Hair', ['Textured / medium', 'Short / clean', 'Long / natural']],
  ['beard_focus', 'Beard', ['Full / sharp', 'Short / structured', 'Clean shaven']],
  ['skin_focus', 'Skin', ['Clean / low-shine', 'Comfort / hydration', 'Simple care']],
  [
    'preferred_look',
    'Overall direction',
    ['Polished / natural', 'Sharp / defined', 'Relaxed / effortless'],
  ],
] as const;
const empty: GroomingDirection = {
  hair_focus: '',
  beard_focus: '',
  skin_focus: '',
  preferred_look: '',
  effort: 'simple',
  sensitivities: '',
  dislikes: '',
  version: 0,
};
export function GroomingDirectionEditor({
  profile,
  saveAction,
}: {
  profile: GroomingDirection | null;
  saveAction: (form: FormData) => Promise<GroomingSaveResult>;
}) {
  const [saved, setSaved] = useState(profile ?? empty),
    [draft, setDraft] = useState(profile ?? empty),
    [open, setOpen] = useState(false),
    [step, setStep] = useState<number | null>(null),
    [error, setError] = useState(''),
    [pending, startTransition] = useTransition();
  function save() {
    if (JSON.stringify(saved) === JSON.stringify(draft)) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      const f = new FormData();
      Object.entries(draft).forEach(([k, v]) => f.set(k, String(v)));
      try {
        const result = await saveAction(f);
        if (result.error) {
          setError(result.error);
          return;
        }
        const next = { ...draft, version: Math.max(1, draft.version + 1) };
        setSaved(next);
        setDraft(next);
        setError('');
        setOpen(false);
      } catch {
        setError('Could not save. Your changes are still here. Try again.');
      }
    });
  }
  return (
    <section className="groom-standard" id="direction">
      <p className="eyebrow">Your standard</p>
      <h2>{saved.preferred_look || 'Make it yours.'}</h2>
      <dl>
        {fields.slice(0, 3).map(([key, label]) => (
          <div key={key}>
            <dt>{label}</dt>
            <dd>{saved[key] || 'Not set yet'}</dd>
          </div>
        ))}
      </dl>
      <button className="button" onClick={() => setOpen(true)}>
        Refine direction
      </button>
      <ContextSheet
        open={open}
        title="Your grooming direction"
        busy={pending}
        onClose={() => setOpen(false)}
      >
        <div className="groom-form">
          {step === null ? (
            <>
              <p>Your selected direction. Adjust only what needs to change.</p>
              <dl className="groom-review">
                {fields.map(([key, label], i) => (
                  <div key={key}>
                    <dt>{label}</dt>
                    <dd>
                      {draft[key] || 'Not set'}{' '}
                      <button
                        type="button"
                        className="groom-text-action"
                        onClick={() => setStep(i)}
                      >
                        Adjust {label.toLowerCase()}
                      </button>
                    </dd>
                  </div>
                ))}
                <div>
                  <dt>Routine & preferences</dt>
                  <dd>
                    {draft.effort}
                    {draft.sensitivities && ` · ${draft.sensitivities}`}
                    {draft.dislikes && ` · Avoid: ${draft.dislikes}`}{' '}
                    <button className="groom-text-action" onClick={() => setStep(4)}>
                      Adjust preferences
                    </button>
                  </dd>
                </div>
              </dl>
              <button className="button" disabled={pending} onClick={save}>
                {pending
                  ? 'Saving…'
                  : JSON.stringify(saved) === JSON.stringify(draft)
                    ? 'Keep this direction'
                    : 'Save this direction'}
              </button>
              <button
                className="groom-text-action"
                disabled={pending}
                onClick={() => {
                  setDraft(saved);
                  setError('');
                }}
              >
                Undo changes
              </button>
            </>
          ) : step < 4 ? (
            (() => {
              const [key, label, choices] = fields[step]!;
              return (
                <>
                  <p className="eyebrow">One detail / {label}</p>
                  <ChoiceGroup
                    label={`${label} direction`}
                    value={draft[key]}
                    options={choices.map((value) => ({ value, label: value }))}
                    onChange={(value) => setDraft({ ...draft, [key]: value })}
                  />
                  <label>
                    In your own words
                    <input
                      value={draft[key]}
                      maxLength={key === 'preferred_look' ? 300 : 200}
                      onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                    />
                  </label>
                  <button className="button" onClick={() => setStep(null)}>
                    Review direction
                  </button>
                </>
              );
            })()
          ) : (
            <>
              <ChoiceGroup
                label="Time and effort"
                value={draft.effort}
                options={[
                  { value: 'simple', label: 'Simple' },
                  { value: 'considered', label: 'Considered' },
                  { value: 'detailed', label: 'Detailed' },
                ]}
                onChange={(effort) => setDraft({ ...draft, effort })}
              />
              <label>
                Sensitivities or preferences
                <input
                  value={draft.sensitivities}
                  maxLength={300}
                  onChange={(e) => setDraft({ ...draft, sensitivities: e.target.value })}
                />
              </label>
              <label>
                What to avoid
                <input
                  value={draft.dislikes}
                  maxLength={300}
                  onChange={(e) => setDraft({ ...draft, dislikes: e.target.value })}
                />
              </label>
              <button className="button" onClick={() => setStep(null)}>
                Review direction
              </button>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </div>
      </ContextSheet>
    </section>
  );
}
