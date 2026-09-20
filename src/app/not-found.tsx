import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="console">
      <p className="eyebrow">Aurelius Collective</p>
      <h1>This space isn’t available.</h1>
      <Link className="button" href="/">
        Return to Command
      </Link>
    </main>
  );
}
