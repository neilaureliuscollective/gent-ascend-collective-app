import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { Chapter } from '@/components/public/editorial';
export const metadata: Metadata = { title: 'Meet Aethelios' };
export default function Aethelios() {
  return (
    <main id="world-main">
      <header className="world-page-intro">
        <span className="world-kicker">Personal intelligence / Within Gent Ascend</span>
        <h1>
          Aethelios.
          <br />
          <em>Think it through.</em>
        </h1>
        <p>
          A calm, capable intelligence alongside your daily life. Bring the question, the decision,
          or the unfinished thought. Work toward clarity and a next step you choose.
        </p>
        <div className="world-actions">
          <Link href="/enter" className="world-button">
            Enter your workspace <span>↗</span>
          </Link>
          <Link href="/gent-ascend" className="world-text-link">
            Explore the OS ↗
          </Link>
        </div>
      </header>
      <section className="world-section">
        <div className="story-with-portrait">
          <div>
            <Image
              className="world-portrait"
              src="/brand/aethelios-portrait.webp"
              width={720}
              height={900}
              alt="Aethelios, the fictional visual identity of Gent Ascend’s personal AI intelligence"
            />
            <p className="illustration-disclosure">A fictional identity for an AI intelligence.</p>
          </div>
          <div>
            <Chapter number="01" label="Continuity, with your say" />
            <h2>
              Context matters.
              <br />
              <em>You stay in command.</em>
            </h2>
            <p>
              Aethelios can work with the profile, goals, memories, and recent daily records you
              choose to share. Your conversations are saved to your account so you can return to
              them.
            </p>
            <p>
              Confirmed memories can be corrected or forgotten. Proposed daily actions require your
              approval. You can inspect your context and choose whether to include it in a
              conversation.
            </p>
            <div className="preview-notice">
              Voice and file attachments are future capabilities. The current experience is a
              private text conversation connected to your Gent Ascend OS.
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
