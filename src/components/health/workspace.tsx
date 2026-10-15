'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ContextSheet } from '@/components/interaction/context-sheet';
import { biomarkerSeries } from '@/domains/health/trends';
import {
  emptyHealth,
  type HealthData,
  type HealthSendResult,
  type Mutation,
  type Observation,
  type Purpose,
  type SavedObservation,
} from '@/domains/health/schema';
import { HealthAtelier } from './atelier';
import './health.css';

export type HealthView = 'command' | 'history' | 'records' | 'labs' | 'connections' | 'privacy';
const destinations: [HealthView, string, string][] = [
  ['command', '/app/health', 'Command'],
  ['history', '/app/health/history', 'History'],
  ['records', '/app/health/records', 'Records'],
  ['labs', '/app/health/labs', 'Labs'],
  ['connections', '/app/health/connections', 'Connections'],
  ['privacy', '/app/health/privacy', 'Privacy'],
];
const fields = ['name', 'value', 'unit', 'date', 'specimen', 'method', 'range', 'flag'] as const;
const fieldLabels = {
  name: 'Test name',
  value: 'Reported value',
  unit: 'Unit',
  date: 'Collection date',
  specimen: 'Specimen',
  method: 'Method',
  range: 'Reported reference range',
  flag: 'Reported flag',
};
const format = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n);
export function HealthWorkspace({
  initial,
  view = 'command',
}: {
  initial: HealthData;
  view?: HealthView;
}) {
  const [data, setData] = useState(initial),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState('');
  const [adult, setAdult] = useState(false),
    [reviewId, setReviewId] = useState<string | null>(null);
  const [review, setReview] = useState<Observation[]>([]),
    [editing, setEditing] = useState<SavedObservation | null>(null);
  const [correction, setCorrection] = useState<Observation | null>(null),
    [reason, setReason] = useState(''),
    [excluded, setExcluded] = useState(false);
  const [talk, setTalk] = useState(false),
    [question, setQuestion] = useState(''),
    [evidence, setEvidence] = useState<string[]>([]);
  const [deletion, setDeletion] = useState<string | 'all' | null>(null);
  const owner = useRef(initial.owner),
    uploadInput = useRef<HTMLInputElement>(null);
  const pending = useRef<{ body: Mutation | FormData; endpoint: string } | null>(null),
    [uncertain, setUncertain] = useState(false),
    [inspected, setInspected] = useState(false);
  const mounted = useRef(true);
  const has = (purpose: Purpose) => data.consents.some((c) => c.purpose === purpose && c.granted);
  const accept = useCallback((next: HealthData) => {
    if (next.owner !== owner.current) {
      owner.current = next.owner;
      setData(emptyHealth());
      setReview([]);
      setReviewId(null);
      setEditing(null);
      setCorrection(null);
      setQuestion('');
      setEvidence([]);
      setTalk(false);
      pending.current = null;
      setUncertain(false);
      setNotice('Your session changed. Reopen Health after signing in.');
      return;
    }
    if (document.visibilityState === 'visible') setData(next);
  }, []);
  const reload = useCallback(async () => {
    const response = await fetch('/api/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 401) {
      accept(emptyHealth());
      return;
    }
    if (!response.ok) throw new Error('Health records could not be refreshed.');
    accept(await response.json());
  }, [accept]);
  useEffect(() => {
    mounted.current = true;
    const clear = () => {
      setData(emptyHealth());
      setReview([]);
      setReviewId(null);
      setEditing(null);
      setCorrection(null);
      setQuestion('');
      setEvidence([]);
      setTalk(false);
      pending.current = null;
      setUncertain(false);
    };
    const refresh = () => {
      if (document.visibilityState === 'visible')
        void reload().catch(() => setNotice('Reconnect to reopen your private records.'));
      else clear();
    };
    window.addEventListener('pagehide', clear);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    return () => {
      mounted.current = false;
      window.removeEventListener('pagehide', clear);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [reload]);
  async function send(
    body?: Mutation | FormData,
    endpoint = '/api/health',
  ): Promise<HealthSendResult> {
    if (busy || (!body && !pending.current))
      return { status: 'ignored', message: 'Health is already finishing a request.' };
    if (body && uncertain) {
      setNotice('Resolve the previous request before starting another.');
      return {
        status: 'ignored',
        message: 'Resolve the previous request before starting another.',
      };
    }
    const requestOwner = owner.current;
    const request = body ? { body, endpoint } : pending.current!;
    pending.current = request;
    setBusy(true);
    setInspected(false);
    setNotice('');
    try {
      const response = await fetch(request.endpoint, {
        method: 'POST',
        cache: 'no-store',
        headers: {
          'x-aethelios-health-owner': requestOwner || '',
          ...(request.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        },
        body: request.body instanceof FormData ? request.body : JSON.stringify(request.body),
        signal: AbortSignal.timeout(60000),
      });
      const result = await response.json();
      if (!response.ok) {
        const message = result.error || 'Health could not complete the request.';
        if ([400, 401, 403, 413, 415].includes(response.status)) {
          pending.current = null;
          setUncertain(false);
          setNotice(message);
          return { status: 'failed', message };
        }
        setUncertain(true);
        setNotice(message);
        return { status: 'uncertain', message };
      }
      if (
        !mounted.current ||
        document.visibilityState !== 'visible' ||
        owner.current !== requestOwner
      ) {
        setUncertain(true);
        return {
          status: 'uncertain',
          message:
            'The last request may have reached the server. Inspect saved status before retrying.',
        };
      }
      await reload();
      if (owner.current !== requestOwner) {
        return {
          status: 'uncertain',
          message: 'Your session changed. Reopen Health after signing in.',
        };
      }
      if (request.endpoint.endsWith('/export')) {
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob),
          link = document.createElement('a');
        link.href = url;
        link.download = 'aethelios-health-export.json';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        await reload();
      }
      pending.current = null;
      setUncertain(false);
      setReviewId(null);
      setEditing(null);
      setCorrection(null);
      setDeletion(null);
      if (uploadInput.current) uploadInput.current.value = '';
      setNotice('Saved to your private Health environment.');
      return { status: 'confirmed' };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Connection interrupted. Inspect the saved status before retrying.';
      if (mounted.current) {
        if (pending.current) setUncertain(true);
        setNotice(message);
      }
      return pending.current ? { status: 'uncertain', message } : { status: 'failed', message };
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const blocked = busy || uncertain || data.mode !== 'personal';
  const series = biomarkerSeries(data.observations);
  function consent(purpose: Purpose, granted: boolean) {
    void send({ kind: 'consent', request: crypto.randomUUID(), purpose, granted, adult });
  }
  function openReview(id: string) {
    const r = data.records.find((r) => r.id === id);
    if (!r) return;
    setReviewId(id);
    setReview(structuredClone(r.candidates));
  }
  function openCorrection(o: SavedObservation) {
    setEditing(o);
    const { id, name, code, value, unit, date, specimen, method, range, flag } = o;
    setCorrection({ id, name, code, value, unit, date, specimen, method, range, flag });
    setReason('');
    setExcluded(o.status === 'excluded');
  }
  const titles: Record<HealthView, [string, string]> = {
    command: [
      'A clearer understanding of you.',
      'Your body, your history, and the information that matters.',
    ],
    history: [
      'Your history. Kept in context.',
      'The original, the observation, and every correction belong together.',
    ],
    records: [
      'Your private records vault.',
      'Keep the information once. Return to it when it matters.',
    ],
    labs: ['Results, with perspective.', 'Understand reported values before drawing conclusions.'],
    connections: [
      'Connected on your terms.',
      'Choose what Health can use. Permissions remain yours.',
    ],
    privacy: [
      'Your information. Your authority.',
      'Inspect access, take your records with you, or remove them.',
    ],
  };
  const recovery = (notice || uncertain) && (
    <div className="health-notice" role="status">
      <p>{notice}</p>
      {uncertain && (
        <>
          <p>The last request may have reached the server. New changes are paused.</p>
          <button disabled={busy} onClick={() => void send()}>
            Retry exact request
          </button>
          <button
            disabled={busy}
            onClick={() =>
              void reload()
                .then(() => {
                  setInspected(true);
                  setNotice('Records refreshed. Review the saved state before closing recovery.');
                })
                .catch((e) => setNotice(e.message))
            }
          >
            Inspect saved status
          </button>
          {inspected && (
            <button
              disabled={busy}
              onClick={() => {
                pending.current = null;
                setUncertain(false);
                setInspected(false);
                setReviewId(null);
                setEditing(null);
                setNotice('Recovery closed. The current saved records remain authoritative.');
              }}
            >
              Close recovery after review
            </button>
          )}
        </>
      )}
    </div>
  );
  return (
    <div className="health-environment" data-view={view} aria-busy={busy}>
      {view !== 'command' && (
        <>
          <header className="health-compact-header">
            <p className="health-kicker">Aethelios / Health</p>
            <h1>{titles[view][0]}</h1>
            <p className="health-lead">{titles[view][1]}</p>
            <div className="health-hero-actions">
              <Link href="/app/health" prefetch={false}>
                Workspace
              </Link>
              <button onClick={() => setTalk(true)}>Understand with Aethelios</button>
            </div>
          </header>
          <nav className="health-navigation" aria-label="Health navigation">
            {destinations.map(([key, href, label]) => (
              <Link
                key={key}
                href={href}
                prefetch={false}
                aria-current={key === view ? 'page' : undefined}
              >
                {label}
              </Link>
            ))}
          </nav>
        </>
      )}
      {data.mode === 'signed-out' && (
        <section className="health-notice">
          <h2>Begin with your own information.</h2>
          <p>
            Sign in to open your private environment. No measurements or medical conclusions have
            been created.
          </p>
          <Link href="/enter">Sign in →</Link>
        </section>
      )}
      {data.mode === 'unavailable' && (
        <section className="health-notice">
          <h2>Your private foundation is being prepared.</h2>
          <p>
            Health storage is not available in this environment yet. Your existing Performance
            records remain in their own domain.
          </p>
          <Link href="/app/performance">Open Performance →</Link>
        </section>
      )}
      {view === 'command' ? (
        <HealthAtelier
          key={`${data.owner ?? 'none'}:${data.mode}`}
          data={data}
          send={send}
          busy={busy}
          blocked={blocked}
          recovery={!reviewId && !editing && !deletion && !talk ? recovery : null}
        />
      ) : (
        !reviewId && !editing && !deletion && !talk && recovery
      )}
      {view === 'records' && (
        <section className="health-section">
          <div className="health-section-heading">
            <div>
              <p className="health-kicker">ORIGINALS & REVIEWED RESULTS</p>
              <h2>Keep the source.</h2>
            </div>
          </div>
          <form
            className="health-upload"
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              if (!(form.get('file') instanceof File)) return;
              form.set('request', crypto.randomUUID());
              form.set('id', crypto.randomUUID());
              void send(form);
            }}
          >
            <label>
              Record title
              <input
                name="title"
                required
                maxLength={120}
                placeholder="A name you will recognize"
                disabled={blocked || !has('records') || !data.ingestionEnabled}
              />
            </label>
            <label>
              Original report
              <input
                ref={uploadInput}
                name="file"
                type="file"
                required
                accept=".pdf,.jpg,.jpeg,.png,.csv,.json"
                onChange={(e) => {
                  const title = e.currentTarget.form?.elements.namedItem('title');
                  if (
                    title instanceof HTMLInputElement &&
                    !title.value &&
                    e.currentTarget.files?.[0]
                  )
                    title.value = e.currentTarget.files[0].name
                      .replace(/\.[^.]+$/, '')
                      .slice(0, 120);
                }}
                disabled={blocked || !has('records') || !data.ingestionEnabled}
              />
            </label>
            <button disabled={blocked || !has('records') || !data.ingestionEnabled}>
              Add private record
            </button>
          </form>
          {!has('records') && (
            <p>
              <Link href="/app/health/connections">Allow private record storage</Link> before
              uploading.
            </p>
          )}
          {!data.ingestionEnabled && (
            <p className="health-footnote">
              Sensitive ingestion awaits isolation and privacy release acceptance.
            </p>
          )}
          <details className="health-import-guide">
            <summary>Supported import formats</summary>
            <p>
              PDF/JPEG/PNG originals up to 8 MB. Scanned and unsupported reports stay originals.
              CSV/JSON imports accept up to 100 results and 200 KB of text. Dates are collection
              dates; unknown methods and ranges stay blank.
            </p>
            <p>CSV header:</p>
            <code>name,value,unit,date,code,specimen,method,range,flag</code>
            <p>
              JSON is an array with those same fields. LOINC codes are retained as supplied, never
              guessed. Form-based PDF extraction supports only the documented Aethelios Lab Exchange
              v1 layout.
            </p>
          </details>
          <div className="health-record-list">
            {data.records.length ? (
              data.records.map((r) => (
                <article key={r.id} className="health-record">
                  <div>
                    <span className="health-file-mark" aria-hidden="true">
                      ↗
                    </span>
                  </div>
                  <div>
                    <h3>{r.title}</h3>
                    <p>
                      {new Date(r.created_at).toLocaleDateString()} · {(r.size / 1024).toFixed(0)}{' '}
                      KB · v{r.version}
                    </p>
                    <span className="health-status">{r.status.replaceAll('_', ' ')}</span>
                    {r.status === 'unsupported' && (
                      <p className="health-footnote">
                        Original retained. No results were inferred.
                      </p>
                    )}
                  </div>
                  <div className="health-record-actions">
                    {!['reserved', 'deleting'].includes(r.status) && (
                      <a href={`/api/health/records/${r.id}`}>Download original</a>
                    )}
                    {r.status === 'review_required' && (
                      <button
                        disabled={blocked || !has('records')}
                        onClick={() => openReview(r.id)}
                      >
                        Review results
                      </button>
                    )}
                    <button disabled={blocked} onClick={() => setDeletion(r.id)}>
                      Remove
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <div className="health-empty">
                <h3>A quieter place for your history.</h3>
                <p>
                  Save an original report once. Its source will remain attached to every reviewed
                  result.
                </p>
              </div>
            )}
          </div>
        </section>
      )}
      {view === 'labs' && (
        <section className="health-section">
          <div className="health-section-heading">
            <div>
              <p className="health-kicker">SOURCE-LED LAB INTELLIGENCE</p>
              <h2>Every result has context.</h2>
            </div>
            <Link href="/app/health/records">Add a report ↗</Link>
          </div>
          <p>
            Laboratory flags are reported information, not diagnoses. Comparisons require matching
            test, units, specimen and method.
          </p>
          {series.length ? (
            <div className="health-lab-grid">
              {series.map((s) => (
                <article key={s.key} className="health-panel">
                  <p className="health-kicker">
                    {s.latest.code ? `Reported code ${s.latest.code}` : 'Unmapped reported test'}
                  </p>
                  <h3>{s.name}</h3>
                  <div className="health-reading">
                    {s.latest.value} <small>{s.latest.unit}</small>
                  </div>
                  <p>{s.latest.date} · reviewed from your report</p>
                  <p>
                    Reported range: {s.latest.range || 'Not supplied'}
                    {s.latest.flag && ` · reported flag: ${s.latest.flag}`}
                  </p>
                  {s.difference !== null && (
                    <p className="health-difference">
                      {s.difference > 0 ? '+' : ''}
                      {format(s.difference)} {s.latest.unit} since {s.previous!.date}
                    </p>
                  )}
                  <p className="health-footnote">{s.limitation}</p>
                  <details>
                    <summary>History & provenance</summary>
                    <div className="health-table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Collected</th>
                            <th>Value</th>
                            <th>Range</th>
                            <th>Source</th>
                            <th>Correction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {s.rows.map((o) => (
                            <tr key={o.id}>
                              <td>{o.date}</td>
                              <td>
                                {o.value} {o.unit}
                              </td>
                              <td>{o.range || 'Unknown'}</td>
                              <td>
                                <a href={`/api/health/records/${o.record_id}`}>
                                  {data.records.find((r) => r.id === o.record_id)?.title ||
                                    'Original'}
                                </a>
                                <small>
                                  Confirmed {new Date(o.confirmed_at).toLocaleDateString()} · v
                                  {o.version}
                                </small>
                              </td>
                              <td>
                                <button
                                  disabled={blocked || !has('records') || !data.ingestionEnabled}
                                  onClick={() => openCorrection(o)}
                                >
                                  Correct
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      Specimen: {s.latest.specimen || 'Unknown'} · Method:{' '}
                      {s.latest.method || 'Unknown'}
                    </p>
                  </details>
                  <button
                    onClick={() => {
                      setEvidence([s.latest.id]);
                      setQuestion(
                        `Help me understand this reported ${s.name} result and prepare questions for my clinician.`,
                      );
                      setTalk(true);
                    }}
                  >
                    Understand this result ↗
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="health-empty">
              <h3>Results appear after review.</h3>
              <p>
                Add a supported lab report in Records. Health will never fill this space with
                assumed measurements.
              </p>
              <Link href="/app/health/records">Open records →</Link>
            </div>
          )}
          {data.observations.some((o) => o.status === 'excluded') && (
            <details>
              <summary>Excluded results</summary>
              {data.observations
                .filter((o) => o.status === 'excluded')
                .map((o) => (
                  <p key={o.id}>
                    {o.name} · {o.date}{' '}
                    <button
                      disabled={blocked || !has('records') || !data.ingestionEnabled}
                      onClick={() => openCorrection(o)}
                    >
                      Review exclusion
                    </button>
                  </p>
                ))}
            </details>
          )}
        </section>
      )}
      {view === 'history' && (
        <section className="health-section">
          <p className="health-kicker">A LONGITUDINAL VIEW</p>
          <h2>The information you have kept.</h2>
          <div className="health-timeline">
            {data.records.length ? (
              [...data.records]
                .sort((a, b) => {
                  const date = (id: string, fallback: string) =>
                    data.observations
                      .filter((o) => o.record_id === id)
                      .map((o) => o.date)
                      .sort()
                      .at(-1) || fallback;
                  return date(b.id, b.created_at).localeCompare(date(a.id, a.created_at));
                })
                .map((r) => {
                  const rows = data.observations.filter((o) => o.record_id === r.id);
                  return (
                    <article key={r.id}>
                      <p className="health-kicker">
                        {rows[0]?.date || 'Clinical date not supplied'}
                      </p>
                      <h3>{r.title}</h3>
                      <p>
                        {rows.length} reviewed results · added{' '}
                        {new Date(r.created_at).toLocaleDateString()}
                      </p>
                      <Link href="/app/health/records">Inspect original & status →</Link>
                      <p className="health-footnote">
                        Corrections preserve prior values in your private export. Upload date is
                        separate from collection date.
                      </p>
                    </article>
                  );
                })
            ) : (
              <div className="health-empty">
                <h3>Your history remains yours.</h3>
                <p>Records and reviewed results will appear here with their actual dates.</p>
              </div>
            )}
          </div>
        </section>
      )}
      {(view === 'connections' || view === 'privacy') && (
        <section className="health-section">
          <p className="health-kicker">PURPOSE-SPECIFIC ACCESS</p>
          <h2>You choose what belongs here.</h2>
          <label className="health-attestation">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} />I
            am 18 or older and am managing my own information.
          </label>
          <div className="health-permissions">
            {(
              [
                [
                  'wellness',
                  'Existing Performance records',
                  'Show saved sleep duration, weight and movement in Health. Read-only; no model disclosure.',
                ],
                [
                  'records',
                  'Private records & lab review',
                  'Store originals and reviewed results. No access for commerce, other members or unrelated Entities.',
                ],
                [
                  'ai',
                  'Personalized Health conversation',
                  'Send only selected reviewed results and your question to the configured OpenAI processor. Provider retention depends on accepted project controls.',
                ],
              ] as [Purpose, string, string][]
            ).map(([purpose, label, description]) => (
              <article key={purpose} className="health-permission">
                <div>
                  <h3>{label}</h3>
                  <p>{description}</p>
                  <p className="health-footnote">
                    {has(purpose) ? 'Allowed' : 'Off'}
                    {data.consents.find((c) => c.purpose === purpose) &&
                      ` · changed ${new Date(data.consents.find((c) => c.purpose === purpose)!.updated_at).toLocaleDateString()}`}
                  </p>
                </div>
                <button
                  disabled={
                    blocked ||
                    (!has(purpose) &&
                      (!adult ||
                        (purpose === 'records' && !data.ingestionEnabled) ||
                        (purpose === 'ai' && !data.aiEnabled)))
                  }
                  onClick={() => consent(purpose, !has(purpose))}
                >
                  {has(purpose) ? 'Withdraw access' : 'Allow access'}
                </button>
              </article>
            ))}
          </div>
          {view === 'connections' && (
            <div className="health-future-connections">
              <h3>Device connections</h3>
              <p>
                Apple Health and Health Connect require a native bridge. Wearable and
                medical-provider connections are future phases; none is active here.
              </p>
              <div>
                <span>Apple Health · future</span>
                <span>Health Connect · future</span>
                <span>Wearables · future</span>
                <span>Medical records · future</span>
              </div>
            </div>
          )}
          {view === 'privacy' && (
            <>
              <div className="health-command-grid">
                <article className="health-panel">
                  <h3>Take your information with you.</h3>
                  <p>
                    Download originals, reviewed observations, corrections, processing receipts,
                    permissions and Health conversation in one JSON package. Reauthentication may be
                    required.
                  </p>
                  <button
                    disabled={blocked}
                    onClick={() =>
                      void send(
                        { kind: 'export', request: crypto.randomUUID() },
                        '/api/health/export',
                      )
                    }
                  >
                    Export private Health data
                  </button>
                </article>
                <article className="health-panel">
                  <h3>Remove your Health data.</h3>
                  <p>
                    Delete originals, results, corrections and Health conversation. Existing
                    Performance records remain in their own domain. Access is withdrawn immediately
                    while removal completes.
                  </p>
                  <button disabled={blocked} onClick={() => setDeletion('all')}>
                    Delete Health data
                  </button>
                </article>
              </div>
              <div className="health-privacy-note">
                <h3>Clear boundaries.</h3>
                <p>
                  Health uses encrypted infrastructure and owner permissions. It is not end-to-end
                  encrypted. Sensitive production processing awaits the approved isolation,
                  processor, retention and backup-deletion review. No health content is sent to
                  advertising, general memory, business rooms or Council.
                </p>
                <p>
                  Withdrawing a permission stops subsequent authorized processing; it does not
                  recall an already dispatched provider request. Stored originals remain until you
                  delete them.
                </p>
              </div>
              <h3>Processing history</h3>
              {data.jobs.length ? (
                data.jobs.map((j) => (
                  <p key={j.id}>
                    {j.kind === 'delete' ? 'Deletion' : 'Export'} · {j.status} ·{' '}
                    {new Date(j.created_at).toLocaleString()}
                    {j.kind === 'delete' && j.status !== 'complete' && (
                      <button
                        disabled={blocked}
                        onClick={() =>
                          void send({ kind: 'resume', request: crypto.randomUUID(), id: j.id })
                        }
                      >
                        Resume deletion
                      </button>
                    )}
                    {j.kind === 'export' && j.status !== 'complete' && (
                      <button
                        disabled={blocked}
                        onClick={() =>
                          void send({ kind: 'export', request: j.id }, '/api/health/export')
                        }
                      >
                        Resume export
                      </button>
                    )}
                  </p>
                ))
              ) : (
                <p>No export or deletion requests yet.</p>
              )}
            </>
          )}
        </section>
      )}
      {view !== 'command' && (
        <footer className="health-footer">
          <span>AETHELIOS — THE HUMAN ASCENDANCE</span>
          <p>
            Informational understanding, not diagnosis or treatment. Health is not an emergency
            monitoring service.
          </p>
          <small>View prepared {new Date(data.asOf).toLocaleString()}</small>
        </footer>
      )}
      <ContextSheet
        open={Boolean(reviewId)}
        title="Review imported results"
        busy={busy}
        fullScreen
        onClose={() => setReviewId(null)}
      >
        <div className="health-dialog">
          {reviewId && recovery}
          <p>
            Compare these fields with your original. They become user-reviewed observations only
            after confirmation.
          </p>
          {review.map((o, i) => (
            <details key={o.id} className="health-review-result">
              <summary>
                Result {i + 1}: {o.name} · {o.value} {o.unit} · {o.date} — review fields
              </summary>
              <fieldset>
                <legend>Reported fields</legend>
                <div className="health-edit-grid">
                  {fields.map((field) => (
                    <label key={field}>
                      {fieldLabels[field]}
                      <input
                        type={field === 'date' ? 'date' : 'text'}
                        value={o[field]}
                        maxLength={field === 'name' ? 120 : 100}
                        onChange={(e) =>
                          setReview((rows) =>
                            rows.map((r, index) =>
                              index === i ? { ...r, [field]: e.target.value } : r,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            </details>
          ))}
          <button
            disabled={blocked || !has('records') || !data.ingestionEnabled}
            onClick={() => {
              const r = data.records.find((r) => r.id === reviewId);
              if (r)
                void send({
                  kind: 'confirm',
                  request: crypto.randomUUID(),
                  id: r.id,
                  expected: r.version,
                  observations: review,
                });
            }}
          >
            Confirm reviewed results
          </button>
        </div>
      </ContextSheet>
      <ContextSheet
        open={Boolean(editing && correction)}
        title="Correct a reported result"
        busy={busy}
        onClose={() => setEditing(null)}
      >
        <div className="health-dialog">
          {editing && recovery}
          {correction && (
            <>
              <div className="health-edit-grid">
                {fields.map((field) => (
                  <label key={field}>
                    {fieldLabels[field]}
                    <input
                      type={field === 'date' ? 'date' : 'text'}
                      value={correction[field]}
                      onChange={(e) => setCorrection({ ...correction, [field]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <label>
                Reason for correction
                <input value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={excluded}
                  onChange={(e) => setExcluded(e.target.checked)}
                />
                Exclude from comparisons
              </label>
              <p>The prior version remains in your private correction history.</p>
              <button
                disabled={blocked || reason.trim().length < 3}
                onClick={() => {
                  if (editing)
                    void send({
                      kind: 'amend',
                      request: crypto.randomUUID(),
                      id: editing.id,
                      expected: editing.version,
                      observation: correction,
                      reason,
                      excluded,
                    });
                }}
              >
                Save correction
              </button>
            </>
          )}
        </div>
      </ContextSheet>
      <ContextSheet
        open={Boolean(deletion)}
        title="Delete private Health information?"
        busy={busy}
        onClose={() => setDeletion(null)}
      >
        <div className="health-dialog">
          {deletion && recovery}
          <p>
            {deletion === 'all'
              ? 'This removes your Health vault, results, revisions and conversations, and withdraws Health permissions.'
              : 'This removes this original and its results/revisions. Health conversations are cleared to prevent retained copies.'}
          </p>
          <p>
            Removal is durable and can be resumed after an interruption. Reauthentication may be
            required.
          </p>
          <button
            disabled={blocked}
            onClick={() =>
              void send({
                kind: 'delete',
                request: crypto.randomUUID(),
                id: deletion === 'all' ? null : deletion,
              })
            }
          >
            Confirm deletion
          </button>
        </div>
      </ContextSheet>
      <ContextSheet
        open={talk}
        title="Aethelios · private Health understanding"
        busy={busy}
        fullScreen
        onClose={() => setTalk(false)}
      >
        <div className="health-dialog health-conversation">
          {talk && recovery}
          <p>
            Selected records stay inside this purpose-specific conversation. No general memory,
            Council or web search.
          </p>
          {!data.aiEnabled && (
            <div className="health-notice">
              <h3>Personalized AI awaits privacy acceptance.</h3>
              <p>
                Your records, sources and deterministic comparisons remain available. No model
                request is made while this gate is closed.
              </p>
            </div>
          )}
          {data.turns.map((t) => (
            <article key={t.id}>
              <p className="health-kicker">You · {new Date(t.created_at).toLocaleDateString()}</p>
              <p>{t.question}</p>
              <p className="health-kicker">Aethelios · {t.status}</p>
              <p>
                {t.answer ||
                  (t.status === 'pending'
                    ? 'Request pending; no completed explanation is claimed.'
                    : 'No current explanation. The request failed or its evidence/permission changed.')}
              </p>
            </article>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = data.consents.find((c) => c.purpose === 'ai' && c.granted);
              if (c)
                void send({
                  kind: 'ask',
                  request: crypto.randomUUID(),
                  question,
                  evidence,
                  consentVersion: c.version,
                });
            }}
          >
            <fieldset>
              <legend>Results to include · choose up to 12</legend>
              {data.observations.filter((o) => o.status === 'active').length ? (
                data.observations
                  .filter((o) => o.status === 'active')
                  .map((o) => (
                    <label key={o.id}>
                      <input
                        type="checkbox"
                        checked={evidence.includes(o.id)}
                        disabled={!evidence.includes(o.id) && evidence.length >= 12}
                        onChange={(e) =>
                          setEvidence((ids) =>
                            e.target.checked ? [...ids, o.id] : ids.filter((id) => id !== o.id),
                          )
                        }
                      />
                      {o.name} · {o.value} {o.unit} · {o.date}
                    </label>
                  ))
              ) : (
                <p>No reviewed results selected.</p>
              )}
            </fieldset>
            <label>
              Your question
              <textarea
                value={question}
                maxLength={3000}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What does this result describe, and what should I ask my clinician?"
              />
            </label>
            <p>
              {evidence.length} results selected. Only this question and selected results will be
              sent.
            </p>
            <button
              disabled={blocked || !data.aiEnabled || !has('ai') || question.trim().length < 3}
            >
              Ask with selected records
            </button>
            {!has('ai') && <Link href="/app/health/privacy">Review AI permission →</Link>}
          </form>
        </div>
      </ContextSheet>
    </div>
  );
}
