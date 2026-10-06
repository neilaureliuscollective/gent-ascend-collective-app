'use client';
import { useState } from 'react';
import type { Company } from '@/domains/companies/schema';
export function BriefEditor({
  company,
  onSaved,
  onCancel,
}: {
  company?: Company;
  onSaved: (company: Company) => void;
  onCancel: () => void;
}) {
  const [id] = useState(() => company?.id ?? crypto.randomUUID());
  const [name, setName] = useState(company?.name ?? '');
  const [brief, setBrief] = useState(company?.brief ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <form
      className="company-brief-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
          const response = await fetch('/api/companies', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id,
              name,
              brief,
              version: company?.version ?? 0,
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? 'Brief could not be saved.');
          onSaved(result.company);
        } catch (error) {
          setError(error instanceof Error ? error.message : 'Brief could not be saved.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{company ? 'Confirm the company brief' : 'Create a company room'}</h2>
      <label>
        Company name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={100}
          required
          disabled={busy}
        />
      </label>
      <label>
        Confirmed business context
        <textarea
          value={brief}
          onChange={(event) => setBrief(event.target.value)}
          maxLength={12000}
          rows={9}
          disabled={busy}
          placeholder="What does the company do? Who is the customer? What is the offer, stage, main challenge and goal? Label estimates and unknowns."
        />
      </label>
      <p>
        This saves your confirmed context. AI suggestions only become part of the brief when you
        review and save them. The room is private to your account.
      </p>
      {error && <p role="alert">{error}</p>}
      <div className="company-room-actions">
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Confirm and save'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}
