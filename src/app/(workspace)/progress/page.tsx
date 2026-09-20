export default function Progress() {
  return (
    <>
      <p className="eyebrow">The long view</p>
      <h1>
        Progress,
        <br />
        <em>over time.</em>
      </h1>
      <section className="panel empty-state">
        <span className="eyebrow">Your history</span>
        <h2>Every meaningful step belongs here.</h2>
        <p>
          No progress measurements have been recorded. Your timeline will connect goals,
          observations and the changes that follow.
        </p>
        <span className="pill">Recording arrives in the next stage</span>
      </section>
    </>
  );
}
