import Image from 'next/image';
import { MediaScene } from '@/components/public/media-scene';
import { estateMedia } from '@/platform/estate-media';
import Link from 'next/link';
import { IntelligenceSculpture } from '@/components/public/intelligence-sculpture';
import { IntelligenceNetwork } from '@/components/public/intelligence-network';
import { WorldJourney } from '@/components/public/world-journey';
import { RitualCollection } from '@/components/public/ritual-collection';
import { brand } from '@/platform/brand';
import { SceneAtmosphere } from '@/components/public/scene-atmosphere';
import { LifeSystem } from '@/components/public/life-system';
import { RitualSequence } from '@/components/public/ritual-sequence';
import './estate.css';
import './environment.css';
import './ascend-journey.css';
import './life-system.css';
import './ritual-sequence.css';
import './physical-world.css';

export default function PublicHome() {
  return (
    <main id="world-main" className="estate-home">
      <WorldJourney>
        <section
          className="ascend-threshold"
          id="the-world"
          data-chapter="arrival"
          aria-labelledby="arrival-title"
        >
          <div className="ascend-threshold-stage">
            <div className="ascend-threshold-environment" aria-hidden="true">
              <picture>
                <source
                  media="(max-width: 600px)"
                  srcSet="/media/world/threshold-chamber-mobile.webp"
                />
                <Image
                  src="/media/world/threshold-chamber.webp"
                  alt=""
                  fill
                  sizes="100vw"
                  preload
                />
              </picture>
            </div>
            <div className="ascend-threshold-veil" aria-hidden="true" />
            <div className="ascend-depth" aria-hidden="true">
              <span className="ascend-light" />
            </div>
            <div className="ascend-threshold-copy">
              <p className="estate-eyebrow">GENT ASCEND COLLECTIVE / THE ASCEND JOURNEY</p>
              <h1 id="arrival-title">
                A life is built
                <br />
                <em>from the inside.</em>
              </h1>
              <p>Care. Direction. Intelligence. A world built around the man who carries them.</p>
              <div className="estate-actions">
                <Link className="estate-primary" href="#the-man">
                  Enter the journey <span>↓</span>
                </Link>
                <Link href="/shop">Explore products ↗</Link>
                <Link href="/enter">Member entrance ↗</Link>
              </div>
            </div>
            <div className="ascend-threshold-mark" aria-hidden="true">
              <Image src={brand.crest} alt="" width={260} height={260} preload />
            </div>
            <div className="ascend-threshold-bloom" aria-hidden="true" />
            <div className="ascend-chapter-foot">
              <span>01 / THE THRESHOLD</span>
              <span>Scroll to enter ↓</span>
            </div>
          </div>
        </section>
        <nav className="estate-index" aria-label="Explore the world">
          <Link href="#the-world" data-chapter-link="arrival">
            01 <span>Enter</span>
          </Link>
          <Link href="#the-man" data-chapter-link="man">
            02 <span>The man</span>
          </Link>
          <Link href="#the-intelligence" data-chapter-link="intelligence">
            03 <span>Intelligence</span>
          </Link>
          <Link href="#the-system" data-chapter-link="system">
            04 <span>The system</span>
          </Link>
          <Link href="#the-ritual" data-chapter-link="ritual">
            05 <span>The ritual</span>
          </Link>
          <Link href="#the-reserve" data-chapter-link="reserve">
            06 <span>The Reserve</span>
          </Link>
          <Link href="#the-collective" data-chapter-link="collective">
            07 <span>The Collective</span>
          </Link>
          <Link href="#the-legacy" data-chapter-link="legacy">
            08 <span>Legacy</span>
          </Link>
        </nav>
        <section id="the-man" className="ascend-man" data-chapter="man" aria-labelledby="man-title">
          <div className="ascend-man-stage">
            <div className="ascend-man-image ascend-man-wide" aria-hidden="true">
              <picture>
                <source media="(max-width: 600px)" srcSet="/media/world/the-man-mobile.webp" />
                <Image src="/media/world/the-man.webp" alt="" fill sizes="100vw" />
              </picture>
            </div>
            <div className="ascend-man-image ascend-man-portrait" aria-hidden="true">
              <Image src="/media/world/the-man-portrait.webp" alt="" fill sizes="100vw" />
            </div>
            <div className="ascend-man-image ascend-man-decision" aria-hidden="true">
              <Image src="/media/world/the-man-decision.webp" alt="" fill sizes="100vw" />
            </div>
            <div className="ascend-man-shade" />
            <div className="ascend-man-copy ascend-man-opening">
              <p className="estate-eyebrow">02 / THE MAN AT THE CENTER</p>
              <h2 id="man-title">
                One man.
                <br />
                <em>Many demands.</em>
              </h2>
              <p>
                More information than ever. More to carry. His health, his work, his people, his
                future — each asking for a different part of him.
              </p>
            </div>
            <div className="ascend-man-copy ascend-man-burden">
              <p className="estate-eyebrow">THE WEIGHT OF A WHOLE LIFE</p>
              <p className="ascend-man-statement">His work. His health. His people.</p>
              <p>Each matters. None exists alone.</p>
            </div>
            <div className="ascend-man-copy ascend-man-choice">
              <p className="estate-eyebrow">A MOMENT OF CLARITY</p>
              <p className="ascend-man-resolution">
                The parts belong to <em>one life.</em>
              </p>
            </div>
            <span className="ascend-man-edge" aria-hidden="true" />
          </div>
        </section>
        <section
          id="the-intelligence"
          className="ascend-emergence"
          data-chapter="intelligence"
          aria-labelledby="intelligence-title"
        >
          <div className="ascend-emergence-stage">
            <div className="ascend-emergence-environment" aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className="ascend-intelligence-visual" aria-hidden="true">
              <div className="ascend-intelligence-camera">
                <div className="ascend-intelligence-field">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="ascend-intelligence-traces">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <IntelligenceSculpture />
              </div>
              <IntelligenceNetwork />
            </div>
            <div className="ascend-emergence-copy">
              <p className="estate-eyebrow">03 / AETHELIOS</p>
              <h2 id="intelligence-title">
                A clearer way
                <br />
                <em>to see the whole.</em>
              </h2>
              <p>
                Aethelios brings perspective to what you choose to share — helping you think,
                decide, and carry a deliberate next step forward.
              </p>
              <div className="estate-actions">
                <Link className="estate-primary" href="/aethelios">
                  Meet Aethelios <span>↗</span>
                </Link>
                <Link href="/enter">Enter your space ↗</Link>
              </div>
            </div>
          </div>
        </section>
        <LifeSystem />
        <RitualSequence />
        <RitualCollection />
        <section
          id="the-reserve"
          className="reserve-world"
          data-chapter="reserve"
          aria-labelledby="reserve-title"
        >
          <div className="reserve-world-environment" aria-hidden="true">
            <Image src="/media/world/reserve-consultation.webp" alt="" fill sizes="100vw" />
          </div>
          <div className="reserve-world-shade" aria-hidden="true" />
          <div className="reserve-world-copy">
            <p className="estate-eyebrow">06 / THE PHYSICAL WORLD · EUNICE, LOUISIANA</p>
            <h2 id="reserve-title">
              A place where
              <br />
              <em>care has a face.</em>
            </h2>
            <p>
              The Reserve at Sanctum brings personal consultation, Legacy Reserve rituals, and
              Katie’s men’s salon craft into one physical setting.
            </p>
            <div className="reserve-world-line">
              <span>Neil / consultation</span>
              <span>Katie / men’s salon craft</span>
            </div>
            <Link className="estate-primary" href="/reserve">
              Discover The Reserve <span>↗</span>
            </Link>
            <small>Atmosphere concepts · not photographs of the venue or its people</small>
          </div>
          <figure className="reserve-world-craft">
            <Image
              src="/media/world/sanctuary.webp"
              alt=""
              fill
              sizes="(max-width: 700px) 55vw, 28vw"
            />
            <figcaption>THE CRAFT / A MEN’S SALON EXPERIENCE</figcaption>
          </figure>
        </section>
        <section
          id="the-collective"
          className="collective-world"
          data-chapter="collective"
          aria-labelledby="collective-title"
        >
          <Image
            src="/media/world/collective-table-v1.webp"
            alt=""
            fill
            sizes="100vw"
            className="collective-world-image"
          />
          <div className="collective-world-shade" aria-hidden="true" />
          <div className="collective-world-copy">
            <p className="estate-eyebrow">07 / THE COLLECTIVE · THE HUMAN LAYER</p>
            <h2 id="collective-title">
              The work extends
              <br />
              <em>beyond one man.</em>
            </h2>
            <p>
              People with craft. People with knowledge. People willing to show up for one another.
              The Collective is the culture we are building around that exchange.
            </p>
            <div className="collective-world-threads" aria-label="The culture of the Collective">
              <span>Craft</span>
              <span>Knowledge</span>
              <span>Connection</span>
            </div>
            <div className="estate-actions">
              <Link className="estate-primary" href="/about">
                Our story <span>↗</span>
              </Link>
              <Link href="/membership">Membership ↗</Link>
            </div>
            <small>Campaign visualization · not portraits of current members</small>
          </div>
        </section>
        <section
          id="the-legacy"
          className="estate-act estate-legacy"
          data-chapter="legacy"
          aria-labelledby="legacy-title"
        >
          <div className="estate-art">
            <MediaScene media={estateMedia.legacy} bare />
          </div>
          <div className="estate-legacy-shade" />
          <SceneAtmosphere variant="dawn" />
          <div className="estate-legacy-copy">
            <p className="estate-eyebrow">08 / WHAT YOU CARRY FORWARD</p>
            <h2 id="legacy-title">
              For the life you build.
              <br />
              <em>And the people in it.</em>
            </h2>
            <p>
              The work. The quiet discipline. The care you give.
              <br />
              What you build begins with how you show up.
            </p>
            <Link href="/about">The story behind Gent Ascend ↗</Link>
          </div>
        </section>
        <section className="estate-invitation" aria-labelledby="invitation-title">
          <div className="estate-seal-mount">
            <Image src={brand.crest} alt="Gent Ascend Collective crest" width={240} height={240} />
          </div>
          <p className="estate-eyebrow">THE FINAL DOOR / YOUR NEXT CHAPTER</p>
          <h2 id="invitation-title">
            Enter <em>Gent Ascend.</em>
          </h2>
          <p>
            Begin your personal space through private invitation.
            <br />
            Or explore the collection and the people behind the world.
          </p>
          <div className="estate-actions">
            <Link className="estate-primary" href="/enter">
              Enter Gent Ascend <span>↗</span>
            </Link>
            <Link href="/shop">Explore the collection ↗</Link>
            <Link href="/about">Discover the world ↗</Link>
          </div>
        </section>
      </WorldJourney>
    </main>
  );
}
