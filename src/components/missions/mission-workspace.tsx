'use client';
import { MissionContinuity } from './mission-continuity';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { jsonRequest } from '@/components/aurelius/memory-editor';
import { missionStatuses, type Mission } from '@/domains/missions/schema';
import { specialist, type SpecialistId } from '@/domains/intelligence/council';
export function MissionWorkspace({
  initial,
  participants = [],
}: {
  initial: Mission;
  participants?: SpecialistId[];
}) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const router = useRouter();
  async function mutate(remove = false) {
    setBusy(true);
    setError('');
    try {
      const body = remove
        ? { id: value.id, expected_revision: value.revision }
        : {
            id: value.id,
            expected_revision: value.revision,
            title: value.title,
            objective: value.objective,
            status: value.status,
            decisions: value.decisions,
            open_questions: value.open_questions,
            next_actions: value.next_actions,
          };
      const result = (await jsonRequest('/api/missions', remove ? 'DELETE' : 'PATCH', body)) as {
        mission: Mission;
      };
      if (remove) router.replace('/app/missions');
      else {
        setValue(result.mission);
        router.refresh();
      }
    } catch (e) {
      setUncertain(true);
      setError(e instanceof Error ? e.message : 'Save was not confirmed.');
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || uncertain;
  return (
    <section className="mission-editor">
      <p className="eyebrow">Mission · Direction, continuity, next action</p>
      <p>
        Recorded contributors: Aethelios
        {participants.map((id) => ` · ${specialist(id).name}`).join('')}. Based on up to 500
        completed turn receipts; planned invitations are not participants.
      </p>
      <MissionContinuity mission={value}/>
      <details><summary>Edit saved direction</summary>
      <label>
        Name
        <input
          value={value.title}
          maxLength={120}
          disabled={disabled}
          onChange={(e) => setValue({ ...value, title: e.target.value })}
        />
      </label>
      <label>
        Objective
        <textarea
          rows={3}
          maxLength={2000}
          value={value.objective}
          disabled={disabled}
          onChange={(e) => setValue({ ...value, objective: e.target.value })}
        />
      </label>
      <label>
        Status
        <select
          value={value.status}
          disabled={disabled}
          onChange={(e) => setValue({ ...value, status: e.target.value as Mission['status'] })}
        >
          {missionStatuses.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </select>
      </label>
      <label>
        Decisions
        <textarea
          rows={3}
          maxLength={4000}
          value={value.decisions}
          disabled={disabled}
          onChange={(e) => setValue({ ...value, decisions: e.target.value })}
        />
      </label>
      <label>
        Open questions
        <textarea
          rows={2}
          maxLength={2000}
          value={value.open_questions}
          disabled={disabled}
          onChange={(e) => setValue({ ...value, open_questions: e.target.value })}
        />
      </label>
      <label>
        Next actions
        <textarea
          rows={3}
          maxLength={2000}
          value={value.next_actions}
          disabled={disabled}
          onChange={(e) => setValue({ ...value, next_actions: e.target.value })}
        />
      </label>
      </details>
      <p>
        Research and outputs stay in the saved conversation. Only context you enable is sent to the
        model. Decisions recorded here do not approve external actions.
      </p>
      {error && (
        <p role="alert">
          {error}{' '}
          <button className="text-button" onClick={() => window.location.reload()}>
            Reload saved Mission
          </button>
        </p>
      )}
      <div className="council-dialog-actions">
        <button
          className="button"
          disabled={disabled || !value.title.trim() || value.objective.trim().length < 3}
          onClick={() => void mutate()}
        >
          {busy ? 'Saving…' : 'Save direction'}
        </button>
        <Link href={`/app/work/technology?mission=${value.id}`}>Create a Technology preview ↗</Link>
        <Link href={`/app/aethelios?conversation=${value.conversation_id}`}>
          Open work & outputs ↗
        </Link>
      </div>
      <p className="council-scope">
        Continue in Talk restores the saved conversation. Its Mission context control determines whether reviewed direction is included; no message is sent automatically.
      </p>
      <button className="text-button" disabled={disabled} onClick={() => setConfirmDelete(true)}>
        Delete Mission
      </button>
      {confirmDelete && (
        <div>
          <p>Delete the Mission direction? The conversation and its outputs remain in Library.</p>
          <button
            className="secondary-button"
            disabled={disabled}
            onClick={() => void mutate(true)}
          >
            Confirm delete Mission
          </button>
          <button className="text-button" onClick={() => setConfirmDelete(false)}>
            Keep Mission
          </button>
        </div>
      )}
    </section>
  );
}
