import Link from 'next/link';
import { companyJobs } from '@/domains/company-work/starters';
import './work.css';
import { SavedWork } from '@/components/workspace/saved-work';
import { CompanyRooms } from '@/components/companies/company-rooms';
export const metadata = { title: 'Your work' };
export default function WorkPage() {
  return (
    <section className="company-work" aria-labelledby="company-work-title">
      <header>
        <span className="eyebrow">AETHELIOS / YOUR WORK</span>
        <h1 id="company-work-title">What are we building?</h1>
        <p>
          Start with your objective and the outcome. Aethelios helps shape the work; you keep the
          decision.
        </p>
        <Link className="button" href="/app/aethelios">
          Continue in Talk ↗
        </Link>
      </header>
      <Link className="company-job" href="/app/work/technology">
        <div>
          <h2>Aethelios Technology</h2>
          <p>Create a saved service-business website preview. Review, refine and continue.</p>
        </div>
        <span aria-hidden="true">↗</span>
      </Link>
      <SavedWork missionsOnly />
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
      <aside className="company-work-note">
        <h2>Keep useful work moving.</h2>
        <p>
          Talk retains your conversations. Studio retains creative projects and image versions. Each
          starter opens a draft for your review.
        </p>
        <p>
          Company rooms keep confirmed briefs and Talk history separate. The starters above open
          unassigned Talk; choose a company room to use its brief. Company-linked Studio and saved
          company work remain in their rooms. Client sharing and external execution are not enabled.
        </p>
        <div className="company-work-links">
          <Link href="/app/library">All saved work ↗</Link>
          <Link href="/app/studio">Creative projects ↗</Link>
          <Link href="/app/ongoing">Earlier personal commitments ↗</Link>
        </div>
      </aside>
    </section>
  );
}
