'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './visual/icon';
import { BplusMaterial } from './visual/bplus-material';
const destinations: [string, string, IconName][] = [
  ['/app/aethelios', 'Talk', 'spark'],
  ['/app/work', 'Work', 'command'],
  ['/app/studio', 'Studio', 'collection'],
  ['/app/health', 'Health', 'person'],
  ['/app/lifestyle', 'Lifestyle', 'collection'],
  ['/app/ecosystem', 'Ecosystem', 'world'],
];
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
          aria-current={
            path === href ||
            path.startsWith(href + '/') ||
            (href === '/app/aethelios' && path.startsWith('/app/companies/')) ||
            (href === '/app/lifestyle' && path.startsWith('/app/collection'))
              ? 'page'
              : undefined
          }
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
