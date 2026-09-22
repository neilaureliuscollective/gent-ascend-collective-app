import Link from 'next/link';
export default function World() {
  return (
    <>
      <p className="eyebrow">Gent Ascend / The collective</p>
      <h1>My world.</h1>
      <p className="lead">Care for the man. Strengthen the life around him.</p>
      <Link className="button" href="/goals">
        Your goals <span aria-hidden="true">→</span>
      </Link>
      <div className="domains-grid">
        {[
          ['Grooming & presence', 'Skin, hair, beard, and the standard you carry.'],
          ['Body & performance', 'Training, nutrition, sleep and recovery.'],
          ['Mind & character', 'Resilience, reflection, discipline, and personal growth.'],
          ['Work & direction', 'Planning, responsibility, and meaningful progress.'],
          ['Community & connection', 'Shared standards, expert support, and relationships.'],
          ['Life & legacy', 'Family, memories, and what you build for the long term.'],
        ].map(([title, copy], index) => (
          <section className="panel" key={title}>
            <span className="eyebrow">0{index + 1} / Planned</span>
            <h2>{title}</h2>
            <p>{copy}</p>
            <p className="muted">This space is not active yet.</p>
          </section>
        ))}
      </div>
      <section className="reserve-relationship">
        <div>
          <p className="eyebrow">THE PRODUCT BRAND</p>
          <h2>Legacy Reserve</h2>
        </div>
        <p>
          Grooming and wellness products within the wider Gent Ascend world. Commerce is planned;
          the product identity remains Legacy Reserve.
        </p>
      </section>
    </>
  );
}
