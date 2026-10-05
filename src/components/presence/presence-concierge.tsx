import Link from 'next/link';
import { dayLabel } from '@/domains/daily/model';
import { approachingOccasion, type PresenceData } from '@/domains/presence/model';
import './presence.css';
import { PresencePreparedPlan } from './prepared-plan';

export function PresenceConcierge({ data }: { data: PresenceData }) {
  const occasion = approachingOccasion(data.occasions, data.today);
  return (
    <section className="presence-concierge" aria-labelledby="presence-heading">
      <Link prefetch={false} className="presence-back" href="/app">
        ← Command
      </Link>
      <header className="presence-intro">
        <p className="eyebrow">GENT ASCEND / PRESENCE</p>
        <h1 id="presence-heading">
          Show up
          <br />
          <em>with intention.</em>
        </h1>
        <p>How you look. How you carry yourself. How you arrive.</p>
        <Link prefetch={false} className="presence-action" href="/app/aethelios?starter=presence">
          Prepare with Aethelios <span aria-hidden="true">↗</span>
        </Link>
        <small>An editable conversation draft. You choose what to share and send.</small>
      </header>

      {data.mode === 'personal' && data.ownerId && <PresencePreparedPlan ownerId={data.ownerId} />}

      {data.mode === 'signed-out' ? (
        <p className="presence-note">
          Sign in for your private direction and saved occasions.{' '}
          <Link href="/enter">Sign in ↗</Link>
        </p>
      ) : (
        <section className="presence-preparation" aria-labelledby="presence-preparation">
          <p className="eyebrow">
            {occasion ? 'YOUR SAVED OCCASION / APPROACHING' : 'YOUR DIRECTION'}
          </p>
          <h2 id="presence-preparation">
            {occasion?.title ?? 'Keep your standard. Leave room for life.'}
          </h2>
          {occasion ? (
            <>
              <p>
                {dayLabel(occasion.day)}
                {occasion.note ? ` · ${occasion.note}` : ''}
              </p>
              <p>
                Consider the look, service timing and details you want handled before you arrive.
              </p>
            </>
          ) : (
            <p>
              {data.direction ??
                'Set the appearance direction that suits you. Return when something changes or a moment deserves preparation.'}
            </p>
          )}
          <Link prefetch={false} href="/app/grooming?section=occasion#occasion">
            {occasion ? 'Review occasion details' : 'Add an important occasion'} ↗
          </Link>
          {data.unavailable.length > 0 && (
            <p role="status">
              {data.unavailable.join(', ')} could not be loaded. Reopen Presence to try again.
            </p>
          )}
        </section>
      )}

      <nav className="presence-services" aria-label="Presence concierge services">
        <Link prefetch={false} href="/app/grooming/scan">
          <span>01 / APPEARANCE</span>
          <div>
            <h2>A closer look.</h2>
            <p>Guided hair, beard and skin observations when you want clarity.</p>
          </div>
          <b aria-hidden="true">↗</b>
        </Link>
        <Link prefetch={false} href="/app/grooming/look">
          <span>02 / EXPRESSION</span>
          <div>
            <h2>Your look.</h2>
            <p>Explore a direction. Keep references worth discussing.</p>
          </div>
          <b aria-hidden="true">↗</b>
        </Link>
        <Link prefetch={false} href="/app/aethelios?starter=presence-style">
          <span>03 / WARDROBE & CONFIDENCE</span>
          <div>
            <h2>Dress for the moment.</h2>
            <p>Talk through the occasion and what you own with Aethelios.</p>
          </div>
          <b aria-hidden="true">↗</b>
        </Link>
        <Link prefetch={false} href="/app/grooming/professional">
          <span>04 / PREPARATION</span>
          <div>
            <h2>Carry the direction forward.</h2>
            <p>Prepare a brief for the professional doing the work.</p>
          </div>
          <b aria-hidden="true">↗</b>
        </Link>
      </nav>

      {data.replenishment.length > 0 && (
        <aside className="presence-note" aria-label="Saved replenishment notes">
          <h2>Before you run out.</h2>
          <p>Products you marked running low. No usage or delivery timing is assumed.</p>
          <ul>
            {data.replenishment.map((product, index) => (
              <li key={`${product.name}-${index}`}>
                {product.name}
                {product.note ? ` · ${product.note}` : ''}
              </li>
            ))}
          </ul>
          <Link prefetch={false} href="/app/collection/cabinet">
            Review your Cabinet ↗
          </Link>
        </aside>
      )}

      <details className="presence-depth">
        <summary>Your grooming intelligence</summary>
        <p>
          Saved routines, product knowledge and private history remain here whenever you need them.
          Recording practice is optional.
        </p>
        <nav aria-label="Saved grooming tools">
          <Link prefetch={false} href="/app/grooming">
            Grooming concierge ↗
          </Link>
          <Link prefetch={false} href="/app/grooming?section=ritual#ritual">
            Routines & preferences ↗
          </Link>
          <Link prefetch={false} href="/app/grooming?section=progress#progress">
            Private visual history ↗
          </Link>
          <Link prefetch={false} href="/app/collection/cabinet">
            Products & Cabinet ↗
          </Link>
        </nav>
      </details>
    </section>
  );
}
