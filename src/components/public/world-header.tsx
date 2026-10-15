'use client';
import Link from 'next/link';
import Image from 'next/image';
import { brand } from '@/platform/brand';
import { GlobalNavigation } from '@/components/global-navigation';
import type { NavigationAccess } from '@/components/destinations';
export function WorldHeader({ access = {} }: { access?: NavigationAccess }) {
  return (
    <header className="world-header">
      <Link href="/" className="world-wordmark" aria-label="Aethelios home">
        <Image src={brand.crest} alt="" width={48} height={48} />
        <span>
          AETHELIOS<small>PERSONAL INTELLIGENCE OS</small>
        </span>
      </Link>
      <GlobalNavigation access={access} />
    </header>
  );
}
