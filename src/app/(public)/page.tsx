import Image from 'next/image';
import { MediaScene } from '@/components/public/media-scene';
import { estateMedia } from '@/platform/estate-media';
import Link from 'next/link';
import { IntelligenceSculpture } from '@/components/public/intelligence-sculpture';
import { WorldJourney } from '@/components/public/world-journey';
import { RitualCollection } from '@/components/public/ritual-collection';
import { OrbitSignature } from '@/components/visual/orbit-signature';
import { brand } from '@/platform/brand';
import './estate.css';

export default function PublicHome() {
  return (
    <main id="world-main" className="estate-home">
      <WorldJourney>
        <section
          className="estate-opening"
          id="the-world"
          data-chapter="arrival"
          aria-labelledby="arrival-title"
        >
          <div className="estate-opening-stage">
            <div className="estate-landscape">
              <MediaScene media={estateMedia.arrival} bare priority />
            </div>
            <div className="estate-opening-shade" />
            <div className="estate-hero-copy">
              <p className="estate-eyebrow">GENT ASCEND COLLECTIVE · LOUISIANA</p>
              <h1 id="arrival-title">
                A life,
                <br />
                <em>deliberately built.</em>
              </h1>
              <p className="estate-definition">
                Grooming. Wellbeing. Personal intelligence.
                <br />A connected world for the man you choose to become.
              </p>
              <div className="estate-actions">
                <Link className="estate-primary" href="#the-ritual">
                  Explore the world <span>↓</span>
                </Link>
                <Link href="/enter">Member entrance ↗</Link>
              </div>
            </div>
            <div className="estate-threshold">
              <span className="estate-eyebrow">THE WORLD YOU ENTER</span>
              <p>
                Care becomes ritual.
                <br />
                Intention becomes <em>direction.</em>
              </p>
              <span>
                Products. Intelligence. Experiences.
                <br />
                Built around the same life. Yours.
              </span>
            </div>
            <div className="estate-veil" />
            <div className="estate-opening-caption">
              <span>01 / ARRIVAL</span>
              <span>
                Scroll to enter <i>↓</i>
              </span>
            </div>
          </div>
        </section>
        <nav className="estate-index" aria-label="Explore the world">
          <Link href="#the-world" data-chapter-link="arrival">
            01 <span>Arrival</span>
          </Link>
          <Link href="#the-ritual" data-chapter-link="ritual">
            02 <span>The ritual</span>
          </Link>
          <Link href="#the-intelligence" data-chapter-link="intelligence">
            03 <span>Intelligence</span>
          </Link>
          <Link href="#the-reserve" data-chapter-link="reserve">
            04 <span>The Reserve</span>
          </Link>
          <Link href="#the-legacy" data-chapter-link="legacy">
            05 <span>Legacy</span>
          </Link>
        </nav>
        <section
          id="the-ritual"
          className="estate-act estate-ritual"
          data-chapter="ritual"
          aria-labelledby="ritual-title"
        >
          <div className="estate-art">
            <MediaScene media={estateMedia.ritual} bare />
          </div>
          <div className="estate-scene-shade" />
          <div className="estate-scene-copy">
            <p className="estate-eyebrow">02 / THE DAILY RITUAL · LEGACY RESERVE</p>
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
          <span className="estate-scene-note">VITALIS / HAIR & BEARD OIL · COLLECTION PREVIEW</span>
        </section>
        <RitualCollection />
        <section
          id="the-intelligence"
          className="estate-act estate-intelligence"
          data-chapter="intelligence"
          aria-labelledby="intelligence-title"
        >
          <div className="estate-intelligence-lines" aria-hidden="true" />
          <IntelligenceSculpture />
          <div className="estate-orbit" aria-hidden="true">
            <div className="estate-orbit-core">Æ</div>
            <i />
            <i />
            <i />
            <div className="estate-orbit-trace">
              <OrbitSignature />
            </div>
          </div>
          <div className="estate-scene-copy">
            <p className="estate-eyebrow">03 / AETHELIOS · PERSONAL INTELLIGENCE</p>
            <h2 id="intelligence-title">
              Your direction.
              <br />
              <em>Carried forward.</em>
            </h2>
            <p>
              A place to think clearly. An intelligence that works with the context you choose to
              share. A personal OS that connects your goals, actions, and reflections.
            </p>
            <div className="estate-actions">
              <Link className="estate-primary" href="/aethelios">
                Meet Aethelios <span>↗</span>
              </Link>
              <Link href="/gent-ascend">Explore the OS ↗</Link>
            </div>
          </div>
          <div className="estate-loop" aria-label="The Ascend loop">
            <span>Direction</span>
            <i>→</i>
            <span>Action</span>
            <i>→</i>
            <span>Reflection</span>
            <i>↺</i>
          </div>
        </section>
        <section
          id="the-reserve"
          className="estate-act estate-reserve"
          data-chapter="reserve"
          aria-labelledby="reserve-title"
        >
          <div className="estate-reserve-frame" aria-hidden="true">
            <div className="estate-reserve-door">
              <Image src={brand.crest} width={150} height={150} alt="" />
              <span>
                THE RESERVE<small>AT SANCTUM</small>
              </span>
            </div>
            <div className="estate-reserve-light" />
          </div>
          <div className="estate-scene-copy">
            <p className="estate-eyebrow">04 / THE RESERVE AT SANCTUM · EUNICE, LOUISIANA</p>
            <h2 id="reserve-title">
              Care becomes
              <br />
              <em>personal.</em>
            </h2>
            <p>
              The people. The craft. The attention.
              <br />
              Our flagship physical experience brings Katie’s men’s salon expertise and Neil’s
              grooming direction into one considered setting.
            </p>
            <Link className="estate-primary" href="/reserve">
              Discover The Reserve <span>↗</span>
            </Link>
            <small className="estate-concept-note">
              Architectural brand study · interior photography to follow
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
          <div className="estate-legacy-copy">
            <p className="estate-eyebrow">05 / WHAT YOU CARRY FORWARD</p>
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
          <Image src={brand.crest} alt="Gent Ascend crest" width={90} height={90} />
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
