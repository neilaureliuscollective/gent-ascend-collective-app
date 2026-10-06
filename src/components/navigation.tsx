'use client';
import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Icon, type IconName } from './visual/icon';
const destinations: [string, string, IconName][] = [
  ['/app/aethelios', 'Talk', 'spark'],
  ['/app/work', 'Work', 'command'],
  ['/app/studio', 'Studio', 'collection'],
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
    <nav ref={ref} aria-label="Main navigation" className="navigation">
      {destinations.map(([href, label, icon]) => (
        <Link
          key={href}
          href={href === '/app/aethelios' && path.startsWith('/app/companies/') ? path : href}
          aria-current={
            path === href ||
            path.startsWith(href + '/') ||
            (href === '/app/aethelios' && path.startsWith('/app/companies/'))
              ? 'page'
              : undefined
          }
        >
          <Icon name={icon} />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
