import Image from 'next/image';
import Link from 'next/link';
export default function PerformanceWorld() {
  return (
    <section className="gw-performance" aria-labelledby="performance-heading">
      <div className="gw-environment" aria-hidden="true">
        <Image src="/media/world/life-instrument.webp" alt="" fill sizes="100vw" preload />
      </div>
      <Link className="gw-return" href="/experience/world">
        ← Whole-Man World
      </Link>
      <div className="gw-performance-copy">
        <p className="gw-kicker">01 / PERFORMANCE</p>
        <h1 id="performance-heading" tabIndex={-1}>
          Strength for
          <br />
          <em>the life you carry.</em>
        </h1>
        <p>
          Training. Fuel. Recovery.
          <br />A physical practice with a larger purpose.
        </p>
        <Link className="gw-action" href="/experience/performance/practice">
          Enter your practice ↗
        </Link>
        <p className="gw-muted">Explore a sample, or use your connected account.</p>
      </div>
      <p className="gw-domain-note">
        THE WHOLE MAN <span> / </span> PERFORMANCE <span> / </span> PHYSICAL TWIN · FUTURE SYSTEM
      </p>
    </section>
  );
}
