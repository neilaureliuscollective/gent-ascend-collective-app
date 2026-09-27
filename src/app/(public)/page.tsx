import Image from 'next/image';
import { MediaScene } from '@/components/public/media-scene';
import { estateMedia } from '@/platform/estate-media';
import Link from 'next/link';
import { IntelligenceSculpture } from '@/components/public/intelligence-sculpture';
import { WorldJourney } from '@/components/public/world-journey';
import { RitualCollection } from '@/components/public/ritual-collection';
import { brand } from '@/platform/brand';
import { SceneAtmosphere } from '@/components/public/scene-atmosphere';
import './estate.css';
import './environment.css';
import './ascend-journey.css';

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
            <div className="ascend-depth" aria-hidden="true">
              <i />
              <i />
              <i />
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
          <Link href="#the-legacy" data-chapter-link="legacy">
            07 <span>Legacy</span>
          </Link>
        </nav>
        <section id="the-man" className="ascend-man" data-chapter="man" aria-labelledby="man-title">
          <div className="ascend-man-stage">
            <div className="ascend-man-image" aria-hidden="true">
              <picture>
                <source media="(max-width: 600px)" srcSet="/media/world/the-man-mobile.webp" />
                <Image src="/media/world/the-man.webp" alt="" fill sizes="100vw" />
              </picture>
            </div>
            <div className="ascend-man-shade" />
            <div className="ascend-man-copy">
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
            <div className="ascend-signals" aria-hidden="true">
              <span>HEALTH</span>
              <span>APPEARANCE</span>
              <span>WORK</span>
              <span>RECOVERY</span>
              <span>RESPONSIBILITY</span>
              <span>DIRECTION</span>
            </div>
            <p className="ascend-man-resolution">
              The parts belong to <em>one life.</em>
            </p>
          </div>
        </section>
        <section
          id="the-intelligence"
          className="ascend-emergence"
          data-chapter="intelligence"
          aria-labelledby="intelligence-title"
        >
          <div className="ascend-emergence-stage">
            <div className="ascend-intelligence-field" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </div>
            <IntelligenceSculpture />
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
            <div className="ascend-connections" aria-hidden="true">
              <span>YOU</span>
              <span>HEALTH</span>
              <span>RITUALS</span>
              <span>GOALS</span>
              <span>WORK</span>
              <span>RECOVERY</span>
            </div>
          </div>
        </section>
        <section
          id="the-system"
          className="ascend-system"
          data-chapter="system"
          aria-labelledby="system-title"
        >
          <div className="ascend-system-stage">
            <div className="ascend-system-copy">
              <p className="estate-eyebrow">04 / THE GENT ASCEND LIFEOS</p>
              <h2 id="system-title">
                Direction becomes
                <br />
                <em>daily practice.</em>
              </h2>
              <p>
                A place to choose what matters, act on it, see what happened, and adapt. Aethelios
                carries context across the loop with you.
              </p>
              <div className="estate-actions">
                <Link className="estate-primary" href="/gent-ascend">
                  Explore the OS <span>↗</span>
                </Link>
                <Link href="/enter">Member entrance ↗</Link>
              </div>
            </div>
            <div
              className="ascend-loop-system"
              aria-label="The Ascend Loop: understand where you are, decide what matters, choose an action, record what you did, reflect on what you learned, and adjust what comes next."
            >
              <div className="ascend-loop-orbit" aria-hidden="true" />
              <div className="ascend-loop-center" aria-hidden="true">
                <span>
                  THE
                  <br />
                  ASCEND
                  <br />
                  LOOP
                </span>
              </div>
              <ol>
                <li>
                  <span>01</span> Where am I?
                </li>
                <li>
                  <span>02</span> What matters?
                </li>
                <li>
                  <span>03</span> What should I do?
                </li>
                <li>
                  <span>04</span> What did I do?
                </li>
                <li>
                  <span>05</span> What did we learn?
                </li>
                <li>
                  <span>06</span> What changes next?
                </li>
              </ol>
            </div>
          </div>
        </section>
        <section
          id="the-ritual"
          className="estate-act estate-ritual estate-held"
          data-chapter="ritual"
          aria-labelledby="ritual-title"
        >
          <div className="estate-scene-stage">
            <div className="estate-art">
              <MediaScene media={estateMedia.ritual} bare />
            </div>
            <div className="estate-scene-shade" />
            <SceneAtmosphere variant="dawn" />
            <div className="estate-scene-copy">
              <p className="estate-eyebrow">05 / THE DAILY RITUAL · LEGACY RESERVE</p>
              <h2 id="ritual-title">
                Begin with
                <br />
                <em>the care you take.</em>
              </h2>
              <p>
                A moment to prepare. To pay attention.
                <br />
                To carry yourself with intention.
              </p>
              <Link className="estate-primary" href="/shop/vitalis">
                Discover Vitalis <span>↗</span>
              </Link>
            </div>
            <span className="estate-scene-note">
              VITALIS / HAIR & BEARD OIL · COLLECTION PREVIEW
            </span>
          </div>
        </section>
        <RitualCollection />
        <section
          id="the-reserve"
          className="estate-act estate-reserve"
          data-chapter="reserve"
          aria-labelledby="reserve-title"
        >
          <div className="estate-reserve-frame">
            <SceneAtmosphere image="/media/world/reserve-consultation.webp" variant="sanctuary" />
          </div>
          <div className="estate-scene-copy">
            <p className="estate-eyebrow">06 / THE RESERVE AT SANCTUM · EUNICE, LOUISIANA</p>
            <h2 id="reserve-title">
              A place to
              <br />
              <em>come into your own.</em>
            </h2>
            <p>
              Sit down. Talk through your routine, your goals, and the care that fits your life.
              Neil’s grooming and performance consultations, Legacy Reserve products, and Katie’s
              men’s salon craft shape our flagship physical experience.
            </p>
            <div className="estate-reserve-pillars" aria-label="The Reserve experience">
              <span>Personal consultation</span>
              <span>Products & rituals</span>
              <span>Men’s salon craft</span>
            </div>
            <Link className="estate-primary" href="/reserve">
              Discover The Reserve <span>↗</span>
            </Link>
            <small className="estate-concept-note">
              Atmosphere concept · not a photograph of the venue
            </small>
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
            <p className="estate-eyebrow">07 / WHAT YOU CARRY FORWARD</p>
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
          <SceneAtmosphere image="/media/world/gallery.webp" />
          <div className="estate-seal-mount">
            <Image src={brand.crest} alt="Gent Ascend Collective crest" width={240} height={240} />
          </div>
          <p className="estate-eyebrow">YOUR NEXT CHAPTER</p>
          <h2 id="invitation-title">
            Find your place
            <br />
            <em>in the Collective.</em>
          </h2>
          <p>
            Explore the collection. Discover The Reserve.
            <br />
            Enter your personal OS through private invitation.
          </p>
          <div className="estate-actions">
            <Link className="estate-primary" href="/enter">
              Member entrance <span>↗</span>
            </Link>
            <Link href="/membership">About membership ↗</Link>
            <Link href="/shop">Explore products ↗</Link>
          </div>
        </section>
      </WorldJourney>
    </main>
  );
}
