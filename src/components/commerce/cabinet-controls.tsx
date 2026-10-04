'use client';
import { useActionState, useState } from 'react';
import { cabinetRelations, cabinetLabels, type CabinetRow } from '@/domains/commerce/cabinet-model';
type Result = { error: string; message: string };
type Action = (previous: Result, form: FormData) => Promise<Result>;
const initial: Result = { error: '', message: '' };
function Feedback({ result }: { result: Result }) {
  return result.error ? (
    <p role="alert">{result.error}</p>
  ) : result.message ? (
    <p role="status">{result.message}</p>
  ) : null;
}
export function CabinetSave({ handle, action }: { handle: string; action: Action }) {
  const [result, submit, pending] = useActionState(action, initial);
  return (
    <form action={submit}>
      <input type="hidden" name="handle" value={handle} />
      <button className="secondary-button" disabled={pending}>
        {pending ? 'Saving…' : 'Save to my Cabinet'}
      </button>
      <Feedback result={result} />
    </form>
  );
}
export function CabinetEditor({
  record,
  rituals,
  action,
}: {
  record: CabinetRow;
  rituals: { id: string; title: string }[];
  action: Action;
}) {
  const [result, submit, pending] = useActionState(action, initial);
  const [relation, setRelation] = useState(record.relation),
    [note, setNote] = useState(record.note),
    [ritual, setRitual] = useState(record.ritual_id ?? '');
  return (
    <form action={submit} className="cabinet-form">
      <input type="hidden" name="id" value={record.id} />
      <input type="hidden" name="version" value={record.version} />
      <label>
        My experience
        <select
          name="relation"
          value={relation}
          onChange={(e) => setRelation(e.target.value as CabinetRow['relation'])}
        >
          {cabinetRelations.map((value) => (
            <option key={value} value={value}>
              {cabinetLabels[value]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Grooming ritual
        <select name="ritual_id" value={ritual} onChange={(e) => setRitual(e.target.value)}>
          <option value="">No ritual linked</option>
          {record.ritual_id && !rituals.some((r) => r.id === record.ritual_id) ? (
            <option value={record.ritual_id}>
              Earlier ritual version — choose a current ritual
            </option>
          ) : null}
          {rituals.map((r) => (
            <option key={r.id} value={r.id}>
              {r.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        My note
        <textarea
          name="note"
          maxLength={400}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </label>
      <div className="cabinet-actions">
        <button className="secondary-button" name="operation" value="save" disabled={pending}>
          Save my experience
        </button>
        <button name="operation" value="remove" disabled={pending}>
          Remove this record
        </button>
      </div>
      <Feedback result={result} />
    </form>
  );
}
export function CabinetExternal({ id, action }: { id: string; action: Action }) {
  const [result, submit, pending] = useActionState(action, initial);
  const [name, setName] = useState(''),
    [category, setCategory] = useState('beard');
  return (
    <form action={submit} className="cabinet-form">
      <input type="hidden" name="id" value={id} />
      <label>
        Product name
        <input
          name="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label>
        Area
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value)}>
          {['beard', 'hair', 'skin', 'other'].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <button className="secondary-button" disabled={pending}>
        Record a product I own
      </button>
      <Feedback result={result} />
    </form>
  );
}
