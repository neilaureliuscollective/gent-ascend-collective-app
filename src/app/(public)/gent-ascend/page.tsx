import Link from 'next/link';
import type { Metadata } from 'next';
import { Chapter, Invitation } from '@/components/public/editorial';
export const metadata: Metadata = { title: 'Your personal operating system' };
export default function Software() {
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <span className="world-kicker">The Gent Ascend OS / Built around you</span>
        <h1>
          Your direction.
          <br />
          <em>Carried forward.</em>
        </h1>
        <p>
          A personal operating space for what matters now: your goals, daily actions, reflections,
          and a conversation with Aethelios that brings them together.
        </p>
        <div className="world-actions">
          <Link className="world-button" href="/enter">
            Member entrance <span>↗</span>
          </Link>
          <Link className="world-text-link" href="/membership">
            About private access ↗
          </Link>
        </div>
      </header>
      <section className="world-section">
        <Chapter number="01" label="From intention to evidence" />
        <div className="editorial-split">
          <h2>
            Begin with clarity.
            <br />
            <em>Return with context.</em>
          </h2>
          <p>
            Establish a direction. Choose a meaningful action. Record what happened. Reflect,
            adjust, and begin again with something learned. Ascend connects those moments inside
            your daily Command.
          </p>
        </div>
        <div
          className="os-composition"
          aria-label="Illustrative layout of the Gent Ascend operating system"
        >
          <aside>
            <strong>GENT ASCEND</strong>
            <span>Command</span>
            <span>Aethelios</span>
            <span>Ascend</span>
            <span>Progress</span>
            <span>You</span>
          </aside>
          <div>
            <span className="world-kicker">Your daily space</span>
            <h3>
              What deserves
              <br />
              <em>your attention?</em>
            </h3>
            <p>Your chosen direction stays beside your next meaningful action.</p>
            <div className="os-example-action">
              <span>○</span> Choose one step worth taking today.
            </div>
            <p className="illustration-disclosure">
              Interface illustration · no personal records shown
            </p>
          </div>
        </div>
        <div className="world-feature-list">
          <article>
            <span className="world-kicker">Command + Ascend</span>
            <h3>Work with your day.</h3>
            <p>Choose your focus, record actions, and review what carries into tomorrow.</p>
          </article>
          <article>
            <span className="world-kicker">You + Progress</span>
            <h3>Keep your perspective.</h3>
            <p>
              Build a baseline you can correct and a history grounded in what you actually record.
            </p>
          </article>
          <article>
            <span className="world-kicker">World</span>
            <h3>Explore what connects.</h3>
            <p>
              Discover products and the Reserve, with future grooming, performance, and community
              experiences clearly marked.
            </p>
          </article>
        </div>
      </section>
      <section className="world-section world-section--compact">
        <Chapter number="02" label="On your phone" />
        <div className="editorial-split">
          <h2>
            Your icon.
            <br />
            <em>Your own space.</em>
          </h2>
          <div>
            <p>
              Install Gent Ascend from your phone’s browser and return from your Home Screen. Your
              member arrival includes device-specific steps for Android and iPhone.
            </p>
            <p>
              Personal records and Aethelios require a connection. Your account remains the same
              when you return.
            </p>
            <Link href="/app/install" className="world-text-link">
              See the installation guide ↗
            </Link>
          </div>
        </div>
      </section>
      <Invitation />
    </main>
  );
}
