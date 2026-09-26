import Link from 'next/link';
import type { Metadata } from 'next';
import { Chapter } from '@/components/public/editorial';
export const metadata: Metadata = { title: 'Membership' };
export default function Membership() {
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <span className="world-kicker">Membership / A considered beginning</span>
        <h1>
          Built with care.
          <br />
          <em>Shared personally.</em>
        </h1>
        <p>
          The first Gent Ascend members enter by private invitation. A small founding circle will
          help shape a useful daily experience before broader membership opens.
        </p>
      </header>
      <section className="world-section">
        <Chapter number="01" label="The founding experience" />
        <div className="editorial-split">
          <h2>
            A place in
            <br />
            <em>the beginning.</em>
          </h2>
          <div>
            <p>
              Private access brings you into the personal OS: Aethelios, your direction, daily
              actions, and recorded progress. Your feedback helps refine how these pieces work
              together.
            </p>
            <p>
              Long-term member benefits, pricing, and any product or Reserve privileges will be
              defined clearly before a paid membership is offered.
            </p>
          </div>
        </div>
        <div className="membership-standard">
          <span className="world-kicker">Already invited?</span>
          <h3>Your first step is personal.</h3>
          <p>
            Open the invitation sent to your email. Accept access, set up your account, and follow
            the member guide to install Gent Ascend on your phone.
          </p>
          <div className="world-actions">
            <Link href="/app/welcome" className="world-button">
              Accept your invitation <span>↗</span>
            </Link>
            <Link href="/app/you" className="world-text-link">
              Sign in ↗
            </Link>
          </div>
        </div>
        <p className="illustration-disclosure">
          Public enrollment and paid subscriptions are not open. No waitlist is being collected.
        </p>
      </section>
    </main>
  );
}
