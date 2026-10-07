import Link from 'next/link';
import './company-arrival.css';
export default function PublicHome() {
  return (
    <main id="world-main" className="company-arrival">
      <section aria-labelledby="arrival-title">
        <span className="eyebrow">AETHELIOS / PERSONAL INTELLIGENCE OS</span>
        <h1 id="arrival-title">
          Bring the ambition.
          <br />
          <em>Move your world forward.</em>
        </h1>
        <p>
          Bring a decision, a personal project or a business ambition. Aethelios brings
          conversation, specialist perspectives and creative work into one considered environment.
        </p>
        <div className="company-arrival-actions">
          <Link href="/enter" className="button">
            Open Aethelios ↗
          </Link>
          <Link href="/app/work">Explore company work ↗</Link>
        </div>
      </section>
      <section className="company-arrival-method" aria-labelledby="method-title">
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
      </section>
    </main>
  );
}
