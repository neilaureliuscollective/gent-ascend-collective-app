import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { aethelios } from '@/platform/intelligence-identity';

export const metadata: Metadata = {
  title: 'Meet Aethelios',
  description: aethelios.description,
};

export default function MeetAetheliosPage() {
  return (
    <article className="aethelios-introduction">
      <div className="aethelios-intro-heading">
        <p className="eyebrow">Gent Ascend Collective / Digital Co-Founder</p>
        <Link href="/aethelios" className="text-link">
          Enter your conversation ↗
        </Link>
      </div>
      <div className="aethelios-intro-grid">
        <figure className="aethelios-portrait">
          <Image
            src={aethelios.portrait}
            alt={aethelios.portraitAlt}
            width={960}
            height={1200}
            sizes="(max-width: 639px) 100vw, (max-width: 1100px) 46vw, 40vw"
            preload
          />
          <figcaption>
            <span>AETHELIOS</span>
            <small>{aethelios.title}</small>
          </figcaption>
        </figure>
        <div className="aethelios-intro-copy">
          <p className="eyebrow">Meet Aethelios</p>
          <h1>
            The mission.
            <br />
            Made present.
          </h1>
          <p className="aethelios-intro-lead">
            Aethelios is the digital co-founder of Gent Ascend Collective.
          </p>
          <p>
            One founder can only be in one place at a time. Aethelios extends the mission into your
            everyday life — with guidance, perspective, and a standard you can build toward.
          </p>
          <p>
            The founder remains the human source. Aethelios carries that intention further,
            supporting your judgment and your connections with the people who matter.
          </p>
          <Link href="/aethelios" className="button">
            Talk with Aethelios <span aria-hidden="true">↗</span>
          </Link>
          <p className="aethelios-intro-note">
            Intelligence in service of the man. Always connected to a human mission.
          </p>
        </div>
      </div>
      <section className="aethelios-expectations" aria-labelledby="aethelios-expectations-title">
        <div>
          <p className="eyebrow">A better standard, built daily</p>
          <h2 id="aethelios-expectations-title">Here’s what to expect.</h2>
        </div>
        <ol>
          <li>
            <span aria-hidden="true">01</span>
            <div>
              <h3>A clearer next move.</h3>
              <p>
                Think through routines, training, work, relationships, and decisions. Turn
                reflection into a step you can keep.
              </p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">02</span>
            <div>
              <h3>Continuity, on your terms.</h3>
              <p>
                Bring your goals and confirmed memories into the conversation when useful. You
                choose what is remembered.
              </p>
            </div>
          </li>
          <li>
            <span aria-hidden="true">03</span>
            <div>
              <h3>A presence with perspective.</h3>
              <p>
                Expect considered guidance and respectful challenge. Aethelios is AI; your judgment,
                human mentors, and real relationships remain essential.
              </p>
            </div>
          </li>
        </ol>
      </section>
      <aside className="aethelios-voice-note" aria-label="Aethelios voice">
        <span className="eyebrow">Aethelios Voice / Future experience</span>
        <p>
          The same composed presence, built for conversation. Today, connect through text. Listening
          and speaking orb states are visual previews; your microphone stays off.
        </p>
      </aside>
    </article>
  );
}
