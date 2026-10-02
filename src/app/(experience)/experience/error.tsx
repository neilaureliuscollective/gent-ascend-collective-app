'use client';
import Link from 'next/link';
export default function WorldError({ reset }: { reset: () => void }) {
  return (
    <section className="gw-practice">
      <h1 tabIndex={-1}>Let’s reconnect.</h1>
      <p>Your world could not load. Your account records have not been changed.</p>
      <button className="gw-action" onClick={reset}>
        Try again
      </button>
      <Link href="/experience/world">Return to World</Link>
    </section>
  );
}
