import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="console">
      <p className="eyebrow">Gent Ascend Collective</p>
      <h1>This space isn’t available.</h1>
      <Link className="button" href="/">
        Return to Gent Ascend
      </Link>
    </main>
  );
}
