'use client';
export default function HealthError({ reset }: { reset: () => void }) {
  return (
    <section style={{ padding: 40 }}>
      <h1>Health could not open.</h1>
      <p>Your original records have not been changed.</p>
      <button onClick={reset}>Try again</button>
    </section>
  );
}
