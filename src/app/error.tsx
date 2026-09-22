'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="console">
      <p className="eyebrow">Gent Ascend Collective</p>
      <h1>A moment to reconnect.</h1>
      <p>Your workspace could not be loaded. Please try again.</p>
      <button className="button" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
