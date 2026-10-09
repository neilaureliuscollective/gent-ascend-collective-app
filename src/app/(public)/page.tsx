import Link from 'next/link';
import { ImperialMaterialPresence } from '@/components/public/imperial-material-presence';
import { Icon } from '@/components/visual/icon';
import './company-arrival.css';
export default function PublicHome() {
  return (
    <main id="world-main" className="company-arrival">
      <section className="imperial-arrival-hero" aria-labelledby="arrival-title">
        <div className="imperial-hero-copy">
          <span className="eyebrow imperial-kicker">AETHELIOS / COMPANY-BUILDING INTELLIGENCE</span>
          <h1 id="arrival-title">
            Bring the ambition.
            <br />
            <em>Build the company.</em>
          </h1>
          <p>
            Research the opportunity. Sharpen the offer. Shape the next move. Aethelios brings
            conversation, specialist perspectives and creative work into one considered environment.
          </p>
          <div className="company-arrival-actions">
            <Link href="/enter" className="button" aria-label="Open Aethelios ↗">
              Open Aethelios <Icon name="arrow" className="imperial-entry-arrow" />
            </Link>
            <Link href="/app/work">
              Explore company work <Icon name="arrow" className="imperial-entry-arrow" />
            </Link>
          </div>
        </div>
        <ImperialMaterialPresence />
      </section>
      <section className="company-arrival-method" aria-labelledby="method-title">
        <span className="imperial-kicker">01 / THE INTELLIGENCE ENVIRONMENT</span>
        <h2 id="method-title">Start with the work that matters.</h2>
        <p>
          Company research. Positioning. Launch plans. Commercial analysis. Creative briefs. Begin
          in Talk and bring in a specialist when the problem calls for one.
        </p>
        <p>
          For work that needs a human partner, Ascend Architects is the assisted company-building
          layer around Aethelios.
        </p>
        <p className="quiet-label">
          Available today: conversation, read-only research, Council perspectives and Studio
          creative projects. Company sharing and execution workflows are coming in later phases.
        </p>
        <Link href="/app/aethelios" className="imperial-method-link">
          Begin in Talk <Icon name="arrow" />
        </Link>
      </section>
      <section className="imperial-workspaces" aria-labelledby="workspace-title">
        <div className="imperial-section-heading">
          <span className="imperial-kicker">ONE ENVIRONMENT / THREE WAYS TO WORK</span>
          <h2 id="workspace-title">From thought to possibility.</h2>
        </div>
        <div className="imperial-workspace-grid">
          {[
            {
              number: '01',
              title: 'Talk',
              detail: 'Explore the question. Find a clearer direction.',
              href: '/app/aethelios',
            },
            {
              number: '02',
              title: 'Company work',
              detail: 'Bring structure to your next considered move.',
              href: '/app/work',
            },
            {
              number: '03',
              title: 'Studio',
              detail: 'Give your ideas a visual expression.',
              href: '/app/studio',
            },
          ].map((space) => (
            <Link key={space.href} href={space.href} className="imperial-workspace">
              <span className="imperial-kicker">{space.number}</span>
              <h3>{space.title}</h3>
              <p>{space.detail}</p>
              <span className="imperial-workspace-action">
                Open {space.title}
                <Icon name="arrow" className="imperial-entry-arrow" />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
