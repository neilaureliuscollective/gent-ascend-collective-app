'use client';
export default function CommandError({ reset }: { reset: () => void }) {
  return (
    <div className="command-briefing">
      <section
        className="command-environment command-degraded"
        aria-labelledby="command-unavailable"
      >
        <span className="command-section-label">Command</span>
        <h1 id="command-unavailable">Your saved context is unavailable.</h1>
        <p>Command could not load your records. Nothing here has been changed.</p>
        <button className="command-action" onClick={reset}>
          Try again <span aria-hidden="true">↗</span>
        </button>
      </section>
    </div>
  );
}
