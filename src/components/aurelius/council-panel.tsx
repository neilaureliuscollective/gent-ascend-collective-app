'use client';
import { useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  council,
  councilLabel,
  relevantCouncil,
  specialist,
  tableRoutes,
  type CouncilSelection,
  type SpecialistId,
} from '@/domains/intelligence/council';

export function CouncilPanel({
  question,
  selection,
  disabled,
  includeContext,
  onSelect,
  onAssemble,
  onFocused,
  reviewRef,
}: {
  reviewRef?: Ref<{ open: () => void }>;
  question: string;
  selection: CouncilSelection | null;
  disabled: boolean;
  includeContext: boolean;
  onSelect: (selection: CouncilSelection | null) => void;
  onAssemble: (question: string, selection: CouncilSelection) => void;
  onFocused: (id: SpecialistId) => void;
}) {
  const room = useRef<HTMLDialogElement>(null);
  const [objective, setObjective] = useState('');
  const [cast, setCast] = useState<SpecialistId[]>([]);
  const [review, setReview] = useState(false);
  const routes = relevantCouncil(question);
  function open(asTable = false) {
    setObjective(question.slice(0, 6000));
    setCast(tableRoutes(question).map((route) => route.id));
    setReview(asTable);
    room.current?.showModal();
  }
  useImperativeHandle(reviewRef, () => ({ open: () => open(true) }));
  function choose(id: SpecialistId, focused = false) {
    if (focused) onFocused(id);
    else onSelect({ kind: 'specialist', specialists: [id] });
    room.current?.close();
  }
  return (
    <div className="member-council" aria-label="Your Council">
      <div className="council-access">
        <button type="button" className="text-button" disabled={disabled} onClick={() => open()}>
          The Council
        </button>
        {selection ? (
          <>
            <span className="council-current">{councilLabel(selection)}</span>
            <button
              type="button"
              className="text-button"
              disabled={disabled}
              onClick={() => onSelect(null)}
            >
              {selection.kind === 'table' ? 'Leave The Table' : 'Return to Aethelios'}
            </button>
          </>
        ) : routes.length > 0 ? (
          <span className="council-relevant">
            Relevant Council · {routes.map((route) => specialist(route.id).name).join(' · ')}
          </span>
        ) : (
          <span className="council-relevant">Your private intelligence bench</span>
        )}
        <button
          type="button"
          className="text-button"
          disabled={disabled || !question.trim()}
          onClick={() => open(true)}
        >
          {selection?.kind === 'table' ? 'Review The Table' : 'Assemble Around This'}
        </button>
      </div>
      <dialog ref={room} className="council-dialog" aria-labelledby="council-title">
        <header>
          <div>
            <p className="eyebrow">Aethelios · Your intelligence team</p>
            <h2 id="council-title">{review ? 'The Table' : 'The Council'}</h2>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => room.current?.close()}
            aria-label="Close Council"
          >
            Close
          </button>
        </header>
        {review ? (
          <>
            <p>Independent expert perspectives. One clear synthesis from Aethelios.</p>
            <label className="council-objective">
              What are we examining?
              <textarea
                rows={3}
                maxLength={6000}
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
              />
            </label>
            <fieldset>
              <legend>Invite two or three specialists</legend>
              {council.map((member) => {
                const reason = tableRoutes(objective).find(
                  (route) => route.id === member.id,
                )?.reason;
                return (
                  <label className="council-invite" key={member.id}>
                    <input
                      type="checkbox"
                      checked={cast.includes(member.id)}
                      disabled={!cast.includes(member.id) && cast.length >= 3}
                      onChange={() =>
                        setCast((previous) =>
                          previous.includes(member.id)
                            ? previous.filter((id) => id !== member.id)
                            : [...previous, member.id],
                        )
                      }
                    />
                    <span>
                      <strong>{member.name}</strong>
                      <small>
                        {member.role}
                        {reason ? ` · ${reason}` : ''}
                      </small>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            <p className="council-scope">
              Scope: this conversation
              {includeContext
                ? ', the saved source categories you selected'
                : ''}
              . {includeContext ? 'Personal context is on.' : 'Personal context is off.'} Up to
              three specialist model calls and one Aethelios synthesis. Analysis and drafts only;
              nothing is sent, booked, purchased or changed.
            </p>
            <div className="council-dialog-actions">
              <button
                type="button"
                className="button"
                disabled={disabled || cast.length < 2 || !objective.trim()}
                onClick={() => {
                  onAssemble(objective.trim(), { kind: 'table', specialists: cast });
                  room.current?.close();
                }}
              >
                Confirm and assemble
              </button>
              <button type="button" className="text-button" onClick={() => setReview(false)}>
                View the Council
              </button>
            </div>
          </>
        ) : (
          <>
            <p>Aethelios is your front door. Bring in a focused lens when it helps.</p>
            <div className="council-roster">
              {council.map((member) => (
                <article key={member.id}>
                  <div>
                    <h3>{member.name}</h3>
                    <p className="council-role">{member.role}</p>
                    <p>{member.description}</p>
                    {routes.find((route) => route.id === member.id) && (
                      <small className="council-reason">
                        Relevant here · {routes.find((route) => route.id === member.id)!.reason}
                      </small>
                    )}
                  </div>
                  <div className="council-member-actions">
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={disabled}
                      onClick={() => choose(member.id)}
                    >
                      Involve {member.name}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={disabled}
                      onClick={() => choose(member.id, true)}
                    >
                      Open focused conversation
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <p className="council-scope">
              Each specialist uses this account’s authorized context and the conversation you
              choose. No founder repositories, private founder notebook or external integrations are
              connected to the member Council.
            </p>
            <button type="button" className="button" onClick={() => setReview(true)}>
              Set The Table
            </button>
          </>
        )}
      </dialog>
    </div>
  );
}
