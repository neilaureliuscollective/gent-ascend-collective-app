import Link from 'next/link';
import Image from 'next/image';
import { SceneSlot } from '@/components/public/scene-slot';
import { MediaScene } from '@/components/public/media-scene';
import { Chapter, CollectionGrid, Invitation } from '@/components/public/editorial';
import { publicWorld } from '@/platform/public-world';
import { brand } from '@/platform/brand';

export default function PublicHome() {
  return (
    <main id="world-main">
      <section className="world-hero">
        <MediaScene media={publicWorld.hero} priority />
        <div className="hero-coordinate" aria-hidden="true">
          GENT ASCEND / LOUISIANA / EST. 2026
        </div>
        <div className="world-hero-copy">
          <p className="world-kicker">
            <span className="gold-rule" /> A life, deliberately built.
          </p>
          <h1>
            Build the life
            <br />
            you <em>carry.</em>
          </h1>
          <p className="hero-definition">
            Grooming. Personal intelligence. Daily practice.
            <br />A connected world built around the modern gentleman.
          </p>
          <div className="world-actions">
            <Link href="#the-world" className="world-button">
              Discover Gent Ascend <span>↓</span>
            </Link>
            <Link href="/enter" className="world-text-link">
              Member entrance <span>↗</span>
            </Link>
          </div>
        </div>
        <div className="hero-chapter-mark">
          <span>01 / THE BEGINNING</span>
          <span>Rooted here. Built to go further.</span>
        </div>
      </section>
      <section id="the-world" className="world-section world-introduction">
        <Chapter number="01" label="One world. Every day." />
        <div className="editorial-split">
          <h2>
            The care you take.
            <br />
            The direction
            <br />
            <em>you choose.</em>
          </h2>
          <div>
            <p className="world-lead">What you carry into a room begins long before you arrive.</p>
            <p>
              Gent Ascend connects the rituals that help you feel prepared, the intelligence that
              helps you think clearly, and the places that make care personal.
            </p>
            <p>
              From your morning routine to your next meaningful decision, it belongs to the same
              life. Yours.
            </p>
          </div>
        </div>
        <div className="world-doorways">
          {(
            [
              ['01', 'Products', 'Considered essentials for your daily ritual.', '/shop'],
              [
                '02',
                'Intelligence',
                'Aethelios and a personal OS that carry your direction forward.',
                '/gent-ascend',
              ],
              [
                '03',
                'Experiences',
                'Meet the people and the care behind the Reserve at Sanctum.',
                '/reserve',
              ],
            ] as const
          ).map(([n, title, copy, href]) => (
            <Link href={href} key={title}>
              <span>{n}</span>
              <h3>
                {title}
                <i aria-hidden="true">↗</i>
              </h3>
              <p>{copy}</p>
            </Link>
          ))}
        </div>
      </section>
      <section className="world-section world-collection">
        <Chapter number="02" label="The daily ritual" />
        <div className="section-heading">
          <div>
            <span className="world-kicker">Introducing Legacy Reserve</span>
            <h2>
              Care with <em>intention.</em>
            </h2>
          </div>
          <Link className="world-text-link" href="/shop">
            Explore the collection ↗
          </Link>
        </div>
        <p className="section-deck">
          Grooming and personal care, taking shape one considered product at a time.
        </p>
        {publicWorld.ritualMedia && (
          <SceneSlot media={publicWorld.ritualMedia} className="ritual-media-slot">
            {null}
          </SceneSlot>
        )}
        <CollectionGrid />
      </section>
      <section className="intelligence-scene">
        <div className="intelligence-art" aria-hidden="true">
          <div className="intelligence-ring ring-one" />
          <div className="intelligence-ring ring-two" />
          <div className="intelligence-ring ring-three" />
          <div className="intelligence-core">
            <span>Æ</span>
          </div>
          <span className="intelligence-axis axis-top">CONTEXT</span>
          <span className="intelligence-axis axis-bottom">CONTINUITY</span>
        </div>
        <div className="intelligence-story">
          <Chapter number="03" label="Your personal intelligence" />
          <span className="world-kicker">Aethelios / Inside Gent Ascend</span>
          <h2>
            A clearer mind.
            <br />
            <em>A deliberate move.</em>
          </h2>
          <p>
            Talk through what matters. Turn a decision into a next step. Return to a conversation
            that understands the context you choose to share.
          </p>
          <p>
            Aethelios works alongside your goals, daily actions, and reflections inside your
            personal Gent Ascend OS.
          </p>
          <div className="world-actions">
            <Link href="/aethelios" className="world-button">
              Meet Aethelios <span>↗</span>
            </Link>
            <Link href="/gent-ascend" className="world-text-link">
              Discover the OS ↗
            </Link>
          </div>
          <span className="scene-footnote">Personal software · private invitation</span>
        </div>
      </section>
      <section className="world-section reserve-feature">
        <Chapter number="04" label="Care, in person" />
        <div className="reserve-feature-grid">
          <SceneSlot media={publicWorld.reserveMedia}>
            <div className="reserve-architecture" aria-hidden="true">
              <div className="reserve-arch">
                <Image src={brand.crest} alt="" width={190} height={190} />
                <span>
                  THE RESERVE<small>AT SANCTUM</small>
                </span>
              </div>
              <span className="architecture-caption">AN EXPERIENCE TAKING SHAPE</span>
            </div>
          </SceneSlot>
          <div>
            <span className="world-kicker">Eunice, Louisiana</span>
            <h2>
              A place to
              <br />
              <em>return to.</em>
            </h2>
            <p className="world-lead">The Reserve at Sanctum.</p>
            <p>
              Our flagship physical experience brings Katie’s men’s salon craft and Neil’s grooming
              direction into a personal setting. Attention to the man in the chair, and to the care
              he carries home.
            </p>
            <Link href="/reserve" className="world-text-link">
              Step inside the Reserve <span>↗</span>
            </Link>
          </div>
        </div>
      </section>
      <section className="world-statement">
        <span className="world-kicker">The standard is personal.</span>
        <h2>
          Take care of yourself.
          <br />
          Show up for your people.
          <br />
          <em>Build something that lasts.</em>
        </h2>
        <Link href="/about" className="world-text-link">
          The story behind Gent Ascend ↗
        </Link>
      </section>
      <Invitation />
    </main>
  );
}
