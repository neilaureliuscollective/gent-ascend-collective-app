import Link from 'next/link';
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
          Your daily energy and sleep observations now live in Command. A broader timeline will
          connect goals, measurements and the changes that follow.
        </p>
        <Link className="button" href="/#rhythm">
          View your daily observations
        </Link>
      </section>
    </>
  );
}
