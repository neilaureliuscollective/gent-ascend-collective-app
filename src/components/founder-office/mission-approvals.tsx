'use client';
import { useState } from 'react';
import type { readWork } from '@/domains/company-work/service';
import { approvalHistory } from '@/domains/company-work/approval-history';
import { approvalKinds } from '@/domains/company-work/approvals';
import { jsonRequest } from '@/components/aurelius/memory-editor';
import type {
  approvalCreate,
  approvalDecide,
  approvalRevoke,
} from '@/domains/founder-office/approvals';
import type { z } from 'zod';
type Work = Awaited<ReturnType<typeof readWork>>;
type Receipt =
  z.infer<typeof approvalCreate> | z.infer<typeof approvalDecide> | z.infer<typeof approvalRevoke>;
export function MissionApprovals({
  work,
  onChanged,
  disabled = false,
}: {
  work: Work;
  onChanged: (work: Work) => void;
  disabled?: boolean;
}) {
  const [title, setTitle] = useState(''),
    [proposal, setProposal] = useState('');
  const [kind, setKind] = useState<(typeof approvalKinds)[number]>('publishing');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [retry, setRetry] = useState<Receipt | null>(null);
  const approvals = work.versions[0]?.content.approvalRequests ?? [];
  async function submit(body: Receipt) {
    if (busy || disabled) return;
    setBusy(true);
    setRetry(body);
    try {
      const saved = await jsonRequest('/api/founder-office/approvals', 'POST', body);
      onChanged(saved);
      setRetry(null);
      setTitle('');
      setProposal('');
      setMessage('Decision or request saved. No external action was executed.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Approval save unconfirmed.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="mission-approval-plan">
      <h2>Consequential actions</h2>
      <p>
        Review the exact proposed action before approving it. Approval records your decision;
        executing it requires an authorized connection and a separate execution receipt.
      </p>
      {approvals.map((item) => (
        <article className="founder-card" key={item.id}>
          <h3>{item.title}</h3>
          <p>
            {item.kind.replaceAll('_', ' ')} · {item.status}
            {item.status === 'approved' ? ' · execution unavailable' : ''}
          </p>
          <p className="founder-prewrap">{item.proposal}</p>
          {item.figureIds.map((id) => {
            const figure = work.job.scope.figures.find((figure) => figure.id === id);
            return figure ? (
              <p key={id}>
                {figure.label}: {figure.value} · source: {figure.source}
              </p>
            ) : null;
          })}
          {item.status === 'approved' && (
            <button
              disabled={busy || disabled || Boolean(retry)}
              onClick={() =>
                void submit({
                  companyId: work.job.company_id,
                  jobId: work.job.id,
                  expected: work.job.revision,
                  versionId: crypto.randomUUID(),
                  proposalId: item.id,
                  action: 'revoke',
                })
              }
            >
              Withdraw approval
            </button>
          )}
          <details>
            <summary>Decision history</summary>
            <ol>
              {approvalHistory(work.versions, item.id).map((receipt) => (
                <li key={receipt.versionId}>
                  {receipt.event.replaceAll('_', ' ')} · revision {receipt.revision} ·{' '}
                  <time dateTime={receipt.savedAt}>{receipt.savedAt}</time> · {receipt.source}
                </li>
              ))}
            </ol>
            <p>
              Recent saved decisions only, from up to 100 loaded versions. Earlier history may be
              omitted. No external execution receipt is attached.
            </p>
          </details>
          {item.status === 'pending' && (
            <div className="io-work-links">
              {[true, false].map((approve) => (
                <button
                  key={String(approve)}
                  disabled={busy || disabled || Boolean(retry)}
                  onClick={() =>
                    void submit({
                      companyId: work.job.company_id,
                      jobId: work.job.id,
                      expected: work.job.revision,
                      versionId: crypto.randomUUID(),
                      proposalId: item.id,
                      approve,
                    })
                  }
                >
                  {approve ? 'Approve proposal' : 'Reject proposal'}
                </button>
              ))}
            </div>
          )}
        </article>
      ))}
      <form
        className="editor-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit({
            companyId: work.job.company_id,
            jobId: work.job.id,
            expected: work.job.revision,
            versionId: crypto.randomUUID(),
            proposal: {
              id: crypto.randomUUID(),
              title: title.trim(),
              proposal: proposal.trim(),
              kind,
              figureIds: [],
            },
          });
        }}
      >
        <fieldset disabled={busy || disabled || Boolean(retry) || approvals.length >= 12}>
          <label htmlFor="mission-approval-kind">Action category</label>
          <select
            id="mission-approval-kind"
            value={kind}
            onChange={(e) => setKind(e.target.value as (typeof approvalKinds)[number])}
          >
            {approvalKinds.map((kind) => (
              <option key={kind} value={kind}>
                {kind.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
          <label htmlFor="mission-approval-title">Approval title</label>
          <input
            id="mission-approval-title"
            required
            minLength={3}
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <label htmlFor="mission-approval-proposal">
            Exact proposed action, target and limits
          </label>
          <textarea
            id="mission-approval-proposal"
            required
            minLength={3}
            maxLength={2000}
            rows={4}
            value={proposal}
            onChange={(e) => setProposal(e.target.value)}
          />
          <button type="submit" className="secondary-button">
            Save for approval
          </button>
        </fieldset>
      </form>
      {message && <p role="status">{message}</p>}
      {retry && (
        <button disabled={busy || disabled} onClick={() => void submit(retry)}>
          Recover exact approval request
        </button>
      )}
      <p>
        Each change retains an immutable mission version. Its saved time and owner provide the
        decision receipt; historical versions remain inspectable.
      </p>
    </section>
  );
}
