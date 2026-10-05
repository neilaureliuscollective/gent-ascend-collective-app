'use client';

import { useState } from 'react';
import { useConversationDraft } from '@/components/aurelius/draft-handoff';

type PreparedPresence = {
  title: string;
  summary: string;
  preparations: { label: string; timing: string; reason: string }[];
  ask: string[];
};

export function PresencePreparedPlan({ ownerId }: { ownerId: string }) {
  const handoff = useConversationDraft();
  const [prepared] = useState<PreparedPresence | null>(() => {
    const carried = handoff?.take('presence', ownerId);
    const value = (carried?.payload as { presence?: PreparedPresence } | undefined)?.presence;
    return value ?? null;
  });

  if (!prepared) return null;

  return (
    <section className="presence-preparation" aria-labelledby="presence-prepared-heading">
      <p className="eyebrow">PREPARED BY AETHELIOS / REVIEW FIRST</p>
      <h2 id="presence-prepared-heading">{prepared.title}</h2>
      <p>{prepared.summary}</p>
      <ol>
        {prepared.preparations.map((item) => (
          <li key={`${item.label}-${item.timing}`}>
            <strong>{item.label}</strong>
            {item.timing && <span> · {item.timing}</span>}
            {item.reason && <p>{item.reason}</p>}
          </li>
        ))}
      </ol>
      {!!prepared.ask.length && (
        <details>
          <summary>What Aethelios still needs from you</summary>
          <ul>
            {prepared.ask.map((question) => <li key={question}>{question}</li>)}
          </ul>
        </details>
      )}
      <small>This is a reviewable preparation plan. Nothing was booked, purchased, or saved automatically.</small>
    </section>
  );
}
