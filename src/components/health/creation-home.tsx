'use client';
import Link from 'next/link';
import { useState } from 'react';
import { foundationLibrary, type HealthFoundationId } from '@/domains/health/foundations';
import { defaultEveningProgress } from '@/domains/health/routine';
import { sampleBloodwork } from '@/domains/health/sample';
import type { HealthData } from '@/domains/health/schema';
import { initialBloodworkSettings } from '@/domains/health/bloodwork';
import { defaultBloodworkSettings, type HealthWorkspaceRecord } from '@/domains/health/workspace-model';
import { BloodworkTool } from './bloodwork-tool';
import { RoutineTool } from './routine-tool';

const records: [string, string][] = [
  ['/app/health/history', 'History'],
  ['/app/health/records', 'Records'],
  ['/app/health/labs', 'Labs'],
  ['/app/health/connections', 'Connections'],
  ['/app/health/privacy', 'Privacy'],
];

export function CreationHome({
  data,
  saved,
  composer,
  note,
  signedIn,
  onComposer,
  onCreate,
  onOpenSaved,
  onOpenFoundation,
}: {
  data: HealthData;
  saved: HealthWorkspaceRecord[];
  composer: string;
  note: string;
  signedIn: boolean;
  onComposer: (value: string) => void;
  onCreate: () => void;
  onOpenSaved: (id: string) => void;
  onOpenFoundation: (id: HealthFoundationId, sample?: boolean) => void;
}) {
  const sampleNeeded = !data.observations.some((row) => row.status === 'active');
  return (
    <div className="health-home">
      <header className="health-home-lead">
        <p className="health-kicker">Health</p>
        <h1>Make Health work your way</h1>
        <p>
          Create a personal tool, then use it. Evening sequences and bloodwork views are starting
          materials, not the finished product.
        </p>
      </header>
      <div className="health-home-stage">
        <form
          className="health-composer"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate();
          }}
        >
          <label htmlFor="health-create">What would you like to create?</label>
          <textarea
            id="health-create"
            value={composer}
            maxLength={400}
            placeholder="A quieter evening after work, or a tracker that only shows LDL."
            onChange={(event) => onComposer(event.target.value)}
          />
          <div className="health-composer-tools">
            <button type="submit">Create this tool</button>
          </div>
          {note && <p role="status">{note}</p>}
          {!signedIn && (
            <p>
              Sign in to keep a tool. You can still shape a labelled sample or a local draft.{' '}
              <Link href="/enter">Sign in</Link>
            </p>
          )}
          {data.mode === 'unavailable' && (
            <p role="status">
              Durable Health storage is not available here. The draft stays on this screen until
              storage is ready. Nothing has been saved.
            </p>
          )}
        </form>
        <ExampleTool />
      </div>
      <section className="health-foundations" aria-label="Foundations">
        <p className="health-kicker">Starting materials</p>
        <div className="health-foundation-grid">
          {foundationLibrary.map((item) => (
            <article key={item.id} className="health-foundation-card">
              <small>{item.intention}</small>
              <strong>{item.title}</strong>
              <FoundationMini foundation={item.id} />
              <button
                type="button"
                onClick={() =>
                  onOpenFoundation(
                    item.id,
                    item.id === 'bloodwork-tracker' ? sampleNeeded : undefined,
                  )
                }
              >
                {item.id === 'evening-routine' ? 'Open evening sequence' : 'Open Bloodwork Tracker'}
              </button>
            </article>
          ))}
        </div>
      </section>
      <section className="health-gallery" aria-label="My tools">
        <p className="health-kicker">My tools</p>
        {saved.length ? (
          <ul>
            {saved.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => onOpenSaved(row.id)}>
                  <strong>{row.title}</strong>
                  <small>
                    {row.foundation === 'evening-routine' ? 'Evening' : 'Bloodwork'}
                    {row.sample ? ' · labelled sample' : ''}
                    {` · v${row.version}`}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No saved personal tools yet. Create one, then save it to reopen here.</p>
        )}
      </section>
      <nav className="health-home-records" aria-label="Records and privacy">
        {records.map(([href, label]) => (
          <Link key={href} href={href} prefetch={false}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function ExampleTool() {
  const [progress, setProgress] = useState(defaultEveningProgress);
  return (
    <aside className="health-example" aria-label="Example evening tool">
      <p className="health-kicker">Example · labelled sample</p>
      <h2>Evenings, made usable</h2>
      <p>A working sequence you can try. Values here are not your records.</p>
      <RoutineTool
        progress={progress}
        selected={null}
        blocked={false}
        parts={['hero', 'sequence']}
        onChange={setProgress}
        onSelect={() => undefined}
      />
    </aside>
  );
}

function FoundationMini({ foundation }: { foundation: HealthFoundationId }) {
  if (foundation === 'evening-routine') {
    return (
      <div className="health-mini" aria-hidden="true">
        <RoutineTool
          progress={defaultEveningProgress()}
          selected={null}
          blocked
          parts={['hero']}
          onChange={() => undefined}
          onSelect={() => undefined}
        />
      </div>
    );
  }
  return (
    <div className="health-mini" aria-hidden="true">
      <BloodworkTool
        observations={sampleBloodwork}
        records={[]}
        settings={initialBloodworkSettings(sampleBloodwork) ?? defaultBloodworkSettings()}
        sample
        selected={null}
        blocked
        parts={['hero']}
        onSettings={() => undefined}
        onSelect={() => undefined}
      />
    </div>
  );
}
