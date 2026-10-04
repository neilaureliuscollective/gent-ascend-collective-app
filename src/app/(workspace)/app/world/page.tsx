import Link from 'next/link';
const worlds = [
  {
    href: '/app/collection',
    title: 'The Collection',
    copy: 'Grooming, performance and recovery. Find what earns a place in your day.',
  },
  {
    href: '/app/ascend',
    title: 'LifeOS / Ascend',
    copy: 'Your direction, daily actions and reflection.',
  },
  {
    href: '/app/performance',
    title: 'Ascend Performance',
    copy: 'Training, fuel and recovery. One part of the whole man.',
  },
  {
    href: '/app/grooming',
    title: 'Grooming Concierge',
    copy: 'Your appearance, routines and professional direction.',
  },
  {
    href: '/app/aethelios',
    title: 'Aethelios',
    copy: 'Think through the next move with your personal intelligence.',
  },
  {
    href: '/app/studio',
    title: 'Aethelios Studio',
    copy: 'Shape an idea into a project and visual work.',
  },
];
export default function World() {
  return (
    <>
      <p className="eyebrow">Gent Ascend / The collective</p>
      <h1>My world.</h1>
      <p className="lead">Care for the man. Strengthen the life around him.</p>
      <nav className="world-directory" aria-label="Your worlds">
        {worlds.map((world) => (
          <Link key={world.href} href={world.href}>
            <h2>{world.title}</h2>
            <p>{world.copy}</p>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </nav>
      <details className="world-more">
        <summary>Explore the Collective</summary>
        <nav className="world-directory" aria-label="Collective experiences">
          <Link href="/app/collection">
            <h2>Legacy Reserve</h2>
            <p>The grooming and personal care collection.</p>
            <span>↗</span>
          </Link>
          <Link href="/reserve">
            <h2>The Reserve at Sanctum</h2>
            <p>Craft and personal care in Eunice.</p>
            <span>↗</span>
          </Link>
          <Link href="/app/welcome">
            <h2>Member guide</h2>
            <p>Set your direction and make your first meaningful action.</p>
            <span>↗</span>
          </Link>
        </nav>
      </details>
      <p className="muted">
        Health partner services and community experiences are still in development.
      </p>
    </>
  );
}
