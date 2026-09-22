import Image from 'next/image';
import Link from 'next/link';
import type { GoalRow, PersonRow } from '@/platform/supabase/database';
import { AureliusPresence } from './visual/aurelius-presence';
import { Icon } from './visual/icon';
export function PersonalCommand({
  person,
  goal,
}: {
  person?: Pick<PersonRow, 'display_name' | 'priority'>;
  goal: GoalRow | null;
}) {
  return (
    <>
      <section className="command-hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="status-dot" /> YOUR PERSONAL OPERATING ENVIRONMENT
          </p>
          <h1>
            {person ? (
              <>
                {person.display_name},<br />
                <em>ascend behind the life.</em>
              </>
            ) : (
              <>
                Build the man
                <br />
                <em>behind the life.</em>
              </>
            )}
          </h1>
          <p className="hero-description">
            Strength. Discipline. Character. Legacy. <br />A better standard, built daily.
          </p>
          <div className="hero-actions">
            <Link href="/aurelius" className="button">
              Open Aurelius <Icon name="arrow" />
            </Link>
            <Link href={person ? '/goals' : '/you'} className="hero-secondary">
              {person ? 'Your direction' : 'Make it yours'} <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <p className="hero-caption">
            CHARACTER <span>·</span> DISCIPLINE <span>·</span> COMMUNITY <span>·</span> LEGACY
          </p>
        </div>
        <div className="hero-emblem">
          <div className="emblem-halo" />
          <Image
            src="/brand/gent-ascend-crest.webp"
            alt="Gent Ascend Collective seal: Aethelos standing composed in a green mantle, framed by celestial geometry and laurels"
            width={1254}
            height={1254}
            sizes="(max-width: 600px) 160px, (max-width: 1100px) 260px, 370px"
            preload
          />
          <span className="emblem-caption">BUILT AROUND YOU</span>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <p className="eyebrow">IN YOUR ORBIT</p>
          <h2>Start where it matters.</h2>
        </div>
        <span className="quiet-label">{person ? 'Your personal space' : 'Foundation preview'}</span>
      </div>
      <div className="command-grid">
        <section className="intelligence-card surface">
          <div className="card-heading">
            <span className="eyebrow">01 / YOUR INTELLIGENCE</span>
            <span className="tag">AURELIUS</span>
          </div>
          <div className="intelligence-card-body">
            <div>
              <h2>
                A clearer
                <br />
                perspective.
              </h2>
              <p>
                Bring a thought. Explore a possibility.
                <br />
                Find your next move.
              </p>
            </div>
            <AureliusPresence enhanced className="command-presence" />
          </div>
          <Link href="/aurelius" className="card-action">
            Think with Aurelius <Icon name="arrow" />
          </Link>
        </section>
        <section className="direction-card surface">
          <div className="card-heading">
            <span className="eyebrow">02 / YOUR DIRECTION</span>
            <Icon name="progress" />
          </div>
          <h2>{goal?.title || 'Something worth\nmoving toward.'}</h2>
          <p>
            {goal?.next_step ||
              'A meaningful goal. A deliberate next step. A direction that belongs to you.'}
          </p>
          <Link href="/goals" className="card-action">
            {goal ? 'Refine your next step' : 'Choose your direction'} <Icon name="arrow" />
          </Link>
        </section>
        <section className="foundation-card surface">
          <div className="card-heading">
            <span className="eyebrow">03 / YOUR FOUNDATION</span>
            <Icon name="person" />
          </div>
          <h2>{person?.priority || 'A little more you.'}</h2>
          <p>
            {person
              ? 'What matters now, in your own words. Refine it as your life changes.'
              : 'Your priorities and preferences give this space its meaning.'}
          </p>
          <Link href="/you" className="card-action">
            Your personal context <Icon name="arrow" />
          </Link>
        </section>
      </div>
      <section className="world-invitation">
        <div className="world-lines" aria-hidden="true" />
        <div>
          <p className="eyebrow">A CONNECTED LIFE</p>
          <h2>There’s a bigger picture.</h2>
          <p>Body. Mind. Work. The people and possibilities ahead.</p>
        </div>
        <Link href="/world" className="secondary-button">
          Explore your world <Icon name="arrow" />
        </Link>
      </section>
      {!person && (
        <p className="preview-footnote">
          Explore the design freely. Your personal records and live conversations begin when your
          account and services are connected.
        </p>
      )}
    </>
  );
}
