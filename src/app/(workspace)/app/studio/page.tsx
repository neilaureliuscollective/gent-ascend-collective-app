import Link from 'next/link';
import type { Metadata } from 'next';
import { StudioWorkspace } from '@/components/aurelius/studio-workspace';
import { AetheliosSpaceNavigation } from '@/components/aurelius/space-navigation';

export const metadata: Metadata = {
  title: 'Aethelios Studio',
  description: 'Create and refine images with Aethelios.',
};

export default function StudioPage() {
  return (
    <div className="studio-page">
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Aethelios / Studio</p>
          <h1>Visual ideas, developed.</h1>
        </div>
        <Link className="text-link" href="/app">Command ↗</Link>
      </div>
      <AetheliosSpaceNavigation placement="studio" />
      <StudioWorkspace />
    </div>
  );
}
