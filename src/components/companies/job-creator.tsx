'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkScope } from '@/domains/company-work/schema';
export function JobCreator({
  companyId,
  seed,
  onCancel,
}: {
  companyId: string;
  seed: string;
  onCancel: () => void;
}) {
  const router = useRouter();
  const [ids] = useState(() => ({
    jobId: crypto.randomUUID(),
    conversationId: crypto.randomUUID(),
  }));
  const [scope, setScope] = useState<WorkScope>({
    request: seed.slice(0, 3000),
    audience: 'Founder and company team',
    outcome: 'An actionable strategy brief and presentation',
    constraints: '',
    acceptance: 'Clear positioning, a defined offer and prioritized next steps.',
    evidence: [],
    figures: [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const field = (
    key: 'request' | 'audience' | 'outcome' | 'constraints' | 'acceptance',
    label: string,
    max: number,
  ) => (
    <label key={key}>
      {label}
      <textarea
        required={key !== 'constraints'}
        value={scope[key]}
        rows={key === 'request' ? 3 : 2}
        maxLength={max}
        onChange={(e) => setScope((s) => ({ ...s, [key]: e.target.value }))}
      />
    </label>
  );
  async function save() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/company-work', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId, ...ids, scope }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Job not saved.');
      router.push(`/app/companies/${companyId}/work/${ids.jobId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Job not saved.');
      setBusy(false);
    }
  }
  return (
    <form
      className="company-brief-editor"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <h2>Review the job</h2>
      <p>
        The confirmed company brief and this scope will be retained together. Saving does not start
        generation.
      </p>
      <fieldset disabled={busy}>
        {field('request', 'What are we building?', 3000)}
        {field('audience', 'Audience', 300)}
        {field('outcome', 'Intended outcome', 500)}
        {field('constraints', 'Constraints', 1500)}
        {field('acceptance', 'What makes this useful?', 1000)}
        <h3>Supplied evidence</h3>
        {scope.evidence.map((item, i) => (
          <div key={i}>
            <label>
              Source label
              <input
                required
                maxLength={100}
                value={item.label}
                onChange={(e) =>
                  setScope((s) => ({
                    ...s,
                    evidence: s.evidence.map((v, n) =>
                      n === i ? { ...v, label: e.target.value } : v,
                    ),
                  }))
                }
              />
            </label>
            <label>
              Evidence or source excerpt
              <textarea
                required
                maxLength={2000}
                value={item.detail}
                onChange={(e) =>
                  setScope((s) => ({
                    ...s,
                    evidence: s.evidence.map((v, n) =>
                      n === i ? { ...v, detail: e.target.value } : v,
                    ),
                  }))
                }
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setScope((s) => ({ ...s, evidence: s.evidence.filter((_, n) => n !== i) }))
              }
            >
              Remove evidence
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={scope.evidence.length >= 12}
          onClick={() =>
            setScope((s) => ({ ...s, evidence: [...s.evidence, { label: '', detail: '' }] }))
          }
        >
          Add evidence
        </button>
        <h3>Confirmed figures</h3>
        <p>
          Enter only supplied, verified figures. These retain their exact value and source in
          presentation slides.
        </p>
        {scope.figures.map((f, i) => (
          <div key={f.id}>
            {(['label', 'value', 'source'] as const).map((key) => (
              <label key={key}>
                {key === 'value'
                  ? 'Exact value (include units)'
                  : key === 'source'
                    ? 'Source'
                    : 'Metric'}
                <input
                  required
                  value={f[key]}
                  maxLength={key === 'source' ? 300 : 80}
                  onChange={(e) =>
                    setScope((s) => ({
                      ...s,
                      figures: s.figures.map((v, n) =>
                        n === i ? { ...v, [key]: e.target.value } : v,
                      ),
                    }))
                  }
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() =>
                setScope((s) => ({ ...s, figures: s.figures.filter((_, n) => n !== i) }))
              }
            >
              Remove figure
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={scope.figures.length >= 12}
          onClick={() =>
            setScope((s) => ({
              ...s,
              figures: [
                ...s.figures,
                { id: crypto.randomUUID(), label: '', value: '', source: '' },
              ],
            }))
          }
        >
          Add confirmed figure
        </button>
        {error && <p role="alert">{error}</p>}
        <div className="company-room-actions">
          <button className="button">Confirm scope and save job</button>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </fieldset>
    </form>
  );
}
