'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Icon } from './visual/icon';
import { BplusMaterial } from './visual/bplus-material';
import { visibleDestinations, destinationIsCurrent } from './destinations';
const destinations = visibleDestinations({ signedIn: true })
  .filter((d) => d.primary)
  .map((d) => [d.href, d.label, d.icon] as const);
export function Navigation() {
  const path = usePathname();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () =>
      document.documentElement.style.setProperty(
        '--interaction-nav-space',
        `${matchMedia('(max-width:1100px)').matches ? node.getBoundingClientRect().height : 0}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
      document.documentElement.style.removeProperty('--interaction-nav-space');
    };
  }, []);
  return (
    <nav
      ref={ref}
      aria-label="Main navigation"
      className="navigation"
      style={{ gridTemplateColumns: `repeat(${destinations.length}, minmax(0, 1fr))` }}
    >
      {destinations.map(([href, label, icon]) => (
        <Link
          key={href}
          data-bplus-surface={
            (href === '/app/aethelios' || href === '/app/work') && path === href
              ? 'navigation'
              : undefined
          }
          href={href === '/app/aethelios' && path.startsWith('/app/companies/') ? path : href}
          prefetch={href === '/app/health' ? false : undefined}
          aria-current={destinationIsCurrent(href, path) ? 'page' : undefined}
        >
          {(href === '/app/aethelios' || href === '/app/work') && path === href && (
            <BplusMaterial radius={10} />
          )}
          <Icon name={icon} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
