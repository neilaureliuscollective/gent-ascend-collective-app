'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
const destinations = [
  ['/', 'Command', '01'],
  ['/world', 'My world', '02'],
  ['/progress', 'Progress', '03'],
  ['/you', 'You', '04'],
] as const;
export function Navigation() {
  const path = usePathname();
  return (
    <nav aria-label="Main navigation" className="navigation">
      {destinations.map(([href, label, index]) => (
        <Link key={href} href={href} aria-current={path === href ? 'page' : undefined}>
          <span className="nav-index" aria-hidden="true">
            {index}
          </span>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
