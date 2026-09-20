export default function World() {
  return (
    <>
      <p className="eyebrow">Your connected life</p>
      <h1>My world.</h1>
      <p className="lead">Each part of your life. One considered perspective.</p>
      <div className="domains-grid">
        {[
          ['Body & performance', 'Training, nutrition, sleep and recovery.'],
          ['Mind & direction', 'Goals, routines, reflection and wellbeing.'],
          ['Life & legacy', 'Work, relationships, records and memories.'],
        ].map(([title, copy]) => (
          <section className="panel" key={title}>
            <span className="eyebrow">Planned</span>
            <h2>{title}</h2>
            <p>{copy}</p>
            <p className="muted">This space is not active yet.</p>
          </section>
        ))}
      </div>
    </>
  );
}
