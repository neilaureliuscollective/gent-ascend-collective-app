import Link from 'next/link';
import '@/app/ecosystem.css';
export const metadata = { title: 'Aethelios Life' };
export default function Life() {
  return (
    <div className="ecosystem-page">
      <header className="ecosystem-heading">
        <p className="eyebrow">AETHELIOS LIFE</p>
        <h1>
          Make room for
          <br />
          what matters.
        </h1>
        <p className="lead">
          Use the direction and records you already have. No new questionnaire, duplicate profile or
          automatic import.
        </p>
        <Link className="button" href="/app/ascend">
          Open your day →
        </Link>
      </header>
      <div className="ecosystem-directory">
        {(
          [
            [
              'Your direction',
              'Profile, priority and your active goal.',
              '/app/goals',
              'Review goals',
            ],
            [
              'The Living Profile foundation',
              'Inspect and confirm your existing personal baseline. Confirmed memory remains separately controlled in Talk.',
              '/app/ascend-profile',
              'Review your profile',
            ],
            [
              'Daily context',
              'Your recorded intention, next move and daily actions. Missing data stays missing.',
              '/app/ascend',
              'Continue your day',
            ],
            [
              'Capture & continuity',
              'Review your inbox and saved next steps rather than making another list.',
              '/app/captures',
              'Open captures',
            ],
            [
              'Personal progress',
              'Existing saved-day and training views, with source and absence distinctions.',
              '/app/progress',
              'Review progress',
            ],
          ] as const
        ).map(([name, copy, href, label]) => (
          <article key={href}>
            <div>
              <h2>{name}</h2>
              <p>{copy}</p>
            </div>
            <Link href={href}>{label} →</Link>
          </article>
        ))}
      </div>
      <section className="ecosystem-note">
        <h2>The Ascendance Brief</h2>
        <p>
          The existing Command and daily views are the foundation: dated saved records and
          deterministic next moves. Calendar connections and a coordinated project brief are
          planned. No new background analysis or invented personal insight is active.
        </p>
        <Link href="/app/ecosystem">Explore the ecosystem →</Link>
      </section>
    </div>
  );
}
