'use client';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { coworkers, council, specialist, type SpecialistId } from '@/domains/intelligence/council';
import type { FounderOfficeData } from '@/domains/founder-office/service';
import { MemoryEditor, jsonRequest } from '@/components/aurelius/memory-editor';
import { BriefEditor } from '@/components/companies/brief-editor';
import type { readWork } from '@/domains/company-work/service';
import type { inspectPlatform } from '@/domains/founder-office/platform';
import { MissionTasks } from './mission-tasks';
import { MissionApprovals } from './mission-approvals';
import { founderRequest } from '@/domains/founder-office/schema';
import type { WorkScope } from '@/domains/company-work/schema';
import { routeFounderCoworker } from '@/domains/founder-office/routing';
import { PortfolioBriefing } from './portfolio-briefing';

type RequestReceipt = {
  companyId: string;
  jobId: string;
  conversationId: string;
  objective: string;
  specialistId: SpecialistId;
  requestId: string;
  evidence: WorkScope['evidence'];
  figures: WorkScope['figures'];
};
export function FounderOffice({ initial }: { initial: FounderOfficeData }) {
  const [data, setData] = useState(initial);
  const [companyId, setCompanyId] = useState(initial.companies[0]?.id ?? '');
  const [coworker, setCoworker] = useState<SpecialistId | 'auto'>('auto');
  const [objective, setObjective] = useState('');
  const [sourceNote, setSourceNote] = useState('');
  const [figures, setFigures] = useState<WorkScope['figures']>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [receipt, setReceipt] = useState<RequestReceipt | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof readWork>> | null>(null);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('');
  const [platform, setPlatform] = useState<Awaited<ReturnType<typeof inspectPlatform>> | null>(
    null,
  );
  const [platformError, setPlatformError] = useState('');
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  async function refresh() {
    const response = await fetch('/api/founder-office', { cache: 'no-store' });
    const next = await response.json();
    if (!response.ok) throw new Error(next.error ?? 'Founder records unavailable.');
    if (alive.current) setData(next);
  }
  async function prepare(event?: React.FormEvent, generate = true) {
    event?.preventDefault();
    if (busy || !companyId || objective.trim().length < 3 || receipt) return;
    const request: RequestReceipt = {
      companyId,
      jobId: crypto.randomUUID(),
      conversationId: crypto.randomUUID(),
      objective: objective.trim(),
      specialistId: coworker === 'auto' ? routeFounderCoworker(objective) : coworker,
      requestId: crypto.randomUUID(),
      evidence: sourceNote.trim()
        ? [{ label: 'Founder-confirmed source note', detail: sourceNote.trim() }]
        : [],
      figures,
    };
    const { requestId: requestIdentifier, ...checkedBody } = request;
    void requestIdentifier;
    const checked = founderRequest.safeParse(checkedBody);
    if (!checked.success) {
      setMessage(
        checked.error.issues[0]?.message ?? 'Complete the confirmed figure and source fields.',
      );
      return;
    }
    setReceipt(request);
    setResult(null);
    setBusy(true);
    setMessage('Saving the company mission…');
    try {
      const { requestId: _, ...body } = request;
      void _;
      const work = await jsonRequest('/api/founder-office', 'POST', body);
      if (alive.current) {
        setResult(work);
        setMessage('Mission saved. Prepare its deliverable when you are ready.');
      }
      if (generate && data.operations.modelConfigured) {
        if (alive.current)
          setMessage(
            `${specialist(request.specialistId).name} is preparing the company deliverable…`,
          );
        const delivered = await jsonRequest('/api/company-work', 'POST', {
          companyId: request.companyId,
          jobId: request.jobId,
          requestId: request.requestId,
          expected: 0,
          instruction: request.objective,
          specialistId: request.specialistId,
        });
        if (alive.current) {
          setResult(delivered);
          setMessage(
            'Deliverable saved. Open the mission to inspect, revise, review or export it.',
          );
        }
      }
      await refresh();
    } catch (error) {
      if (alive.current)
        setMessage(error instanceof Error ? error.message : 'Mission save unconfirmed.');
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function execute() {
    if (!receipt || busy) return;
    setBusy(true);
    setMessage(
      result
        ? `${specialist(receipt.specialistId).name} is preparing the company deliverable…`
        : 'Checking the exact mission receipt…',
    );
    try {
      const { requestId: _, ...body } = receipt;
      void _;
      const prepared = result ?? (await jsonRequest('/api/founder-office', 'POST', body));
      if (alive.current) setResult(prepared);
      const work = await jsonRequest('/api/company-work', 'POST', {
        companyId: receipt.companyId,
        jobId: receipt.jobId,
        requestId: receipt.requestId,
        expected: 0,
        instruction: receipt.objective,
        specialistId: receipt.specialistId,
      });
      if (alive.current) {
        setResult(work);
        setMessage('Deliverable saved. Open the mission to inspect, revise, review or export it.');
      }
      await refresh();
    } catch (error) {
      if (alive.current)
        setMessage(
          error instanceof Error
            ? error.message
            : 'Work unconfirmed. Open the saved mission before retrying.',
        );
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  const selected = data.companies.find((c) => c.id === companyId);
  const missions = data.missions.filter(
    (m) =>
      !filter ||
      `${m.title} ${m.companyName} ${m.summary ?? ''}`.toLowerCase().includes(filter.toLowerCase()),
  );
  const needsAttention = data.missions.filter((m) => m.status !== 'reviewed');
  return (
    <section className="founder-office" aria-labelledby="founder-office-title">
      <header className="io-hero io-hero-work">
        <p className="eyebrow">AETHELIOS / FOUNDER OFFICE</p>
        <h1 id="founder-office-title">
          {data.person.displayName
            ? `${data.person.displayName}’s office.`
            : 'Your Founder Office.'}
        </h1>
        <p>Company intelligence, useful work and decisions that carry forward.</p>
        <p className="founder-authority">
          Founder authority verified by your account. Membership is independent.
        </p>
        {data.person.priority && <p>Current priority: {data.person.priority}</p>}
        <nav className="io-work-links" aria-label="Founder destinations">
          <a className="secondary-button" href="#founder-attention">
            Needs attention · {needsAttention.length}
          </a>
          <a className="secondary-button" href="#founder-approvals">
            Approvals
          </a>
          <a className="secondary-button" href="#founder-context">
            Memory & identity
          </a>
          <a className="secondary-button" href="#founder-operations">
            Operations
          </a>
          <Link className="secondary-button" href="/app/aethelios">
            Personal Talk ↗
          </Link>
        </nav>
      </header>
      <section className="panel founder-command" aria-labelledby="founder-command-title">
        <h2 id="founder-command-title">Assemble the work.</h2>
        <p>
          Select the business boundary. Confirmed company context accompanies the request; personal
          memory and other businesses stay outside it.
        </p>
        <button
          className="secondary-button"
          disabled={busy || Boolean(receipt)}
          onClick={() => setCreating(true)}
        >
          Add a company or project
        </button>
        {creating && (
          <BriefEditor
            onCancel={() => setCreating(false)}
            onSaved={async (company) => {
              setCompanyId(company.id);
              setCreating(false);
              await refresh();
            }}
          />
        )}
        <form className="editor-form" onSubmit={(event) => void prepare(event)}>
          <fieldset disabled={busy || Boolean(receipt)}>
            <label htmlFor="founder-company">Company or project</label>
            <select
              id="founder-company"
              value={companyId}
              required
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">Choose a saved company</option>
              {data.companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <label htmlFor="founder-coworker">Assigned Coworker</label>
            <select
              id="founder-coworker"
              value={coworker}
              onChange={(e) => setCoworker(e.target.value as SpecialistId | 'auto')}
            >
              <option value="auto">Aethelios · route to a Coworker</option>
              {[...coworkers, ...council].map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.role}
                </option>
              ))}
            </select>
            {coworker === 'auto' && objective.trim() && (
              <p>
                Suggested lead: {specialist(routeFounderCoworker(objective)).name}. Other roles can
                join through the saved task plan or Coworker Council.
              </p>
            )}
            <label htmlFor="founder-objective">What needs to happen?</label>
            <textarea
              id="founder-objective"
              required
              minLength={3}
              maxLength={3000}
              rows={4}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Have MARA review the financial picture. Prepare a product plan. Create the proposal."
            />
            <p>
              Type your request or use your device keyboard’s dictation. Live conversation is not
              connected yet.
            </p>
            <details>
              <summary>Business evidence & confirmed figures</summary>
              <p>
                Only include records you authorize for this company and model request. Confirmed
                figures retain their source; assumptions belong in the source note.
              </p>
              <label htmlFor="founder-source-note">Business source note</label>
              <textarea
                id="founder-source-note"
                rows={3}
                maxLength={2000}
                value={sourceNote}
                onChange={(e) => setSourceNote(e.target.value)}
              />
              {figures.map((figure, index) => (
                <div className="founder-card" key={figure.id}>
                  <label htmlFor={`figure-label-${index}`}>Figure label {index + 1}</label>
                  <input
                    id={`figure-label-${index}`}
                    maxLength={80}
                    value={figure.label}
                    onChange={(e) =>
                      setFigures((previous) =>
                        previous.map((item) =>
                          item.id === figure.id ? { ...item, label: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <label htmlFor={`figure-value-${index}`}>Confirmed value {index + 1}</label>
                  <input
                    id={`figure-value-${index}`}
                    maxLength={80}
                    value={figure.value}
                    onChange={(e) =>
                      setFigures((previous) =>
                        previous.map((item) =>
                          item.id === figure.id ? { ...item, value: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <label htmlFor={`figure-source-${index}`}>Source and date {index + 1}</label>
                  <input
                    id={`figure-source-${index}`}
                    maxLength={300}
                    value={figure.source}
                    onChange={(e) =>
                      setFigures((previous) =>
                        previous.map((item) =>
                          item.id === figure.id ? { ...item, source: e.target.value } : item,
                        ),
                      )
                    }
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFigures((previous) => previous.filter((item) => item.id !== figure.id))
                    }
                  >
                    Remove figure {index + 1}
                  </button>
                </div>
              ))}
              <button
                type="button"
                disabled={figures.length >= 12}
                onClick={() =>
                  setFigures((previous) => [
                    ...previous,
                    { id: crypto.randomUUID(), label: '', value: '', source: '' },
                  ])
                }
              >
                Add confirmed figure
              </button>
            </details>
            <button className="button" type="submit" disabled={!companyId}>
              {data.operations.modelConfigured ? 'Prepare and save work' : 'Save mission'}
            </button>
            {data.operations.modelConfigured && (
              <button
                type="button"
                className="secondary-button"
                disabled={!companyId}
                onClick={() => void prepare(undefined, false)}
              >
                Save objective only
              </button>
            )}
          </fieldset>
        </form>
        {selected && (
          <details>
            <summary>
              Context source · {selected.name} · brief v{selected.version}
            </summary>
            <p className="founder-prewrap">
              {selected.brief ||
                'No business facts saved. Add the relevant evidence before expecting a financial or operational assessment.'}
            </p>
            <Link href={`/app/companies/${selected.id}`}>Review the company context ↗</Link>
          </details>
        )}
        {receipt && (
          <div className="founder-receipt">
            <p>
              Mission receipt: <code>{receipt.jobId}</code>
            </p>
            <Link href={`/app/companies/${receipt.companyId}/work/${receipt.jobId}`}>
              Open or recover saved mission ↗
            </Link>
            {!result?.versions.length && (
              <button
                className="button"
                disabled={busy || !data.operations.modelConfigured}
                onClick={() => void execute()}
              >
                {result
                  ? 'Prepare and save deliverable'
                  : 'Recover mission and prepare deliverable'}
              </button>
            )}
            {result?.versions[0] && (
              <>
                <h3>{result.versions[0].content.title}</h3>
                <p>{result.versions[0].content.summary}</p>
                <MissionTasks work={result} onChanged={setResult} disabled={busy} />
                <MissionApprovals work={result} onChanged={setResult} disabled={busy} />
              </>
            )}
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() => {
                setReceipt(null);
                setResult(null);
                setObjective('');
                setSourceNote('');
                setFigures([]);
                setMessage('');
              }}
            >
              Start another mission
            </button>
          </div>
        )}
        {message && (
          <p role="status" aria-live="polite">
            {message}
          </p>
        )}
        {!data.operations.modelConfigured && (
          <p>
            Model connection unavailable. You can save context and missions; deliverable generation
            requires the configured server connection.
          </p>
        )}
      </section>
      <PortfolioBriefing configured={data.operations.modelConfigured} onSaved={refresh} />
      <section id="founder-attention" className="panel" aria-labelledby="founder-attention-title">
        <h2 id="founder-attention-title">Portfolio & saved missions</h2>
        <p>
          {needsAttention.length} saved jobs need preparation or review. A reviewed draft is not a
          completed external action. Showing the latest 100 jobs.
        </p>
        <label htmlFor="founder-search">Search companies, missions and deliverable summaries</label>
        <input id="founder-search" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="founder-grid">
          {data.companies.map((c) => (
            <Link className="founder-card" key={c.id} href={`/app/companies/${c.id}`}>
              <h3>{c.name}</h3>
              <p>
                Company context v{c.version} ·{' '}
                {data.missions.filter((m) => m.companyId === c.id).length} recent missions
              </p>
            </Link>
          ))}
        </div>
        {!missions.length && <p>No matching saved missions. Save your first objective above.</p>}
        {data.personalMissions.map((mission) => (
          <article className="founder-card" key={mission.id}>
            <p className="eyebrow">
              Personal / portfolio mission · {mission.status.replaceAll('_', ' ')}
            </p>
            <h3>{mission.title}</h3>
            <p>{mission.next_actions}</p>
            <Link href={`/app/aethelios?conversation=${mission.conversation_id}`}>
              Resume saved conversation ↗
            </Link>
            <Link href="/app/missions">Review mission direction ↗</Link>
          </article>
        ))}
        {missions.map((m) => (
          <article key={m.id} className="founder-card">
            <p className="eyebrow">
              {m.companyName} / {m.status.replaceAll('_', ' ')}
              {m.assignment ? ` / ${m.assignment.toUpperCase()}` : ''}
            </p>
            <h3>
              <Link href={`/app/companies/${m.companyId}/work/${m.id}`}>{m.title}</Link>
            </h3>
            <p>{m.summary ?? 'Mission context saved. Deliverable not confirmed.'}</p>
            {!!m.readiness?.length && (
              <ul aria-label="Saved task readiness">
                {m.readiness
                  .filter((task) => task.state !== 'completed')
                  .map((task) => (
                    <li key={task.id}>
                      {task.title} · {task.state.replaceAll('_', ' ')} ·{' '}
                      {task.assignee.toUpperCase()}
                    </li>
                  ))}
              </ul>
            )}
            {!!m.actions.length && (
              <details>
                <summary>Next actions & evidence gaps</summary>
                <ul>
                  {m.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
                {m.gaps.map((g, i) => (
                  <p key={i}>{g}</p>
                ))}
              </details>
            )}
            <p>
              Deliverable revision {m.revision} ·{' '}
              {(m.tasks?.length ?? 0) > 0 &&
                `${m.tasks.filter((task) => task.status === 'completed').length}/${m.tasks.length} tasks complete · `}
              <time dateTime={m.createdAt}>{m.createdAt.slice(0, 10)}</time>
            </p>
            <Link href={`/app/companies/${m.companyId}/work/${m.id}`}>
              Resume, inspect history or recover ↗
            </Link>
          </article>
        ))}
      </section>
      <section id="founder-approvals" className="panel">
        <h2>Founder Approval Center</h2>
        {data.missions.flatMap((m) =>
          (m.approvals ?? []).map((item) => (
            <article className="founder-card" key={`${m.id}:${item.id}`}>
              <p className="eyebrow">
                {m.companyName} / {item.kind.replaceAll('_', ' ')}
              </p>
              <h3>{item.title}</h3>
              <p>
                {item.status}
                {item.status === 'approved' ? ' · execution unavailable' : ''}
              </p>
              <p>{item.proposal}</p>
              <Link href={`/app/companies/${m.companyId}/work/${m.id}`}>
                Review exact proposal & decision history ↗
              </Link>
            </article>
          )),
        )}
        <p>
          Daily action proposals and saved company deliverables await explicit review. External
          communication, purchases, publishing, deployments and account changes have no connected
          executor here.
        </p>
        {!data.proposals.length && <p>No saved daily action proposals.</p>}
        {data.proposals.map((p) => (
          <article className="founder-card" key={p.id}>
            <h3>{p.title}</h3>
            <p>
              {p.status} · {p.proposed_at.slice(0, 10)}
            </p>
            {p.status === 'pending' && (
              <div className="io-work-links">
                {[true, false].map((approve) => (
                  <button
                    key={String(approve)}
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        await jsonRequest('/api/aurelius/actions', 'PUT', {
                          proposalId: p.id,
                          approve,
                          title: approve ? p.title : null,
                        });
                        await refresh();
                        setMessage(approve ? 'Daily action saved.' : 'Proposal rejection saved.');
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : 'Decision unconfirmed.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {approve ? 'Approve daily action' : 'Reject'}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
        <Link href="/app/aethelios">Review proposals in Talk ↗</Link>
      </section>
      <section id="founder-context" className="panel">
        <h2>Founder intelligence</h2>
        <p>
          Memory stays in this account. Each save is explicit; correction and forgetting affect
          future retrieval. Historical conversations retain what was shared in that session. Company
          rooms use their own confirmed briefs.
        </p>
        <Link href="/app/you">Edit identity, preferences or sign out ↗</Link>
        <MemoryEditor memories={data.memories} onChanged={refresh} disabled={busy} />
        <div className="io-work-links">
          <Link href="/app/ongoing">Commitments ↗</Link>
          <Link href="/app/captures">Capture & reminders ↗</Link>
          <Link href="/app/missions">Personal missions ↗</Link>
          <Link href="/app/studio">Saved creative work ↗</Link>
        </div>
      </section>
      <section id="founder-operations" className="panel">
        <h2>Platform command</h2>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setPlatformError('');
            try {
              const response = await fetch('/api/founder-office/platform', { cache: 'no-store' });
              const snapshot = await response.json();
              if (!response.ok)
                throw new Error(snapshot.error ?? 'Platform observation unavailable.');
              setPlatform(snapshot);
            } catch (error) {
              setPlatformError(
                error instanceof Error ? error.message : 'Platform observation unavailable.',
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          Inspect public Aethelios availability & repository
        </button>
        {platformError && <p role="alert">{platformError}</p>}
        {platform && (
          <article className="founder-card">
            <h3>Observed public platform</h3>
            <p>
              Observed {platform.asOf} ·{' '}
              {platform.application.available
                ? `Homepage returned HTTP ${platform.application.status}`
                : 'Homepage health unknown or unsuccessful'}
              .
            </p>
            <p>
              Canonical repository commit: <code>{platform.commit ?? 'unavailable'}</code>
            </p>
            <p>{platform.limits}</p>
            {platform.repositoryIssue && <p>{platform.repositoryIssue}</p>}
            {platform.workflows.map((run, i) => (
              <p key={run.id ?? i}>
                {run.url ? (
                  <a href={run.url} target="_blank" rel="noreferrer">
                    {run.name}
                  </a>
                ) : (
                  run.name
                )}{' '}
                · {run.status} / {run.conclusion ?? 'no conclusion'} · commit{' '}
                <code>{run.sha ?? 'unknown'}</code>
              </p>
            ))}
            <details>
              <summary>Source provenance</summary>
              {platform.files.map((file) => (
                <p key={file.path}>
                  <a href={file.source} target="_blank" rel="noreferrer">
                    {file.path}
                  </a>{' '}
                  ·{' '}
                  {file.ok
                    ? file.excerpted
                      ? 'partial excerpt retrieved'
                      : 'retrieved'
                    : 'unavailable'}
                </p>
              ))}
            </details>
          </article>
        )}
        <p>
          Observed from your account at {data.asOf}. This is your recent execution ledger, not
          platform-wide monitoring.
        </p>
        <dl className="founder-metrics">
          <div>
            <dt>Recorded input tokens</dt>
            <dd>{data.operations.inputTokens.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Recorded output tokens</dt>
            <dd>{data.operations.outputTokens.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Failed / cancelled turns</dt>
            <dd>
              {
                data.operations.turns.filter(
                  (t) => t.status === 'failed' || t.status === 'cancelled',
                ).length
              }
            </dd>
          </div>
          <div>
            <dt>Unfinished usage records</dt>
            <dd>{data.operations.incompleteUsage}</dd>
          </div>
        </dl>
        <p>
          Seven-day window; latest 300 records.{' '}
          {data.operations.bounded ? 'The window is truncated.' : ''} Unrecorded usage and
          auxiliary/voice/media usage are excluded. Dollar cost, member metrics, runtime logs and
          latency are unavailable.
        </p>
        <div className="founder-grid">
          {[
            [
              'OpenAI',
              data.operations.modelConfigured
                ? `Server configuration present · ${data.operations.model}. Live health unverified.`
                : 'Server connection not configured.',
            ],
            [
              'Supabase',
              'Account-bound reads succeeded for this refresh. Founder and owner permissions still apply.',
            ],
            [
              'GitHub',
              'Public canonical repository inspection is available on request. No authorized repository writes or private access.',
            ],
            ['Vercel', 'Not connected to in-app deployment monitoring or execution.'],
            [
              'Commerce',
              data.operations.commerceConfigured
                ? 'Storefront configuration present; live health unverified.'
                : 'Storefront connection not configured.',
            ],
            [
              'Documents, email & calendar',
              'No authorized connection in this office. Supply context in the selected company brief.',
            ],
            ['Live voice', 'Not connected. Text and device dictation use the saved-work flow.'],
          ].map(([name, status]) => (
            <article className="founder-card" key={name}>
              <h3>{name}</h3>
              <p>{status}</p>
            </article>
          ))}
        </div>
        <details>
          <summary>Recent execution receipts</summary>
          {data.operations.turns.map((t) => (
            <p key={t.id}>
              <code>{t.id}</code> · {t.status} · {t.model} · {t.created_at.slice(0, 19)}
            </p>
          ))}
        </details>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await refresh();
              setMessage('Founder records refreshed.');
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Refresh failed.');
            } finally {
              setBusy(false);
            }
          }}
        >
          Refresh observed records
        </button>
      </section>
    </section>
  );
}
