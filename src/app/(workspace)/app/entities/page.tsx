import Link from 'next/link';
import { council } from '@/domains/intelligence/council';
import '@/app/ecosystem.css';
export const metadata = { title: 'Aethelios Entities' };
export default function Entities() {
  return (
    <div className="ecosystem-page">
      <header className="ecosystem-heading">
        <p className="eyebrow">THE ENTITY NETWORK</p>
        <h1>
          Different perspectives.
          <br />
          One clear purpose.
        </h1>
        <p className="lead">
          Meet the public specialists already available through Intelligence Team and Council in
          Talk.
        </p>
        <Link className="button" href="/app/aethelios">
          Open Intelligence Team in Talk →
        </Link>
      </header>
      <div className="ecosystem-directory">
        {council.map((entity) => (
          <article id={entity.id} key={entity.id}>
            <div>
              <p className="eyebrow">{entity.role}</p>
              <h2>{entity.name}</h2>
              <p>{entity.description}</p>
            </div>
            <Link href={`/app/aethelios?starter=entity-${entity.id}`}>
              Prepare a {entity.name} brief →
            </Link>
          </article>
        ))}
      </div>
      <section className="ecosystem-note">
        <h2>You choose what gets shared.</h2>
        <p>
          These links prepare a draft only. Nothing is sent and no specialist is selected
          automatically. In Talk, review your prompt, personal-context setting and specialist
          selection before sending. Council uses bounded calls and Aethelios synthesis; it does not
          run code or take external actions.
        </p>
        <p>
          Public Entities are separate from the private founder system. Health records are not
          connected to this network.
        </p>
      </section>
    </div>
  );
}
