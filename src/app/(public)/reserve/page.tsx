import Link from 'next/link';
import type { Metadata } from 'next';
import { Chapter } from '@/components/public/editorial';
import { reserveDestination } from '@/platform/public-world';
export const metadata: Metadata = { title: 'The Reserve at Sanctum' };
export default function Reserve() {
  const destination = reserveDestination();
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <span className="world-kicker">Our flagship physical experience / Eunice, Louisiana</span>
        <h1>
          The Reserve
          <br />
          <em>at Sanctum.</em>
        </h1>
        <p>
          A personal place for grooming, care, and conversation. Katie’s men’s salon craft and
          Neil’s grooming direction, brought together with a shared standard of attention.
        </p>
        <div className="world-actions">
          {destination ? (
            <a className="world-button" href={destination}>
              Explore the Reserve <span>↗</span>
            </a>
          ) : (
            <Link className="world-button" href="#the-experience">
              Discover the experience <span>↓</span>
            </Link>
          )}
        </div>
      </header>
      <section id="the-experience" className="world-section">
        <Chapter number="01" label="The care behind the visit" />
        <div className="editorial-split">
          <h2>
            Know the man.
            <br />
            <em>Refine the ritual.</em>
          </h2>
          <div>
            <p className="world-lead">The visit should feel personal.</p>
            <p>
              The Reserve keeps its own atmosphere, service experience, and booking journey. Within
              Gent Ascend, it is a place where daily care becomes a real conversation with the
              people who help you carry it forward.
            </p>
          </div>
        </div>
        <div className="world-feature-list">
          <article>
            <span className="world-kicker">01 / Katie</span>
            <h3>Craft and attention.</h3>
            <p>
              Men’s hair services shaped by a salon professional who pays attention to the person in
              her chair.
            </p>
          </article>
          <article>
            <span className="world-kicker">02 / Neil</span>
            <h3>Grooming direction.</h3>
            <p>
              Thoughtful consultation around your hair, beard, personal care, and the routine that
              fits your life.
            </p>
          </article>
          <article>
            <span className="world-kicker">03 / Beyond the visit</span>
            <h3>Care that continues.</h3>
            <p>
              A path toward products, personal rituals, and a digital experience that helps you
              carry your direction home.
            </p>
          </article>
        </div>
        <div className="preview-notice">
          <strong>Planning your first visit.</strong> The experience and service offering are being
          prepared. Confirmed services, hours, prices, and booking availability will be published
          through the Reserve’s own experience. Online booking is not being offered here yet.
        </div>
        {destination && (
          <a href={destination} className="world-text-link">
            Continue to the Reserve ↗
          </a>
        )}
      </section>
    </main>
  );
}
