import Link from 'next/link';
import type { Metadata } from 'next';
import { Chapter } from '@/components/public/editorial';
export const metadata: Metadata = { title: 'Our story' };
export default function About() {
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <span className="world-kicker">Gent Ascend Collective / Founded by Neil Stutes</span>
        <h1>
          Rooted here.
          <br />
          <em>Looking forward.</em>
        </h1>
        <p>
          A Louisiana beginning. A belief that care, character, and responsibility belong in the
          same conversation.
        </p>
      </header>
      <section className="world-section">
        <Chapter number="01" label="The man behind the life" />
        <div className="editorial-split">
          <h2>
            Build a standard
            <br />
            <em>you can live.</em>
          </h2>
          <div>
            <p>
              Neil founded Gent Ascend to connect the things men often have to piece together:
              grooming, personal wellbeing, daily direction, useful intelligence, and places where
              care feels personal.
            </p>
            <p>
              The ambition is long-term. Products should earn their place in a routine. Software
              should help with a real day. Physical experiences should be shaped by the people who
              walk through the door.
            </p>
            <p>
              Gent Ascend begins with men and the lives around them: work, family, relationships,
              community, and what they choose to build.
            </p>
          </div>
        </div>
        <div className="world-feature-list">
          <article>
            <span className="world-kicker">Care</span>
            <h3>Attention, practiced.</h3>
            <p>
              In the formula, in the conversation, in the small decisions that make an experience
              feel considered.
            </p>
          </article>
          <article>
            <span className="world-kicker">Character</span>
            <h3>Composure and responsibility.</h3>
            <p>
              A personal standard expressed through how you act and how you treat the people around
              you.
            </p>
          </article>
          <article>
            <span className="world-kicker">Direction</span>
            <h3>Something worth building.</h3>
            <p>
              Progress that has meaning in your own life, grounded in what you do and what you
              learn.
            </p>
          </article>
        </div>
        <div className="world-actions">
          <Link href="/reserve" className="world-text-link">
            Our physical beginning ↗
          </Link>
          <Link href="/gent-ascend" className="world-text-link">
            Our personal software ↗
          </Link>
        </div>
      </section>
    </main>
  );
}
