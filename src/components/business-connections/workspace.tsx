'use client';
import { WebsiteEditor } from './website-editor';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Connection, Schedule } from '@/domains/business-connections/schema';
import { consumeReply } from '@/domains/intelligence/consume';
async function json(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const v = await r.json();
  if (!r.ok) throw Error(v.error ?? 'Business connection unavailable.');
  return v;
}
const mutation = (method: string, body: unknown) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});
export function BusinessConnections() {
  const [connections, setConnections] = useState<Connection[]>([]),
    [companies, setCompanies] = useState<{ id: string; name: string }[]>([]),
    [company, setCompany] = useState(''),
    [selected, setSelected] = useState(''),
    [enabled, setEnabled] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [date, setDate] = useState(''),
    [days, setDays] = useState(1),
    [schedule, setSchedule] = useState<Schedule | null>(null),
    [text, setText] = useState(''),
    [consent, setConsent] = useState(false),
    [reply, setReply] = useState(''),
    [saved, setSaved] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [conversation, setConversation] = useState('');
  const active = connections.find((c) => c.id === selected);
  useEffect(() => {
    let mounted = true;
    Promise.all([json('/api/business-connections'), json('/api/companies')])
      .then(([links, rooms]) => {
        if (mounted) {
          if (new URLSearchParams(window.location.search).get('connection') === 'failed')
            setError('The connection did not finish. Start again with your confirmed accounts.');
          setConnections(links.connections);
          setEnabled(links.enabled);
          setCompanies(rooms.companies);
          setCompany(rooms.companies[0]?.id ?? '');
        }
      })
      .catch((e) => {
        if (mounted) setError(e.message);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);
  const clear = () => {
    setSchedule(null);
    setConsent(false);
    setReply('');
    setSaved(false);
    setConversation('');
    setUncertain(false);
  };
  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  }
  async function load(page = 0) {
    await run(async () => {
      setSchedule(null);
      setConsent(false);
      const r = await json(
        '/api/business-connections/schedule?' +
          new URLSearchParams({ id: selected, date, days: String(days), page: String(page) }),
      );
      setSchedule(r.schedule);
    });
  }
  async function ask() {
    await run(async () => {
      setReply('');
      setSaved(false);
      setConsent(false);
      const id = crypto.randomUUID();
      setConversation(id);
      setUncertain(true);
      const response = await fetch(
        '/api/business-connections/ask',
        mutation('POST', {
          connectionId: selected,
          conversationId: id,
          requestId: crypto.randomUUID(),
          text,
          consent: true,
          window: { date, days, page: schedule?.page ?? 0 },
        }),
      );
      if (!response.ok) {
        const v = await response.json();
        throw Error(v.error ?? 'Reply unavailable.');
      }
      await consumeReply(response, (event) => {
        if (event.type === 'delta') setReply((v) => v + event.text);
        if (event.type === 'saved') {
          setSaved(true);
          setUncertain(false);
          setText('');
        }
        if (event.type === 'error') throw Error(event.message);
      });
    });
  }
  return (
    <div aria-busy={loading || busy}>
      {loading && <p role="status">Loading business connections…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {!loading && !enabled && !error && <p>Business connections are awaiting activation.</p>}
      {enabled && (
        <>
          <article>
            <h2>Connect a professional</h2>
            <p>
              Choose a private company room, then sign in to Legacy Reserve and approve one
              professional’s schedule. No client identities or private notes are shared.
            </p>
            {companies.length ? (
              <>
                <label>
                  Company room
                  <select
                    disabled={busy}
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  >
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={busy || !company}
                  onClick={() =>
                    void run(async () => {
                      const r = await json(
                        '/api/business-connections',
                        mutation('POST', { companyId: company }),
                      );
                      window.location.assign(r.redirect);
                    })
                  }
                >
                  Connect Legacy Reserve
                </button>
              </>
            ) : (
              <Link href="/app/work">Create your company room ↗</Link>
            )}
          </article>
          {connections.map((c) => (
            <article key={c.id}>
              <h2>{c.provider_name ?? 'Pending professional connection'}</h2>
              <p>
                Status: {c.status}
                {c.grant_expires_at
                  ? ' · Permission expires ' + new Date(c.grant_expires_at).toLocaleDateString()
                  : ''}
              </p>
              <Link href={'/app/companies/' + c.company_id}>Company room ↗</Link>
              {c.status === 'active' && (
                <button
                  disabled={busy}
                  onClick={() => {
                    clear();
                    setSelected(c.id);
                    setDate(
                      new Intl.DateTimeFormat('en-CA', {
                        timeZone: c.timezone ?? 'America/Chicago',
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                      }).format(new Date()),
                    );
                  }}
                >
                  View schedule
                </button>
              )}
              {c.status !== 'disconnected' && (
                <button
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const result = await json(
                        '/api/business-connections',
                        mutation('DELETE', { id: c.id }),
                      );
                      setConnections((v) =>
                        v.map((x) => (x.id === c.id ? { ...x, status: 'disconnected' } : x)),
                      );
                      if (selected === c.id) {
                        setSelected('');
                        clear();
                      }
                      setNotice(
                        result.remoteRevoked
                          ? 'Disconnected. Reserve permission revoked.'
                          : 'Disconnected here. Reserve revocation could not be confirmed; revoke the connection in Reserve Studio.',
                      );
                    })
                  }
                >
                  Disconnect
                </button>
              )}
            </article>
          ))}
          {active?.status === 'active' && active.permissions?.includes('website.read') && (
            <WebsiteEditor key={active.id} connectionId={active.id} />
          )}
          {active?.status === 'active' && (
            <article>
              <h2>{active.provider_name} · Schedule</h2>
              <p>Times use {active.timezone}. This is a read-only view.</p>
              <div className="connection-controls">
                <label>
                  Start date
                  <input
                    disabled={busy}
                    type="date"
                    value={date}
                    onChange={(e) => {
                      clear();
                      setDate(e.target.value);
                    }}
                  />
                </label>
                <label>
                  Window
                  <select
                    disabled={busy}
                    value={days}
                    onChange={(e) => {
                      clear();
                      setDays(Number(e.target.value));
                    }}
                  >
                    <option value={1}>One day</option>
                    <option value={7}>Seven days</option>
                  </select>
                </label>
              </div>
              <button disabled={busy || !date} onClick={() => void load()}>
                Refresh schedule
              </button>
              {schedule && (
                <>
                  <p>
                    Legacy Reserve · Retrieved {new Date(schedule.fetchedAt).toLocaleString()} ·
                    Page {schedule.page + 1}
                    {schedule.hasMore ? ' · More appointments available' : ''}
                  </p>
                  {schedule.appointments.length ? (
                    <ul>
                      {schedule.appointments.map((a) => (
                        <li key={a.id}>
                          {new Date(a.starts_at).toLocaleString(undefined, {
                            timeZone: a.timezone,
                          })}{' '}
                          — {a.service} · {a.location} · {a.status}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No appointments in this window.</p>
                  )}
                  {schedule.page > 0 && (
                    <button disabled={busy} onClick={() => void load(schedule.page - 1)}>
                      Previous page
                    </button>
                  )}
                  {schedule.hasMore && schedule.page < 100 && (
                    <button disabled={busy} onClick={() => void load(schedule.page + 1)}>
                      Next page
                    </button>
                  )}
                  <label>
                    Ask Aethelios
                    <textarea
                      disabled={busy || uncertain}
                      maxLength={3000}
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                    />
                  </label>
                  <label>
                    <input
                      style={{ width: 'auto' }}
                      disabled={busy || uncertain}
                      type="checkbox"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    Allow a fresh schedule page and this company room’s history to be sent to
                    Aethelios for this reply. Personal context is excluded.
                  </label>
                  <button
                    disabled={busy || uncertain || !consent || !text.trim()}
                    onClick={() => void ask()}
                  >
                    Review with Aethelios
                  </button>
                </>
              )}
              {reply && <pre>{reply}</pre>}
              {saved && <p role="status">Reply saved in your company room.</p>}
              {uncertain && !busy && (
                <p role="status">Reload and check the company room before trying again.</p>
              )}
              {conversation && (
                <Link
                  href={'/app/companies/' + active.company_id + '?conversation=' + conversation}
                >
                  Open saved conversation ↗
                </Link>
              )}
            </article>
          )}
        </>
      )}
    </div>
  );
}
