import { AmbientHorizon } from '@/components/visual/ambient-horizon';
import Link from 'next/link';
import { companyJobs } from '@/domains/company-work/starters';
import './work.css';
import { CompanyRooms } from '@/components/companies/company-rooms';
export const metadata = { title: 'Work · Mission Command' };
export default function WorkPage() {
  return (
    <section className="company-work" aria-labelledby="company-work-title">
      <header className="io-hero io-hero-work">
        <AmbientHorizon />
        <span className="eyebrow">AETHELIOS / MISSION COMMAND</span>
        <h1 id="company-work-title">What are we building?</h1>
        <p>
          Start with the company and the outcome. Aethelios helps shape the work; you keep the
          decision.
        </p>
        <Link className="button" href="/app/aethelios">
          Continue in Talk ↗
        </Link>
        <nav className="io-work-links" aria-label="Work environments">
          <Link className="secondary-button" href="/app/missions">
            Missions ↗
          </Link>
          <Link className="secondary-button" href="/app/ongoing">
            Commitments ↗
          </Link>
          <Link className="secondary-button" href="/app/studio">
            Creative projects ↗
          </Link>
        </nav>
      </header>
      <CompanyRooms />
      <h2>Explore a job in unassigned Talk</h2>
      <div className="company-job-list" aria-label="Start company work">
        {companyJobs.map((job, index) => (
          <Link key={job.id} href={`/app/aethelios?starter=${job.id}`} className="company-job">
            <span className="company-job-number" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h2>{job.title}</h2>
              <p>{job.detail}</p>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
      <aside className="io-architect" aria-labelledby="architect-title">
        <p className="eyebrow">AETHELIOS ARCHITECT</p>
        <h2 id="architect-title">Shape what comes next.</h2>
        <p>
          Develop an idea, clarify requirements and plan your next build in Talk. A dedicated coding
          workflow remains in development.
        </p>
        <div className="io-work-links">
          <Link className="secondary-button" href="/app/aethelios">
            Plan a build in Talk ↗
          </Link>
          <span className="io-preview-label">Coding workflow · in development</span>
        </div>
      </aside>
      <aside className="company-work-note">
        <h2>Keep useful work moving.</h2>
        <p>
          Talk retains your conversations. Studio retains creative projects and image versions. Each
          starter opens a draft for your review.
        </p>
        <p>
          Company rooms keep confirmed briefs and Talk history separate. The starters above open
          unassigned Talk; choose a company room to use its brief. Client sharing and company-linked
          Studio deliverables are planned for the next phase.
        </p>
        <div className="company-work-links">
          <Link href="/app/aethelios">Conversation history ↗</Link>
          <Link href="/app/studio">Creative projects ↗</Link>
          <Link href="/app/ongoing">Earlier personal commitments ↗</Link>
        </div>
      </aside>
    </section>
  );
}
