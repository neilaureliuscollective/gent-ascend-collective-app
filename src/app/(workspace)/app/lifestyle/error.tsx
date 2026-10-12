'use client';
export default function LifestyleError({ reset }: { reset: () => void }) {
  return (
    <section className="collection-opening" role="alert">
      <h1>The collection could not open.</h1>
      <p>Please try again to check current product details.</p>
      <button className="world-button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
